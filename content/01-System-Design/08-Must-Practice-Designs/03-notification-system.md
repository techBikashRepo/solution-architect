# Notification System — System Design

> **Subject**: System Design · **Group**: 🎯 Must Practice Designs · **Topic**: 03 of 06
> **Status**: ✅ Done

---

## Part 1: Requirements & Estimation

---

### Functional Requirements

| Requirement            | Detail                                                          |
| ---------------------- | --------------------------------------------------------------- |
| **Send notifications** | Push (iOS/Android), Email, SMS                                  |
| **Multiple triggers**  | System-triggered (order shipped) + user-triggered               |
| **User preferences**   | Users can opt-out of specific notification types                |
| **Delivery guarantee** | At-least-once delivery                                          |
| **Priority**           | Transactional (OTP, order confirmation) > Marketing (promotion) |

### Non-Functional Requirements

| Requirement       | Target                                                      |
| ----------------- | ----------------------------------------------------------- |
| **Scale**         | 10M notifications/day; 10K/sec peak for marketing campaigns |
| **Latency**       | Transactional: <5 seconds; Marketing: best effort           |
| **Reliability**   | No message loss; retry on failure                           |
| **Extensibility** | Add new channels (WhatsApp, Slack) without redesign         |

---

### Estimation

```
10M notifications/day = 10M / 86400 ≈ 116/sec average
Peak for marketing blast: 10K/sec

Notification types (rough split):
  Push (60%): 6M/day
  Email (30%): 3M/day
  SMS (10%): 1M/day

Storage:
  Each notification record: ~1KB
  10M × 1KB = 10 GB/day
  30-day history: 300 GB (manageable in DynamoDB)
```

---

## Part 2: High-Level Design + Detailed Design

---

### High-Level Architecture

```
PRODUCERS (what triggers notifications):
  Order Service → "order.shipped"
  Auth Service → "user.otp_requested"
  Marketing → "campaign.send"

                    ↓
         [SNS Topic: notification-events]
                    ↓
    [SQS: notification-queue (per priority or channel)]
                    ↓
       [Notification Service (Lambda / ECS workers)]
         ↙          ↓         ↘
  [Push Worker] [Email Worker] [SMS Worker]
       ↓              ↓              ↓
   APNs/FCM         SES           SNS SMS
   (Apple/Google)

RESULTS FLOW:
  Delivery result → DynamoDB (notification_status table)
  Failed delivery → DLQ → retry logic → alert
```

---

### Detailed Component Design

#### User Preference Service

```
Before sending any notification:
  GET /preferences/{user_id}
  Returns: {
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    marketing_opted_out: true,
    email: "user@example.com",
    device_tokens: ["abc123fcm", "xyz789apns"]
  }

Storage: DynamoDB
  PK: user_id
  Attributes: channel preferences, contact info, device tokens

Cache: Redis (TTL 5 min) — preferences don't change often
```

#### Notification Router

```python
# Pseudo-code for notification routing
def route_notification(event):
    user_prefs = get_preferences(event.user_id)  # Redis → DynamoDB

    notification = {
        "type": event.type,               # "order.shipped"
        "priority": event.priority,       # "transactional" | "marketing"
        "template_id": event.template_id, # "order-shipped-v2"
        "data": event.data                # {order_id, tracking_url}
    }

    # Check opt-out
    if notification.priority == "marketing" and user_prefs.marketing_opted_out:
        log("User opted out; skip")
        return

    # Route to enabled channels
    for channel in ["push", "email", "sms"]:
        if user_prefs[f"{channel}_enabled"]:
            enqueue(f"sqs://{channel}-queue", notification)
```

#### Template System

```
Avoid hardcoded messages — use templates:

Template: "order-shipped-v2"
  Push:  "Your order {{order_id}} has shipped! Track it here: {{tracking_url}}"
  Email: "Dear {{user_name}}, your order {{order_id}} is on its way!"
  SMS:   "Order {{order_id}} shipped. Track: {{tracking_url}}"

Storage: S3 (template files) + DynamoDB (template metadata)
Rendering: Lambda renders template + data before sending
A/B testing: Multiple template variants per template_id
```

---

### Data Model

```
Table: notifications (DynamoDB)
  PK: notification_id (UUID)
  SK: user_id (for user-based queries)
  Attributes:
    channel: "push" | "email" | "sms"
    status: "pending" | "sent" | "failed" | "delivered"
    sent_at: timestamp
    type: "order.shipped"
    retry_count: 2
    error_msg: "APNs invalid token" (if failed)
    TTL: 30 days (auto-delete old records)

GSI: user_id-sent_at-index → query user notification history

Table: user_preferences (DynamoDB)
  PK: user_id
  Attributes: email, phone, device_tokens[], channel_preferences{}
```

---

## Part 3: Scaling, Failure Handling & AWS Architecture

---

### Scaling Strategy

| Challenge                                        | Solution                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| **10K/sec during marketing blast**               | SQS absorbs burst; workers auto-scale on queue depth                   |
| **APNs/FCM rate limits**                         | Batch notifications; respect provider rate limits; exponential backoff |
| **Template rendering at scale**                  | Pre-render common templates; cache rendered templates in Redis         |
| **User preference lookup on every notification** | Redis cache; stale by 5 min is acceptable                              |

---

### Failure Handling

| Failure                            | Handling                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| **APNs/FCM returns invalid token** | Delete stale device token from DynamoDB; don't retry                              |
| **Email bounce**                   | SES bounce webhook → SNS → Lambda → mark email invalid                            |
| **SMS delivery failure**           | Retry 3x with backoff; fall back to email if SMS fails                            |
| **Notification Service crashes**   | SQS message visibility timeout → auto-retry; DLQ after 3 failures                 |
| **Duplicate send (at-least-once)** | Check notification_id in DynamoDB before sending; idempotency key                 |
| **Marketing blast DLQ floods**     | Separate DLQ per channel priority; don't mix transactional and marketing failures |

---

### AWS Architecture

```
[Order Service / Auth Service / Marketing CMS]
          ↓ publish events
[EventBridge]  ← rule-based routing
    Rule: priority=transactional → SQS: high-priority-queue
    Rule: priority=marketing     → SQS: marketing-queue
    Rule: all events              → DynamoDB: audit log

[SQS: high-priority-queue]    → [Lambda: notification-dispatcher] → concurrency=500
[SQS: marketing-queue]        → [Lambda: notification-dispatcher] → concurrency=100

Notification Dispatcher Lambda:
  1. Fetch user preferences (Redis/DynamoDB)
  2. Check opt-out
  3. Render template (S3 template + data)
  4. Fan out to channel-specific queues:
     [SQS: push-queue]  → [Lambda: push-worker] → APNs / FCM
     [SQS: email-queue] → [Lambda: email-worker] → SES
     [SQS: sms-queue]   → [Lambda: sms-worker]   → SNS SMS (or Twilio)
  5. Record notification in DynamoDB

[SES] → bounce/complaint webhooks → [SNS] → [Lambda] → DynamoDB (mark invalid)

MONITORING:
  CloudWatch: SQS queue depth per priority
  Alert: high-priority queue depth > 1000 (transactional notifications backing up)
  Alert: DLQ depth > 0 (notification failures)
  Dashboard: delivery rate per channel per hour
```

---

### Interview Answer (2-min verbal walkthrough)

> _"A notification system needs to handle multiple channels — push, email, SMS — at potentially 10K/sec during campaigns, while guaranteeing transactional notifications like OTPs are never lost._
>
> _Core design: event-driven. Order Service publishes an `order.shipped` event to EventBridge. Based on priority, it routes to either a high-priority SQS queue (transactional) or a marketing SQS queue. A dispatcher Lambda checks user preferences, respects opt-outs, renders the template, and fans out to channel-specific queues (push, email, SMS queues). Each channel has its own Lambda worker connecting to APNs, SES, or SNS SMS._
>
> _Key decisions: separate queues per priority — a marketing blast (10K/sec) must never delay OTP delivery. Idempotency: check notification_id in DynamoDB before sending to handle at-least-once SQS delivery. DLQ per channel to isolate failures. SES bounce webhooks to mark invalid emails."_

---

### Common Interview Questions

**Q1: How do you handle users with multiple devices (push notifications)?**

> Store all device tokens per user in DynamoDB as a list. When sending a push notification, loop through all tokens for the user and send to each. APNs/FCM return errors for invalid/expired tokens (device unregistered, app uninstalled). On each of these errors, remove the stale token from the user's token list in DynamoDB. For efficiency: batch send to multiple tokens using FCM's `sendMulticast` API — one request, up to 500 tokens.

**Q2: How do you prevent sending the same notification twice?**

> Idempotency key: every notification event has a unique `notification_id` (UUID). Before sending, check DynamoDB: `GetItem(notification_id)`. If it exists and status is `sent` — skip. If it doesn't exist — proceed and atomically write the record with a conditional write. Use DynamoDB conditional expression: `attribute_not_exists(notification_id)`. If the write fails (another Lambda instance already processed it) — skip. This handles the SQS at-least-once delivery guarantee without duplicate sends.

**Q3: How do you handle timezone-based scheduling (send marketing notifications at 10am user local time)?**

> Store user timezone in preferences. When a marketing campaign is created with a send time (e.g., "10am local"), compute the UTC send time per timezone group. Schedule separate EventBridge Scheduled Rules or Step Functions waits for each timezone group. Alternative: store `scheduled_send_at` (UTC) on each notification record in DynamoDB. A scheduled Lambda runs every minute, queries DynamoDB GSI for notifications where `scheduled_send_at <= now AND status = pending`, and enqueues them to SQS for processing. Use DynamoDB TTL on the record to auto-expire unprocessed future notifications.

---

> **Next Topic →** [04 · Chat System](./04-chat-system.md)
