# Dead Letter Queue (SQS DLQ)

> **Subject**: System Design · **Group**: 🔥 Reliability & Failure (MUST) · **Topic**: 04 of 05
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

A **Dead Letter Queue (DLQ)** is a secondary queue where messages are moved after a configured number of failed processing attempts. Instead of messages being lost or blocking the main queue forever, they're isolated in the DLQ for investigation and reprocessing.

Think of it as the **"quarantine zone"** for problematic messages.

---

### 2. Why is it needed?

| Without DLQ                                      | With DLQ                                        |
| ------------------------------------------------ | ----------------------------------------------- |
| Bad message loops forever in queue (poison pill) | After N retries, message moved to DLQ           |
| Failed messages invisible — never investigated   | DLQ contains all failures for investigation     |
| One bad message can block entire queue (FIFO)    | Main queue unblocked; DLQ holds the bad message |
| Data loss on retry exhaustion                    | Messages preserved in DLQ, never lost           |

---

### 3. Where is it used?

| Use Case                      | Why DLQ                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| **Order processing failures** | Failed orders land in DLQ → human review → reprocess or refund |
| **Payment webhook retries**   | Malformed webhook lands in DLQ → debug + replay                |
| **Lambda trigger failures**   | Lambda error on N attempts → DLQ → alert engineering           |

---

### 4. How Does it Work?

```
NORMAL FLOW:
  Producer → [Main Queue (SQS)] → [Consumer (Lambda/EC2)]
                                  → SUCCESS: delete message ✅

FAILURE FLOW:
  Producer → [Main Queue] → [Consumer]
                            → FAILURE (exception thrown)
                            → Message becomes visible again (visibility timeout)
                            → Consumer retries (maxReceiveCount = 3)
                            → After 3rd failure:
                              Message moved to [DLQ] ✅

  Main Queue: normal messages continue processing
  DLQ: bad message isolated, never lost

SQS DLQ Configuration:
  Main Queue → Redrive Policy:
    deadLetterTargetArn: arn:aws:sqs:us-east-1:123:my-dlq
    maxReceiveCount: 3  ← after 3 failures, move to DLQ

  DLQ retention: 14 days (maximum; default 4 days)
  Alarm: CloudWatch alarm when DLQ depth > 0
```

---

### 5. Types / Variations

| Type                | Used With                  | Notes                                                            |
| ------------------- | -------------------------- | ---------------------------------------------------------------- |
| **SQS DLQ**         | SQS Standard + FIFO queues | Most common; AWS-managed                                         |
| **SNS DLQ**         | SNS subscriptions          | Failed delivery to subscriber → DLQ                              |
| **Lambda DLQ**      | Async Lambda invocations   | Lambda errors after retries → DLQ                                |
| **EventBridge DLQ** | Failed event routing       | Events that fail to reach target                                 |
| **Kafka**           | No native DLQ              | Pattern: write failed messages to a `<topic>-dlq` topic manually |

---

## PART 2

---

### 6. Trade-offs

#### ✅ Pros

| Advantage             | Detail                              |
| --------------------- | ----------------------------------- |
| Poison pill isolation | Bad messages don't block the queue  |
| Zero message loss     | Failed messages preserved for later |
| Debugging surface     | All failures in one place           |
| Reprocessing possible | Fix the bug → replay DLQ messages   |

#### ❌ Cons / Pitfalls

| Disadvantage                               | Detail                                         |
| ------------------------------------------ | ---------------------------------------------- | -------------------------------------- |
| **Silent failures without alerting**       | DLQ fills up; nobody notices                   | → Always alarm on DLQ depth > 0        |
| **DLQ also has retention limit**           | SQS max 14 days; messages deleted after expiry | → Process DLQ before retention expires |
| **Reprocessing without fixing root cause** | Same messages fail again                       | → Fix bug first, then replay           |
| **Large DLQ backlog**                      | Reprocessing may overwhelm main queue          | → Rate-limit DLQ replay                |

---

### 7. Failure Scenarios

| Failure                                  | DLQ Behavior                                          | Handling                                                |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| **Malformed message (parse error)**      | Fails every time → lands in DLQ after maxReceiveCount | Fix parser; replay from DLQ                             |
| **Transient DB error**                   | Fails N times → DLQ (shouldn't be here!)              | Increase maxReceiveCount; use longer visibility timeout |
| **Business logic error (order invalid)** | Correct behavior → DLQ for review                     | Human review → refund or correct order                  |
| **DLQ itself fills up**                  | DLQ at capacity → oldest messages deleted             | Alert on DLQ depth; process within retention window     |
| **DLQ not configured**                   | Message lost after maxReceiveCount                    | Always configure DLQ for any production queue           |

---

### 8. AWS Mapping

```
FULL SETUP:
─────────────────────────────────────────────────────
[SNS Topic: order-placed]
    ↓
[SQS: order-processing-queue]
  - Visibility timeout: 30s
  - Redrive policy: maxReceiveCount=3, DLQ=order-dlq

[Lambda: process-order]
  - Triggers on SQS messages
  - On exception: message becomes visible again
  - After 3 failures: moved to DLQ

[SQS: order-dlq]
  - Retention: 14 days
  - CloudWatch Alarm: depth > 0 → SNS → PagerDuty alert

[DLQ Processing (manual or automated)]:
  - Option A: Engineer reviews + manually replays after bug fix
  - Option B: Lambda reads DLQ and routes to error-handling workflow
  - Option C: AWS Lambda with DLQ trigger → alert + archive to S3

KEY METRICS TO MONITOR:
  ApproximateNumberOfMessagesNotVisible (main queue)
  ApproximateNumberOfMessagesVisible (DLQ) ← alarm here
  NumberOfMessagesSent vs NumberOfMessagesDeleted (processing rate)
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"A Dead Letter Queue is where messages go after failing processing N times. Without it, a malformed message — a 'poison pill' — loops in the queue forever, consuming consumer resources and blocking FIFO queues._
>
> _On AWS SQS, I configure a redrive policy: maxReceiveCount=3, pointing to a DLQ. After 3 failed attempts, the message moves to the DLQ automatically. I always set a CloudWatch alarm on DLQ depth greater than zero — if it fires, I know something is failing silently. After fixing the bug, I replay messages from the DLQ back to the main queue."_

---

### 10. Common Interview Questions

**Q1: What is the difference between visibility timeout and DLQ?**

> Visibility timeout is a temporary lock: when a consumer picks up a message, it becomes invisible to other consumers for N seconds. If the consumer fails to delete it within that time, it reappears for retry. DLQ is the final destination: after maxReceiveCount retries, the message is moved there permanently. Visibility timeout = retry window for one attempt. DLQ = endpoint after all retries exhausted.

**Q2: How do you replay messages from a DLQ?**

> Option 1: SQS Console "Start DLQ redrive" (AWS native feature) — moves messages back to the source queue. Option 2: Lambda reads from DLQ → validates/transforms → sends to main queue. Option 3: SQS Redrive Allow Policy + manual trigger. Always fix the root cause before replaying, or messages will just fail again and fill the DLQ.

**Q3: How do you handle a DLQ in Kafka (no native DLQ)?**

> Kafka has no built-in DLQ. The pattern: in the consumer, catch exceptions, write the failed message to a `<topic>-dlq` topic manually (with original message + error metadata), then commit the offset to continue. A separate consumer monitors the DLQ topic. Tools like Kafka Connect have built-in DLQ support for connector failures.

---

> **Next Topic →** [05 · Graceful Degradation](./05-graceful-degradation.md)
