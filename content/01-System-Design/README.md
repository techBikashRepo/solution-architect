# 📐 System Design — Topic Index

> Interview-focused, practical preparation for Senior/Principal Architect roles.

---

## 📁 01 · Fundamentals

| #   | Topic                                   | File                                                                   | Status |
| --- | --------------------------------------- | ---------------------------------------------------------------------- | ------ |
| 1   | Scalability (Vertical vs Horizontal)    | [01-scalability.md](./01-Fundamentals/01-scalability.md)               | ✅     |
| 2   | Latency vs Throughput                   | [02-latency-throughput.md](./01-Fundamentals/02-latency-throughput.md) | ⬜     |
| 3   | CAP Theorem (Practical)                 | [03-cap-theorem.md](./01-Fundamentals/03-cap-theorem.md)               | ⬜     |
| 4   | Consistency Models (Strong vs Eventual) | [04-consistency-models.md](./01-Fundamentals/04-consistency-models.md) | ⬜     |
| 5   | Load Balancing                          | [05-load-balancing.md](./01-Fundamentals/05-load-balancing.md)         | ⬜     |
| 6   | Caching (Redis + Invalidation)          | [06-caching.md](./01-Fundamentals/06-caching.md)                       | ⬜     |
| 7   | Database Basics (SQL vs NoSQL)          | [07-db-basics.md](./01-Fundamentals/07-db-basics.md)                   | ⬜     |

---

## 📁 02 · Estimation (🔥 MUST)

| #   | Topic                | File                                                                   | Status |
| --- | -------------------- | ---------------------------------------------------------------------- | ------ |
| 1   | Users → Requests/sec | [01-users-to-rps.md](./02-Estimation/01-users-to-rps.md)               | ⬜     |
| 2   | Storage Calculation  | [02-storage-calculation.md](./02-Estimation/02-storage-calculation.md) | ⬜     |
| 3   | Read vs Write Ratio  | [03-read-write-ratio.md](./02-Estimation/03-read-write-ratio.md)       | ⬜     |

---

## 📁 03 · Core Components

| #   | Topic                       | File                                                                | Status |
| --- | --------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | API Gateway                 | [01-api-gateway.md](./03-Core-Components/01-api-gateway.md)         | ⬜     |
| 2   | CDN                         | [02-cdn.md](./03-Core-Components/02-cdn.md)                         | ⬜     |
| 3   | Load Balancer               | [03-load-balancer.md](./03-Core-Components/03-load-balancer.md)     | ⬜     |
| 4   | Message Queue (Kafka + SQS) | [04-message-queue.md](./03-Core-Components/04-message-queue.md)     | ⬜     |
| 5   | Rate Limiting               | [05-rate-limiting.md](./03-Core-Components/05-rate-limiting.md)     | ⬜     |
| 6   | Circuit Breaker             | [06-circuit-breaker.md](./03-Core-Components/06-circuit-breaker.md) | ⬜     |

---

## 📁 04 · Data Layer

| #   | Topic               | File                                                     | Status |
| --- | ------------------- | -------------------------------------------------------- | ------ |
| 1   | Indexing            | [01-indexing.md](./04-Data-Layer/01-indexing.md)         | ⬜     |
| 2   | Sharding            | [02-sharding.md](./04-Data-Layer/02-sharding.md)         | ⬜     |
| 3   | Replication         | [03-replication.md](./04-Data-Layer/03-replication.md)   | ⬜     |
| 4   | Partitioning Basics | [04-partitioning.md](./04-Data-Layer/04-partitioning.md) | ⬜     |

---

## 📁 05 · Reliability & Failure (🔥 MUST)

| #   | Topic                       | File                                                                                  | Status |
| --- | --------------------------- | ------------------------------------------------------------------------------------- | ------ |
| 1   | Retry Mechanisms            | [01-retry-mechanisms.md](./05-Reliability-and-Failure/01-retry-mechanisms.md)         | ⬜     |
| 2   | Idempotency                 | [02-idempotency.md](./05-Reliability-and-Failure/02-idempotency.md)                   | ⬜     |
| 3   | Circuit Breaker (Deeper)    | [03-circuit-breaker-deep.md](./05-Reliability-and-Failure/03-circuit-breaker-deep.md) | ⬜     |
| 4   | Dead Letter Queue (SQS DLQ) | [04-dlq.md](./05-Reliability-and-Failure/04-dlq.md)                                   | ⬜     |
| 5   | Graceful Degradation        | [05-graceful-degradation.md](./05-Reliability-and-Failure/05-graceful-degradation.md) | ⬜     |

---

## 📁 06 · Design Patterns

| #   | Topic                     | File                                                                    | Status |
| --- | ------------------------- | ----------------------------------------------------------------------- | ------ |
| 1   | Event-Driven Architecture | [01-event-driven.md](./06-Design-Patterns/01-event-driven.md)           | ⬜     |
| 2   | Microservices Basics      | [02-microservices.md](./06-Design-Patterns/02-microservices.md)         | ⬜     |
| 3   | Monolith vs Microservices | [03-monolith-vs-micro.md](./06-Design-Patterns/03-monolith-vs-micro.md) | ⬜     |

---

## 📁 07 · Trade-offs (⚡ CRITICAL)

| #   | Topic                          | File                                                                     | Status |
| --- | ------------------------------ | ------------------------------------------------------------------------ | ------ |
| 1   | SQL vs NoSQL                   | [01-sql-vs-nosql.md](./07-Trade-offs/01-sql-vs-nosql.md)                 | ⬜     |
| 2   | Cache vs No Cache              | [02-cache-vs-no-cache.md](./07-Trade-offs/02-cache-vs-no-cache.md)       | ⬜     |
| 3   | Sync vs Async                  | [03-sync-vs-async.md](./07-Trade-offs/03-sync-vs-async.md)               | ⬜     |
| 4   | Strong vs Eventual Consistency | [04-consistency-tradeoff.md](./07-Trade-offs/04-consistency-tradeoff.md) | ⬜     |

---

## 📁 08 · Must Practice Designs

| #   | Topic                        | File                                                                              | Status |
| --- | ---------------------------- | --------------------------------------------------------------------------------- | ------ |
| 1   | URL Shortener                | [01-url-shortener.md](./08-Must-Practice-Designs/01-url-shortener.md)             | ⬜     |
| 2   | Rate Limiter Design          | [02-rate-limiter-design.md](./08-Must-Practice-Designs/02-rate-limiter-design.md) | ⬜     |
| 3   | Notification System          | [03-notification-system.md](./08-Must-Practice-Designs/03-notification-system.md) | ⬜     |
| 4   | Chat System                  | [04-chat-system.md](./08-Must-Practice-Designs/04-chat-system.md)                 | ⬜     |
| 5   | E-commerce Backend           | [05-ecommerce-backend.md](./08-Must-Practice-Designs/05-ecommerce-backend.md)     | ⬜     |
| 6   | File Upload System (S3 Type) | [06-file-upload.md](./08-Must-Practice-Designs/06-file-upload.md)                 | ⬜     |

---

**Legend**: ⬜ Not Started · 🔄 In Progress · ✅ Done
