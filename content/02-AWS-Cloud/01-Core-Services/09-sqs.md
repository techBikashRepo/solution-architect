# SQS — Amazon Simple Queue Service

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 09 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon SQS** is a fully managed message queue service. Producers send messages to the queue; consumers poll and process them. The queue decouples producers from consumers, absorbing traffic spikes and enabling reliable async processing.

Think of SQS as: a **durable buffer** between services — producers never wait for consumers.

---

### 2. Key Concepts

| Concept                     | Detail                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| **Queue**                   | Ordered or unordered message buffer                                    |
| **Message**                 | Up to 256KB; body + attributes                                         |
| **Visibility Timeout**      | Time a message is invisible after a consumer picks it up (default 30s) |
| **Message Retention**       | How long unprocessed messages stay (1 min – 14 days; default 4 days)   |
| **Dead Letter Queue (DLQ)** | Receives messages that fail processing after maxReceiveCount           |
| **Long Polling**            | Consumer waits up to 20s for a message (reduces empty API calls)       |
| **Delay Queue**             | Messages hidden from consumers for N seconds after being added         |
| **In-Flight Messages**      | Messages picked up but not yet deleted                                 |

---

### 3. Standard vs FIFO Queue

| Dimension         | Standard Queue                          | FIFO Queue                                     |
| ----------------- | --------------------------------------- | ---------------------------------------------- |
| **Ordering**      | Best-effort (not guaranteed)            | Strict FIFO within message group               |
| **Delivery**      | At-least-once (can deliver twice)       | Exactly-once processing                        |
| **Throughput**    | Nearly unlimited                        | 3,000 msg/sec (batching); 300 msg/sec (single) |
| **Use case**      | High throughput, order doesn't matter   | Financial transactions, order processing       |
| **Deduplication** | No built-in (consumer must deduplicate) | 5-minute deduplication window                  |
| **Naming**        | `my-queue`                              | `my-queue.fifo` (must end in .fifo)            |

---

### 4. Visibility Timeout

```
VISIBILITY TIMEOUT FLOW:
─────────────────────────────────────────────────────────
  [Queue: message M]
  Consumer A: ReceiveMessage → message M becomes invisible (30s)
                                                   ↓
  Consumer A processes M:
    SUCCESS: DeleteMessage → message gone ✅
    FAILURE (exception): timeout expires → message REAPPEARS in queue
    SLOW (>30s): timeout expires → another consumer picks up M ← DUPLICATE

SETTING VISIBILITY TIMEOUT:
  Set to: max expected processing time × 1.5

  Processing takes up to 60s → set visibility timeout to 90s

  Consumer can extend: ChangeMessageVisibility(receipt, new_timeout)
  Useful for long-running jobs: extend every 30s while processing

IMPORTANT: visibility timeout protects against consumer failure.
           It is NOT a retry mechanism — it's just the re-queue after crash.
```

---

### 5. SQS + Lambda Integration

```
SQS → Lambda:
  Lambda polls SQS (event source mapping)
  Batch size: 1-10,000 messages per Lambda invocation
  Lambda processes batch → must delete successfully processed messages

  PARTIAL FAILURES (batch):
    Lambda processes 10 messages; 8 succeed, 2 fail
    Default: all 10 messages return to queue (wasteful!)

    SOLUTION: ReportBatchItemFailures
      Lambda returns list of failed message IDs
      Only failed messages return to queue
      Successful messages auto-deleted

  SCALING:
    SQS triggers Lambda concurrency scaling:
    Queue depth > 0 → Lambda scales up to 5 concurrent instances per minute
    60 concurrent Lambda instances = queue draining at 60× batch rate

SNS → SQS → Lambda (fan-out pattern):
  SNS Topic fans out to multiple SQS queues
  Each queue has its own Lambda consumer
  Benefits: isolation (one queue failure doesn't affect others), independent scaling
```

---

## PART 2

---

### 6. When to Use SQS

✅ **Use SQS when**:

- Decouple producer and consumer (producer doesn't wait)
- Absorb traffic spikes (SQS buffers; consumers process at their rate)
- Reliable at-least-once delivery with DLQ for failures
- Multiple consumer instances processing from the same queue
- Workflow steps where each step can fail and retry independently

❌ **Don't use SQS when**:

- Fan-out (one event to many consumers) → use **SNS** (publish to all) then SQS per consumer
- Real-time streaming / event processing → use **Kinesis**
- Exactly-once at massive throughput → **Kinesis** or **MSK (Kafka)**
- Broadcasting (all consumers see ALL messages) → **SNS** or **EventBridge**

---

### 7. SQS vs SNS vs EventBridge

| Service         | Pattern           | Use Case                                       |
| --------------- | ----------------- | ---------------------------------------------- |
| **SQS**         | Queue (pull)      | Async processing; one consumer per message     |
| **SNS**         | Pub/Sub (push)    | Fan-out; immediate push to all subscribers     |
| **EventBridge** | Event bus (route) | Rule-based routing, cross-account, SaaS events |
| **SNS → SQS**   | Fan-out + queue   | Fan-out with per-consumer queuing and retry    |

---

### 8. AWS Architecture Example

```
ORDER PROCESSING WITH SQS:
─────────────────────────────────────────────────────────
  [Order Service]
      ↓ SendMessage
  [SQS: order-queue] (FIFO for payment ordering)
      ↓ Event Source Mapping
  [Lambda: process-order]
      → Payment API (Stripe)
      → Update DynamoDB
      → On success: delete message
      → On failure: message becomes visible again (retry)

  [SQS: order-dlq] (maxReceiveCount=3)
      → CloudWatch Alarm: depth > 0
      → SNS → PagerDuty alert
      → Lambda: dlq-handler → log + human review

SPIKE ABSORPTION:
  Flash sale: 50,000 orders in 1 minute
  Order Service writes all 50K messages to SQS instantly (no backpressure)
  Lambda consumers process at their max rate (e.g., 500 orders/min)
  Queue drains over the next ~100 minutes
  Customer gets: "Order received, processing" → email when done

  Without SQS: DB overwhelmed by 50K concurrent writes → crash

LONG POLLING CONFIGURATION:
  ReceiveMessage: WaitTimeSeconds=20 (long polling)
  Benefit: instead of 100 empty poll responses/sec, wait 20s for a message
  Cost reduction: up to 90% fewer API calls when queue is low-traffic
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"SQS is a managed message queue for async decoupling. Producers write to the queue and immediately return — they don't wait for consumers. This absorbs traffic spikes (50K orders/min → queue buffers them; consumers process at their rate) and isolates failures (if the payment processor is slow, orders queue up and process when it recovers)._
>
> _Key concepts: visibility timeout (message is invisible while being processed; returns to queue if consumer crashes), DLQ (after 3 failed attempts, message moved to dead letter queue for investigation), and at-least-once delivery (consumer must be idempotent)._
>
> _Standard queue for maximum throughput; FIFO queue for strict ordering and exactly-once processing."_

---

### 10. Common Interview Questions

**Q1: SQS standard vs FIFO — when would you use each?**

> Standard: unlimited throughput, at-least-once delivery, best-effort ordering. Use for: image processing, log ingestion, notification sending — order doesn't matter, occasional duplicate is handled by idempotent consumers. FIFO: strict ordering, exactly-once, 3,000 msg/sec max. Use for: financial transactions (debit then credit must be in order), order state machine (PLACED → CONFIRMED must not reverse), any sequence-dependent workflow. Cost: FIFO is ~10% more expensive. Default to Standard unless ordering or exactly-once semantics are required.

**Q2: How does visibility timeout prevent duplicate processing?**

> It doesn't guarantee no duplicates — it minimizes the window. When consumer A picks up a message, it becomes invisible for the visibility timeout period. If consumer A deletes it within the timeout, it's gone. If consumer A crashes or takes too long, the timeout expires and the message reappears — another consumer (or the recovered consumer) can pick it up again. This means the same message can be processed twice. Solution: design consumers to be idempotent (processing the same message twice = same result as once). Use an idempotency key (message ID) stored in DynamoDB — if already processed, skip. FIFO queues with `MessageDeduplicationId` provide exactly-once within a 5-minute window.

**Q3: How do you maximize SQS throughput?**

> Multiple strategies: (1) Increase consumer concurrency — Lambda auto-scales; ECS: increase task count. (2) Batch processing — receive up to 10 messages per poll call; delete in batch (10 at a time). (3) Use SendMessageBatch — send up to 10 messages per API call (10× fewer API calls). (4) Long polling — WaitTimeSeconds=20 reduces empty poll overhead, freeing API budget for real messages. (5) For Standard queues: scale to many consumers — no per-consumer bottleneck. Standard SQS handles millions of messages/sec total. (6) FIFO throughput: use multiple `MessageGroupId` values — each group has its own ordered queue, and groups process in parallel.

---

> **Next Topic →** [10 · SNS](./10-sns.md)
