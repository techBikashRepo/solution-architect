# SNS — Amazon Simple Notification Service

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 10 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon SNS** is a fully managed pub/sub messaging service. Publishers send a message to a **Topic**; SNS immediately **pushes** that message to ALL subscribers. This is the fan-out pattern — one event, many consumers.

Think of SNS as: a **broadcast megaphone** — everyone subscribed hears the message at the same time.

---

### 2. Key Concepts

| Concept               | Detail                                                          |
| --------------------- | --------------------------------------------------------------- |
| **Topic**             | Named message channel; publishers send to it                    |
| **Publisher**         | Sends a message to a topic                                      |
| **Subscriber**        | Endpoint that receives messages from a topic                    |
| **Subscription**      | Links a topic to a specific endpoint                            |
| **Message Filtering** | Subscribers receive only matching messages (by attribute)       |
| **Fan-out**           | One SNS message → multiple SQS queues / Lambda / HTTP endpoints |

**Supported subscriber types**:

- SQS (most common for reliability)
- Lambda (direct invocation)
- HTTP/HTTPS endpoint (webhooks)
- Email / Email-JSON
- SMS (text message)
- Mobile push (FCM, APNS)
- Kinesis Data Firehose

---

### 3. SNS vs SQS vs EventBridge

| Dimension     | SNS                          | SQS                            | EventBridge                  |
| ------------- | ---------------------------- | ------------------------------ | ---------------------------- |
| **Pattern**   | Pub/Sub (push)               | Queue (pull)                   | Event bus (route)            |
| **Delivery**  | Immediate push               | Consumer polls                 | Rule-based                   |
| **Retention** | None (or SQS for durability) | Up to 14 days                  | Archive optional             |
| **Fan-out**   | Built-in (all subscribers)   | No (one message, one consumer) | Rules per target             |
| **Filtering** | Message attributes           | No built-in                    | Rich event patterns          |
| **Best for**  | Notifications, fan-out       | Async buffering, backpressure  | Cross-account, SaaS, routing |

---

### 4. Message Filtering

```
WITHOUT FILTERING:
  Order service publishes ALL order events to topic
  Payment service subscriber: receives ALL events (most irrelevant)
  Shipping service subscriber: receives ALL events (most irrelevant)
  Problem: unnecessary processing, lambda invocations, cost

WITH SNS MESSAGE FILTERING:
  Publisher sends message with attributes:
    event_type: "ORDER_PLACED"
    order_value: 250
    region: "US"

  Subscription filter policies:
    Payment Service:
      {"event_type": ["ORDER_PLACED", "ORDER_REFUNDED"]}
      → receives only payment-relevant events

    Shipping Service:
      {"event_type": ["ORDER_CONFIRMED"]}
      → receives only confirmed orders

    Premium Service:
      {"order_value": [{"numeric": [">=", 200]}], "region": ["US"]}
      → receives only high-value US orders

Benefits:
  - Subscribers receive only relevant events (cost, performance)
  - No code change needed to add new subscribers
  - Logic is declarative in the subscription, not in publisher code
```

---

### 5. SNS FIFO Topics

```
FIFO TOPIC:
  Name must end in .fifo
  Strict ordering by MessageGroupId
  Deduplication within 5-minute window
  Subscribers: ONLY SQS FIFO queues
  Throughput: 300 msg/sec (3,000 with batching)

  Use when: fan-out AND ordering required
  Example: stock price updates → multiple trading systems must see same order

STANDARD TOPIC:
  No ordering guarantee
  At-least-once delivery
  Subscribers: SQS, Lambda, HTTP, email, SMS, mobile push
  Throughput: nearly unlimited

  Use for 99% of use cases
```

---

## PART 2

---

### 6. SNS + SQS Fan-Out (Most Common Pattern)

```
WHY SNS + SQS (not SNS directly to Lambda):
  Problem with SNS → Lambda directly:
    If Lambda has a bug or is slow, SNS retries but eventually drops the message
    No backpressure; SNS pushes regardless of Lambda capacity

  SNS → SQS → Lambda:
    SQS is the durable buffer:
      ✅ Message retained for up to 14 days
      ✅ Retry with DLQ if Lambda fails
      ✅ Lambda scales based on queue depth
      ✅ Each consumer queue is independent

FAN-OUT ARCHITECTURE:
─────────────────────────────────────────────────────────
  [Order Service]
      ↓ Publish("ORDER_PLACED", {orderId, userId, amount})
  [SNS: order-events-topic]
      ├── SQS: payment-queue → Lambda: process-payment
      ├── SQS: inventory-queue → Lambda: reserve-inventory
      ├── SQS: notification-queue → Lambda: send-confirmation-email
      └── SQS: analytics-queue → Lambda: write-to-data-warehouse

ISOLATION:
  If analytics Lambda is broken → only analytics-queue fills up
  Payment, inventory, notification: completely unaffected
  No tight coupling between downstream systems
```

---

### 7. Retry and Delivery Guarantees

```
SNS DELIVERY ATTEMPTS:
  HTTP/S endpoints: 3 retries immediately, then backoff up to 23x over 23 days
  SQS: SQS guarantees delivery (at-least-once); SNS to SQS is very reliable
  Lambda: 2-3 retries by SNS; then Lambda DLQ if configured
  Email/SMS: best-effort (no guaranteed delivery)

SNS DEAD LETTER QUEUE:
  Configure a DLQ (SQS) on the SNS subscription
  If SNS can't deliver to a subscriber after retries → message goes to DLQ
  Monitor DLQ depth in CloudWatch → alert if > 0

MESSAGE DURABILITY:
  SNS itself does NOT store messages (no retention)
  If subscriber is down at publish time and subscription has no DLQ: message LOST
  Fix: always use SNS → SQS (SQS stores messages up to 14 days)

```

---

### 8. AWS Architecture Example

```
E-COMMERCE EVENT BUS WITH SNS:
─────────────────────────────────────────────────────────
  Events published to SNS:
    order-events (standard topic)
    payment-events (FIFO topic — ordering matters for financial)

  order-events subscribers:
    SQS: fulfillment-queue (filter: event_type = ORDER_CONFIRMED)
      → ECS: fulfillment-service
    SQS: email-queue (filter: event_type = ORDER_PLACED OR ORDER_SHIPPED)
      → Lambda: send-email (SES)
    SQS: fraud-queue (filter: amount >= 500)
      → Lambda: fraud-check
    Kinesis Firehose: → S3 data lake (all events, no filter)

  CloudWatch ALARM:
    Metric: NumberOfNotificationsFailed > 0
    Alert: delivery failures → investigate subscriber health

CROSS-ACCOUNT SNS:
  Team A account: publishes to SNS topic
  Team B account: subscribes SQS queue (cross-account policy)
  Use case: centralized event bus without EventBridge cost
  Requirement: SQS queue policy allows SNS to send messages
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"SNS is a pub/sub service — publish once, push to many. The canonical pattern is SNS fan-out: an Order service publishes to an SNS topic, and SQS queues for Payment, Inventory, Notifications, and Analytics all subscribe. Each downstream system is fully decoupled and independently scalable._
>
> _Message filtering is key: each subscriber declares a filter policy (e.g., only ORDER_CONFIRMED events), so they only receive relevant events — no unnecessary Lambda invocations._
>
> _SNS alone has no message retention — always use SNS → SQS for durability. If a subscriber is down, SQS holds the message for up to 14 days."_

---

### 10. Common Interview Questions

**Q1: When would you use SNS vs EventBridge?**

> SNS: simple pub/sub fan-out. Low cost, high throughput (~millions/sec), easy setup. Best when you control all publishers and subscribers, need maximum throughput, or want simple fan-out to SQS/Lambda/Email/SMS. EventBridge: event bus with rich routing rules, schema registry, and cross-account/cross-region delivery. Best when events come from third-party SaaS (Shopify, Zendesk — EventBridge partners), need event archiving and replay, want to build a true event bus with many sources and targets with complex routing, or need to react to AWS service events (e.g., EC2 state changes, GuardDuty findings). EventBridge is more powerful but higher latency and cost per event. SNS is simpler and faster for straightforward fan-out.

**Q2: Why use SNS → SQS instead of SNS directly to Lambda?**

> Reliability and backpressure. With SNS → Lambda directly: if Lambda is throttled, SNS retries briefly then drops the message. No buffer, no backpressure — if you have a spike of 100K events, Lambda might not scale fast enough and messages are lost. SNS → SQS → Lambda: SQS buffers all messages (retained up to 14 days). Lambda event source mapping polls and scales based on queue depth (up to 1,000 concurrent). If Lambda has a bug, messages stay in SQS — you can fix the bug and messages are still there. DLQ handles poison pills. Each subscriber queue is isolated: one slow consumer doesn't affect others. The small latency cost (SQS poll interval) is worth the reliability guarantee.

**Q3: How does SNS message filtering reduce cost?**

> Without filtering: every subscriber receives every message. If an SNS topic receives 1 million events/day and has 5 subscribers, all 5 receive all 1M messages → 5M Lambda invocations or SQS messages, most of which are irrelevant. With filtering: each subscription has a policy (e.g., only `event_type = ORDER_SHIPPED`). SNS evaluates the filter before delivery — irrelevant messages are discarded at the SNS layer. If each subscriber is relevant for only 20% of events: 5 subscribers × 200K relevant messages = 1M total (vs 5M without filtering). Result: 80% fewer SQS messages, Lambda invocations, and processing costs. Filtering is declared in the subscription — no code changes needed, and new subscribers can subscribe to subsets without changing the publisher.

---

> **Next Topic →** [11 · IAM](./11-iam.md)
