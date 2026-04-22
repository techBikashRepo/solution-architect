# Scalability (Vertical vs Horizontal)

> **Subject**: System Design · **Group**: Fundamentals · **Topic**: 01 of 07
> **Status**: ✅ Done

---

## ⏸️ PART 1 of 2

---

### 1. What is it?

Scalability is a system's ability to **handle increasing load** without degrading performance.
There are two core strategies: **Vertical** (give one machine more power) and **Horizontal** (add more machines).
Modern distributed systems almost always prefer horizontal scaling due to cloud elasticity and cost efficiency.

---

### 2. Why is it needed?

| Situation                            | What happens without scalability |
| ------------------------------------ | -------------------------------- |
| Traffic spike (sale day, viral post) | System crashes or times out      |
| Growing user base                    | Response time degrades over time |
| Peak hours (Netflix evening)         | Queues pile up, users churn      |

Bottom line: **your system must grow with demand, or it becomes the bottleneck**.

---

### 3. Where is it used? (3 Real-World Use Cases)

| Use Case                          | Problem                                 | Scaling Applied                     |
| --------------------------------- | --------------------------------------- | ----------------------------------- |
| **Amazon during Big Billion Day** | 100x traffic spike in minutes           | Horizontal auto-scaling (EC2 ASG)   |
| **Twitter celebrity post**        | Sudden fan-out to millions of timelines | Horizontal read replicas + cache    |
| **Netflix at 9 PM**               | Predictable prime-time surge            | Pre-warmed horizontal scaling + CDN |

---

### 4. How Does it Work? (High-Level)

```
VERTICAL SCALING (Scale Up)
────────────────────────────
  [Small EC2: 2 CPU, 4GB]  →  [Large EC2: 32 CPU, 128GB]
  ✅ Simple (no code change)
  ❌ Has a hardware ceiling
  ❌ Downtime required to resize


HORIZONTAL SCALING (Scale Out)
────────────────────────────────
          ┌─────────────┐
          │ Load Balancer│
          └──────┬───────┘
       ┌─────────┼─────────┐
    [Server1] [Server2] [Server3]  ← add more as traffic grows
  ✅ Theoretically unlimited
  ✅ No single point of failure
  ❌ Requires stateless services (no session stored on server)
  ❌ More complex (distributed state, coordination)
```

**Key enablers for horizontal scaling:**

- **Stateless services** → session stored in Redis, not on server
- **Load balancer** → distributes requests across instances
- **Shared cache (Redis/Memcached)** → all nodes read the same data
- **DB replication** → read replicas handle read-heavy load

---

### 5. Types / Variations

| Type                       | Description                     | Best For                | Limit                                     |
| -------------------------- | ------------------------------- | ----------------------- | ----------------------------------------- |
| **Vertical (Scale Up)**    | Bigger CPU/RAM on same machine  | Simple apps, legacy DBs | Hardware ceiling (~96–128 vCPUs on cloud) |
| **Horizontal (Scale Out)** | More instances behind LB        | Stateless web/API tiers | Theoretically unlimited                   |
| **Diagonal**               | Vertical first, then horizontal | Practical hybrid        | Cloud budget                              |
| **DB Read Replicas**       | Horizontal for reads only       | Read-heavy workloads    | Replication lag                           |
| **Sharding**               | Horizontal for data storage     | Write-heavy large DBs   | Complexity                                |

---

> ✅ **PART 1 COMPLETE**

---

## PART 2 of 2

---

### 6. Trade-offs

#### ✅ Pros

| Advantage                            | Detail                                            |
| ------------------------------------ | ------------------------------------------------- |
| **Vertical** is operationally simple | No code changes, no distributed complexity        |
| **Horizontal** has no ceiling        | Add/remove instances on demand (cloud elasticity) |
| **Horizontal** = high availability   | No single point of failure; survive instance loss |
| **Horizontal** = cost-efficient      | Use smaller cheaper instances × N                 |

#### ❌ Cons

| Disadvantage                                    | Detail                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| **Vertical** has a hard limit                   | Largest EC2 instance today: ~448 vCPUs (u-24tb1.metal) — still finite |
| **Vertical** causes downtime                    | Resizing requires restart in most cases                               |
| **Horizontal** demands statelessness            | Sessions, local cache, file storage — all must move out               |
| **Horizontal** increases operational complexity | Service discovery, distributed tracing, coordination overhead         |

#### 🚫 When NOT to use Horizontal Scaling

- **Legacy monoliths with shared local state** → application must be refactored first
- **Low-traffic internal tools** → over-engineering kills simplicity
- **Heavy stateful databases** → you shard, not scale out; wrong tool for writes

---

### 7. Failure Scenarios

| Failure                                   | What Happens                                | How to Handle                                                              |
| ----------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| **One node crashes** (horizontal)         | Load balancer detects via health check      | Route traffic to healthy nodes; auto-replace failed node                   |
| **Vertical box runs out of CPU/RAM**      | Requests queue up, latency spikes, timeouts | Pre-emptive monitoring + alarm → vertical upgrade or migrate to horizontal |
| **Load balancer becomes bottleneck**      | Single LB is now the new ceiling            | Use multiple LBs (AWS ALB is auto-scaled by AWS)                           |
| **Session data lost on instance failure** | Users get logged out                        | Externalize session to Redis/DynamoDB                                      |
| **Thundering herd after scale-in**        | New instances get hammered before warm-up   | Use connection draining + warm-up policies in ASG                          |
| **Uneven load distribution**              | One node hot, others idle                   | Consistent hashing OR sticky session-aware LB rules                        |

---

### 8. AWS Mapping

| Concept                   | AWS Service                        | How                                                    |
| ------------------------- | ---------------------------------- | ------------------------------------------------------ |
| **Vertical Scaling**      | EC2 instance resize                | Stop → change instance type → start                    |
| **Horizontal Scaling**    | EC2 Auto Scaling Group (ASG)       | Scale-out policy (CPU > 70%) adds instances            |
| **Load Balancing**        | ALB (Application Load Balancer)    | Distributes HTTP/HTTPS across EC2/ECS targets          |
| **Stateless sessions**    | ElastiCache (Redis)                | All instances read/write session from shared Redis     |
| **DB Read Replicas**      | RDS Read Replica                   | Horizontal read scaling for MySQL/PostgreSQL           |
| **DB Write Scaling**      | DynamoDB                           | Horizontally partitioned by design, serverless         |
| **Serverless Horizontal** | AWS Lambda                         | Scales to 1000s of concurrent executions automatically |
| **Container Scaling**     | ECS Fargate + Service Auto Scaling | Scale task count based on CPU/memory/SQS depth         |

**Typical AWS Horizontal Scale-Out Flow:**

```
CloudWatch Alarm (CPU > 70%)
  → ASG triggers scale-out
    → New EC2 spins up (~30–60 sec)
      → ALB health check passes
        → Traffic routed to new instance
          → CloudWatch Alarm clears
```

---

### 9. Interview-Ready Explanation (30–45 sec)

> _"Scalability is the system's ability to handle growing load. We have two strategies: vertical — giving a single machine more resources, simple but has a hard hardware ceiling; and horizontal — adding more machines behind a load balancer, which is theoretically unlimited and more fault-tolerant._
>
> _In practice, for modern systems we prefer horizontal scaling because cloud auto-scaling lets us match capacity to demand. The key requirement is stateless services — sessions and shared data must live outside the server, in Redis or a shared DB. On AWS, we'd use EC2 Auto Scaling Groups with ALB for web tiers, and DynamoDB or RDS read replicas for the data tier."_

---

### 10. Quick Example

**Problem:** Your e-commerce checkout API handles 500 RPS normally. On a flash sale it hits 5,000 RPS.

```
Normal Day:
  [ALB] → [2× EC2 t3.large]

Flash Sale (10x load):
  CloudWatch: CPU > 70% for 2 min
  → ASG scales to 12× EC2 t3.large
  → ALB distributes 5,000 RPS across 12 nodes
  → Each node handles ~417 RPS (well within capacity)
  → After sale: ASG scales back in to 2 nodes (cost saving)
```

Without horizontal scaling: the 2 original servers would saturate, queue up, and start returning 503s within seconds.

---

### 11. Common Interview Questions

**Q1: How would you scale a stateful service horizontally?**

> Externalize state. Move sessions to Redis, files to S3, DB to a shared RDS/DynamoDB. Once the service is stateless, you can put N copies behind a load balancer freely.

**Q2: When would you choose vertical over horizontal scaling?**

> For legacy databases (like a single PostgreSQL primary for writes) where sharding adds too much complexity — you scale up the instance size first. Also for quick short-term fixes before a proper horizontal architecture is ready.

**Q3: What is the bottleneck after you horizontally scale the app tier?**

> The database write path. Web/API tier scales easily, but a single-primary relational DB becomes the new ceiling. Solutions: read replicas (for reads), DB connection pooling (PgBouncer), and eventually sharding or migrating writes to DynamoDB.

---

> ✅ **TOPIC COMPLETE** — Scalability (Vertical vs Horizontal)
> **Status**: ✅ Done
>
> ---
>
> **Next Topic →** [02 · Latency vs Throughput](./02-latency-throughput.md)
> Reply **`Continue`** to generate it.
