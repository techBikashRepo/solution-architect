# Sync vs Async

> **Subject**: System Design · **Group**: ⚖️ Trade-offs · **Topic**: 03 of 04
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Synchronous (Sync)**: Caller waits for the response before continuing. Direct, immediate, tightly coupled.
**Asynchronous (Async)**: Caller fires a request and continues without waiting. Response comes later (callback, event, queue).

---

### 2. Side-by-Side Comparison

```
SYNCHRONOUS:
  Client → [API Call] → Server processes → [Response] → Client continues

  - Client blocked during processing
  - Immediate feedback: success or error
  - Tight coupling: if server is slow/down, client suffers
  - Example: REST API, gRPC, database query

ASYNCHRONOUS:
  Client → [Message to Queue] → Client continues (no waiting)
                    ↓
              Worker picks up message
              Worker processes (may take seconds/minutes)
              Worker sends result (webhook, separate API call, event)

  - Client unblocked immediately
  - No immediate feedback on processing outcome
  - Loose coupling: worker can be down; message waits
  - Example: SQS, SNS, Kafka, email sending
```

---

### 3. Decision Framework

```
USE SYNC WHEN:
  ✅ Caller needs immediate result to continue
     (e.g., check if username is available before creating account)
  ✅ Short, bounded processing time (<2s)
  ✅ Simple request/response flow
  ✅ Error must be returned to caller immediately
  ✅ User is waiting at a screen for the result

USE ASYNC WHEN:
  ✅ Processing takes longer than acceptable user wait time
     (e.g., video encoding, report generation)
  ✅ Result can be delivered separately (email, notification)
  ✅ High write throughput needed (queue absorbs spikes)
  ✅ Multiple consumers need the same event
  ✅ Caller and worker need to scale independently
  ✅ Retry/reliability more important than immediacy
```

---

### 4. Real-World Examples

| Scenario                         | Sync or Async?                                         | Reason                                                      |
| -------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| User login                       | Sync                                                   | Must know immediately if credentials are valid              |
| Sending order confirmation email | Async                                                  | Email can be sent after order creation completes            |
| Payment processing               | Sync (initial charge) + Async (downstream effects)     | User needs immediate charge result; notifications are async |
| Video upload encoding            | Async                                                  | Encoding takes minutes; user gets notified when done        |
| Product search                   | Sync                                                   | User waits at search box for results                        |
| Inventory update after order     | Async                                                  | Order API doesn't need to wait for inventory update         |
| Fraud detection                  | Async (high-risk flagging) or Sync (block immediately) | Depends on tolerance for fraud                              |

---

### 5. Patterns

| Pattern               | Description                            | AWS Implementation                   |
| --------------------- | -------------------------------------- | ------------------------------------ |
| **Request/Response**  | Classic sync; wait for reply           | REST API → Lambda / ECS              |
| **Publish/Subscribe** | Async; fanout to multiple consumers    | SNS → SQS → consumers                |
| **Command Queue**     | Async; one producer, one consumer      | SQS FIFO → Lambda                    |
| **Callback/Webhook**  | Async; server calls back to client URL | Lambda → HTTP POST to client webhook |
| **Polling**           | Client periodically checks status      | Client → GET /jobs/{id}/status       |
| **Long Polling**      | Client holds open request until ready  | API Gateway → Lambda waits           |
| **WebSocket**         | Persistent bidirectional connection    | API Gateway WebSocket + Lambda       |

---

## PART 2

---

### 6. Trade-offs

| Dimension            | Sync                               | Async                                      |
| -------------------- | ---------------------------------- | ------------------------------------------ |
| **Latency**          | Immediate response                 | Response delayed by queue processing       |
| **Coupling**         | Tight (caller + callee must be up) | Loose (callee can be down; messages queue) |
| **Throughput**       | Limited by slowest component       | Queue absorbs spikes; independent scaling  |
| **Failure handling** | Immediate error to caller          | DLQ, retry, eventual processing            |
| **Consistency**      | Strong (immediate result)          | Eventual (processing takes time)           |
| **UX**               | Immediate feedback                 | Must show pending state; notify later      |
| **Debugging**        | Easy (linear call stack)           | Hard (distributed, asynchronous trace)     |

---

### 7. Failure Scenarios

| Failure                       | Sync Impact                   | Async Impact                                       |
| ----------------------------- | ----------------------------- | -------------------------------------------------- |
| **Downstream service down**   | Client gets error immediately | Message queues up; processed when service recovers |
| **Spike in traffic**          | DB overwhelmed; timeouts      | SQS absorbs spike; workers process at their rate   |
| **Processing takes too long** | Client timeout (30s+)         | Client long-polled or notified asynchronously      |
| **Message processing fails**  | N/A                           | DLQ captures failure; retried or investigated      |
| **Network partition**         | Request fails                 | Message preserved in queue; eventually delivered   |

---

### 8. AWS Mapping

```
HYBRID PATTERN — SYNC for user response, ASYNC for downstream effects:
─────────────────────────────────────────────────────────

[Mobile App]
    ↓ Sync POST /orders
[API Gateway + Lambda: create-order]
    → Write order to RDS (sync)
    → Return order confirmation to user immediately ✅
    → Publish event to SNS: order.created (fire and forget)
        ↓ async
    [SQS: inventory-queue]     → Lambda: update-inventory
    [SQS: payment-queue]       → Lambda: process-payment
    [SQS: notification-queue]  → Lambda: send-email-confirmation

RESULT:
  User gets response in <500ms
  Inventory, payment, email handled asynchronously
  User notified by email when payment completes

LONG POLLING (async job status):
  POST /reports → return jobId immediately
  GET /reports/{jobId} → Lambda checks DynamoDB for status
    PENDING: return 202 (still processing)
    DONE: return 200 + presigned S3 URL to download
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"Sync communication is when the caller waits for an immediate response — use it when the user is waiting and needs the result to continue. Async is when the caller fires a request and moves on — use it when processing takes too long, or when multiple downstream systems need to react to an event._
>
> _In practice, I use a hybrid pattern: the critical path is sync (user gets an immediate order confirmation), but downstream effects are async (inventory update, payment processing, email) via SNS/SQS. This gives the user a fast response while still reliably completing all effects, with DLQ handling any processing failures."_

---

### 10. Common Interview Questions

**Q1: How do you notify a user when an async job completes?**

> Four options by complexity: (1) Polling: client calls `GET /jobs/{id}` every 5 seconds — simple but wasteful. (2) Long Polling: client holds request open; server responds when done or after 30s. (3) WebSocket: bidirectional persistent connection; server pushes notification the moment it's done — best UX, more infrastructure. (4) Push Notification / Email: backend sends email/push when done — simplest; user may not be waiting at screen. On AWS: WebSocket via API Gateway + Lambda + DynamoDB for connection tracking. For mobile: SNS push notification to APNs/FCM.

**Q2: How do you guarantee message ordering in async systems?**

> SQS Standard: no ordering guarantee, at-least-once delivery. SQS FIFO: strict ordering within a message group, exactly-once processing, 3,000 msg/sec per queue (higher with batching). Trade-off: FIFO has lower throughput. Use FIFO when order matters (financial events, sequential workflow steps). Use Standard when order doesn't matter and you need maximum throughput (analytics events, logs). For Kafka: ordering guaranteed within a partition. Design your partition key so all messages requiring order go to the same partition.

**Q3: What happens if a consumer crashes while processing a message?**

> In SQS: the message has a visibility timeout. When a consumer picks up a message, it becomes invisible to others for N seconds. If the consumer crashes before deleting the message, the visibility timeout expires and the message becomes visible again for retry. After maxReceiveCount retries (e.g., 3), the message moves to the DLQ. This ensures at-least-once delivery: messages are never lost, but may be processed more than once. Therefore: consumers must be idempotent — processing the same message twice must produce the same result (use idempotency keys).

---

> **Next Topic →** [04 · Consistency Trade-off](./04-consistency-tradeoff.md)
