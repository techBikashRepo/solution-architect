# Lambda vs EC2 Cost Trade-off

> **Subject**: AWS Cloud · **Group**: 💰 Cost Awareness · **Topic**: 01 of 2
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is the Trade-off?

Lambda and EC2 represent two fundamentally different compute pricing models. Choosing the wrong one means either paying for idle capacity (EC2) or paying premium per-invocation costs at high scale (Lambda). Understanding the break-even point is a senior-level skill.

| Model        | Lambda                    | EC2                                   |
| ------------ | ------------------------- | ------------------------------------- |
| Pricing      | Per invocation + duration | Per hour (running regardless of load) |
| Idle cost    | $0.00                     | Full price                            |
| Scaling      | Instant, automatic        | Minutes (ASG launch time)             |
| Max duration | 15 minutes                | Unlimited                             |
| Cold start   | Yes (100ms–2s)            | No                                    |

---

### 2. Lambda Pricing

```
LAMBDA PRICING (us-east-1, 2024):
  Requests: $0.20 per 1M invocations (first 1M/month free)
  Duration: $0.0000166667 per GB-second

  GB-second = (memory in GB) × (duration in seconds)

  EXAMPLE:
    Function memory: 512MB = 0.5 GB
    Avg duration: 200ms = 0.2 seconds
    GB-seconds per invocation: 0.5 × 0.2 = 0.1 GB-sec

    1M invocations/month:
      Requests: $0.20
      Duration: 1,000,000 × 0.1 × $0.0000166667 = $1.67
      Total: ~$1.87/month

    100M invocations/month:
      Requests: $0.20 × 100 = $20.00
      Duration: 100M × 0.1 × $0.0000166667 = $166.67
      Total: ~$186.67/month

    COMPUTE SAVINGS PLAN: up to 17% off Lambda (1-year commit)
    Provisioned Concurrency: additional cost (~60% of on-demand Lambda price)
      10 provisioned concurrency × $0.0000041667/GB-sec (always on)
      = ~$30-50/month extra for warm Lambda
```

---

### 3. EC2 Pricing

```
EC2 PRICING (us-east-1, 2024 approximate):
  t3.medium (2 vCPU, 4GB): $0.0416/hr = ~$30/month On-Demand
  m5.large  (2 vCPU, 8GB): $0.096/hr  = ~$69/month On-Demand
  c5.large  (2 vCPU, 4GB): $0.085/hr  = ~$61/month On-Demand

  SAVINGS OPTIONS:
    Reserved Instance (1 year, No Upfront): ~40% off
    Reserved Instance (3 year, All Upfront): ~60% off
    Spot Instance: ~70% off (interruptible)
    Savings Plans (Compute, 1 year): ~40% off, flexible

  MINIMUM COST (2 instances for HA, t3.medium, 1-year RI):
    2 × $30/month × 0.60 = $36/month minimum baseline

  KEY POINT: EC2 costs money 24/7 regardless of traffic
    At 1am with zero requests → still paying $36+/month
    Lambda at 1am with zero requests → $0
```

---

### 4. Break-Even Analysis

```
BREAK-EVEN CALCULATION:
  EC2 baseline (2 × t3.medium, 1-yr RI): ~$36/month
  Lambda 512MB, 200ms avg duration

  Monthly Lambda cost = (invocations × $0.0000002) + (invocations × 0.1 × $0.0000166667)
                      = invocations × $0.000001867

  Break-even: Lambda cost = EC2 cost
  invocations × $0.000001867 = $36
  invocations = $36 / $0.000001867 = ~19.3 million/month

  INTERPRETATION:
    < 19M invocations/month → Lambda is cheaper
    > 19M invocations/month → EC2 (RI) is cheaper

  AT HIGH SCALE (100M invocations, 512MB, 200ms):
    Lambda: ~$187/month
    EC2 (4× m5.large, 1-yr RI): ~$160/month + ops overhead
    → EC2 wins on cost, but Lambda wins on ops simplicity

TRAFFIC PATTERN MATTERS:
  Spiky traffic (burst during day, idle overnight):
    Lambda: pay only during activity → huge saving
    EC2: pay 24/7 → wasted capacity overnight

  Steady traffic (always-on API at 1000 RPS):
    Lambda: $1800/month (estimated for 1000 RPS × 86400s × 30d)
    EC2: $200-400/month for 4 × t3.large
    → EC2 wins at sustained high throughput
```

---

### 5. When to Choose Each

```
CHOOSE LAMBDA WHEN:
  ✅ Unpredictable or bursty traffic
  ✅ Low-frequency event processing (webhooks, scheduled jobs)
  ✅ < ~20M invocations/month at 512MB/200ms
  ✅ Zero server management desired
  ✅ Functions run < 15 minutes
  ✅ Event-driven architecture (S3 trigger, SNS, SQS)

CHOOSE EC2 WHEN:
  ✅ Steady, predictable high throughput (> 50M req/month)
  ✅ Long-running processes (> 15 min)
  ✅ Stateful applications (in-memory state, file system)
  ✅ Complex legacy apps hard to refactor for serverless
  ✅ Need full OS control, custom runtime, GPU
  ✅ Existing RIs or Savings Plans already purchased

CHOOSE FARGATE (ECS/EKS) WHEN:
  ✅ Containerized apps
  ✅ Longer than Lambda limit but don't want to manage EC2
  ✅ Need more memory/CPU than Lambda max (10GB/6vCPU)
  ✅ Serverless containers (pay-per-task-hour, not idle EC2)
```

---

## PART 2

---

### 6. Real Cost Scenarios

```
SCENARIO 1: Internal webhook processor
  Volume: 500K invocations/day = 15M/month
  Lambda 256MB, 100ms: $3.00/month
  EC2 t3.nano always-on: $3.80/month
  → Lambda wins (simpler AND cheaper)

SCENARIO 2: High-traffic API (e-commerce peak)
  Volume: 10M requests/day = 300M/month
  Lambda 512MB, 150ms:
    Requests: $60
    Duration: 300M × 0.075 GB-sec × $0.0000166667 = $375
    Total: ~$435/month
  EC2 4 × c5.large (1-yr RI): ~$240/month
  → EC2 wins on cost; Lambda wins on ops simplicity

  Compromise: EC2 for baseline load + Lambda for overflow
  Or: 4× EC2 On-Demand + Spot instances for cost reduction

SCENARIO 3: Overnight batch job, once per day, 5 min duration
  Lambda 3GB, 300s: $0.0000166667 × 3 × 300 = $0.015 per run = $0.45/month
  EC2 just for this: $30+/month
  → Lambda wins massively (batch jobs with Lambda are extremely cost-effective)
```

---

### 7. Cost Optimization Tactics

```
LAMBDA OPTIMIZATION:
  1. Right-size memory: use AWS Lambda Power Tuning tool
     Run function at different memory configs (128MB–3GB)
     Find optimal: lowest cost = memory × duration minimized
     Often: higher memory = faster execution = same or lower cost

  2. ARM/Graviton2 Lambda: 20% cheaper + 20% better performance
     Change architecture: x86_64 → arm64 in function config

  3. Reduce cold starts: Provisioned Concurrency only for critical paths
     Don't provision all Lambdas — only user-facing latency-sensitive ones

  4. Reduce duration: optimize DB queries, use connection pooling (RDS Proxy)

  5. Avoid Lambda for high-frequency polling: use SQS event source mapping
     (Lambda polls SQS; you don't pay per poll — only per invocation)

EC2 OPTIMIZATION:
  1. Right-size: use AWS Compute Optimizer recommendations
     CloudWatch data → ML → suggests right instance type
  2. Reserved Instances for ≥1 year stable workloads
  3. Spot for fault-tolerant batch/stateless workloads
  4. Scheduled scaling: scale in overnight, scale out before business hours
  5. Use Graviton3 (C7g, M7g): same performance, 20% cheaper than x86
```

---

### 8. Interview-Ready Explanation (30 sec)

> _"Lambda vs EC2 cost comes down to traffic pattern and scale. Lambda is pay-per-invocation — zero cost when idle. EC2 pays 24/7. For bursty or low-volume workloads, Lambda wins easily. At sustained high throughput (>20-50M invocations/month at typical configs), EC2 with Reserved Instances becomes cheaper._
>
> _Rule of thumb: Lambda for event-driven, spiky, or low-frequency workloads; EC2 for always-on, steady-state high throughput. The sweet spot: EC2 for the baseline load (Reserved), Lambda or Spot for burst._
>
> _To optimize Lambda: use AWS Lambda Power Tuning to find the cost-optimal memory. Switch to ARM/Graviton2 for 20% savings. Right-size EC2 with AWS Compute Optimizer."_

---

### 9. Common Interview Questions

**Q1: How do you calculate whether Lambda or EC2 is cheaper for your use case?**

> Calculate monthly invocations and average duration. Lambda cost = (invocations × $0.0000002) + (invocations × GB-seconds × $0.0000166667). EC2 cost = instance hours × hourly rate (On-Demand or RI). The key variable is traffic pattern: Lambda has zero idle cost; EC2 pays 24/7. For spiky traffic (busy 8 hours, idle 16 hours), Lambda saves ~66% just on idle time. At sustained 1000 RPS for 30 days: ~2.6 billion invocations — Lambda costs ~$5,000; EC2 at ~$500. EC2 wins at sustained high volume. For mixed workloads: use EC2 (Reserved) for predictable baseline, Lambda for peak overflow. Always use AWS Pricing Calculator for accurate estimates — pricing changes and varies by region.

**Q2: What is AWS Lambda Power Tuning and how does it work?**

> Lambda Power Tuning is an open-source tool (AWS Step Functions state machine) that benchmarks your Lambda function at different memory settings (128MB to 10GB in configurable steps). It runs the function N times at each memory level, measures actual duration and cost, and generates a graph showing cost vs performance. Result: the "optimal" memory setting minimizes cost (duration × memory). Counterintuitive finding: doubling memory often halves execution time — same or lower cost with better performance. This is because Lambda gives proportional CPU to memory. For CPU-bound functions: more memory = more CPU = faster. Run Power Tuning in CI or staging, not prod. Typical recommendation: 512MB-1GB often hits the sweet spot. Switch to arm64 architecture after finding optimal memory for an additional 20% savings.

**Q3: When would you use Fargate instead of Lambda or EC2?**

> Fargate is "serverless containers" — you run Docker containers without managing EC2 instances. Choose Fargate over Lambda when: (1) Execution time > 15 minutes (Lambda hard limit). (2) Need more than Lambda's max 10GB memory or 6 vCPU. (3) Application requires a specific runtime not supported by Lambda custom layers. (4) Team already containerized the app and wants to avoid Lambda refactoring. Choose Fargate over EC2 when: (1) Don't want to manage EC2 patches, AMI updates, cluster capacity. (2) Workloads are variable — Fargate scales tasks; EC2 requires capacity planning. (3) Better per-task security isolation (each Fargate task has its own ENI). Cost: Fargate is more expensive than EC2 On-Demand per compute unit, but cheaper than EC2 when tasks are idle (scale to 0). For batch jobs: Fargate is ideal (scale to 0 between runs).

---

> **Next Topic →** [02 · S3 Cheap Storage](./02-s3-cheap-storage.md)
