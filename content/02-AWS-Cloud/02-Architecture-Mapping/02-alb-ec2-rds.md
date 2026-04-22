# ALB → EC2 → RDS

> **Subject**: AWS Cloud · **Group**: 🗺️ Architecture Mapping · **Topic**: 02 of 3
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is this Pattern?

**ALB → EC2 → RDS** is the classic three-tier web architecture on AWS. Load balancer distributes HTTP/HTTPS traffic across multiple EC2 application servers, which connect to a managed relational database. This is the "lift-and-shift" baseline for web applications and remains widely used for applications requiring ACID transactions and complex SQL.

```
Internet → ALB → EC2 Auto Scaling Group → RDS (Multi-AZ)
          (Layer 7)   (App Tier)           (Data Tier)
```

---

### 2. Each Component's Role

| Component   | Responsibility                                                                    |
| ----------- | --------------------------------------------------------------------------------- |
| **ALB**     | HTTPS termination, health checks, distribute traffic across EC2 targets           |
| **EC2 ASG** | Application logic; Auto Scaling adds/removes instances based on CPU/request count |
| **RDS**     | Managed relational DB; handles backups, patches, Multi-AZ failover                |

---

### 3. Multi-AZ Architecture

```
PRODUCTION LAYOUT:
─────────────────────────────────────────────────────────
  VPC: 10.0.0.0/16

  AZ us-east-1a               AZ us-east-1b
  ─────────────────           ─────────────────
  Public: 10.0.1.0/24         Public: 10.0.2.0/24
    NAT Gateway A               NAT Gateway B
    ALB node A                  ALB node B

  Private App: 10.0.11.0/24  Private App: 10.0.12.0/24
    EC2 (t3.medium) × 2         EC2 (t3.medium) × 2
    ↑ Auto Scaling Group spans both AZs

  Private DB: 10.0.21.0/24   Private DB: 10.0.22.0/24
    RDS Primary (MySQL 8.0)     RDS Standby (Multi-AZ replica)

  SECURITY GROUPS:
    alb-sg:   inbound 443 from 0.0.0.0/0
    app-sg:   inbound 8080 from alb-sg only
    db-sg:    inbound 3306 from app-sg only

TRAFFIC FLOW:
  User → Route 53 → ALB (alb.myapp.com)
  ALB → health check /health → only healthy app-sg instances
  EC2 → RDS Primary (write) or Read Replica (read, if configured)
  RDS Multi-AZ: synchronous replication to standby
    Failover: ~60-120s (DNS update from primary to standby)
```

---

### 4. Auto Scaling Group Config

```
AUTO SCALING GROUP:
  Launch Template:
    AMI: Amazon Linux 2023 with app baked in (or UserData script)
    Instance type: t3.medium (or c5.large for CPU-intensive)
    Key pair: none (use SSM Session Manager instead)
    IAM instance profile: app-role (SSM + CloudWatch + Secrets Manager)
    Security Group: app-sg
    User Data:
      #!/bin/bash
      systemctl start my-app.service

  ASG Config:
    Min: 2 (HA — never go to 1)
    Desired: 4
    Max: 20
    AZs: us-east-1a, us-east-1b (balanced)

  SCALING POLICIES:
    Target Tracking (recommended):
      Metric: ALBRequestCountPerTarget
      Target: 1000 requests/target
      → ASG adds instances when avg exceeds 1000 req/target
      → Removes instances when below target

    Or: CPUUtilization target 60%

  COOLDOWN: 300 seconds (don't add/remove too fast)
  INSTANCE WARMUP: 120 seconds (don't count new instance metrics until warm)

HEALTH CHECKS:
  ASG uses ALB health checks (not just EC2 status checks)
  If /health returns unhealthy → ASG terminates and replaces
  Grace period: 180s (give new instance time to start app)
```

---

### 5. RDS Configuration

```
RDS INSTANCE CHOICES:
  Dev: db.t3.micro (cheap, burstable)
  Prod: db.m6g.large or db.r6g.large (memory-optimized for DB)

  Multi-AZ: YES (automatic failover; ~2x cost but required for prod)
  Storage: gp3 (better IOPS/cost ratio than gp2)
  Storage autoscaling: enable (avoids "disk full" emergency)

RDS PARAMETER GROUP:
  max_connections: depends on instance size
    db.t3.micro: ~80 connections max
    db.m6g.large: ~600 connections max

RDSRDS PROXY (if Lambda or spiky connections):
  Connection pool between EC2 (or Lambda) and RDS
  Handles connection surge without overwhelming RDS max_connections
  Failover: RDS Proxy re-routes during Multi-AZ failover → faster recovery

READ REPLICAS (separate read scaling):
  Multi-AZ = for HA/failover only (not for reads)
  Read Replica = scales read throughput (async replication)
  EC2 code: write to primary endpoint; read from read replica endpoint
  Use case: reporting queries, analytics reads that would slow down writes

CREDENTIALS:
  Store in Secrets Manager (not env vars)
  RDS Proxy: uses IAM auth instead of password → even more secure
  EC2 IAM role → Secrets Manager → RDS password
```

---

## PART 2

---

### 6. ALB → EC2 → RDS vs API Gateway → Lambda → DynamoDB

| Dimension        | ALB → EC2 → RDS                   | APIgw → Lambda → DynamoDB           |
| ---------------- | --------------------------------- | ----------------------------------- |
| **Compute**      | Long-running processes; stateful  | Stateless; event-driven             |
| **Cold start**   | None (always running)             | Lambda: 100-2000ms cold start       |
| **Cost model**   | Fixed (pay for running instances) | Per-invocation (pay per use)        |
| **Best traffic** | Steady, predictable               | Spiky, unpredictable                |
| **State**        | Can hold in-memory state          | Stateless (must use Redis/DB)       |
| **Long ops**     | No Lambda 15-min limit            | 15-min max per invocation           |
| **DB**           | Complex SQL, joins, transactions  | Key-value, document, sparse queries |
| **Ops burden**   | Patch OS, AMI rotation            | Zero server management              |

---

### 7. Common Pitfalls

```
PITFALL 1: Single AZ deployment
  One AZ → AZ failure = full outage
  Fix: ASG spans ≥2 AZs; RDS Multi-AZ; ALB is regional (spans all AZs)

PITFALL 2: Too many DB connections
  100 EC2 × 20 connections per instance = 2000 connections → RDS exhausted
  Fix: use RDS Proxy (connection pool); or reduce connections per instance

PITFALL 3: No connection draining on scale-in
  ASG terminates instance while ALB still sends requests
  Fix: set deregistration delay (300s) on target group; instance completes in-flight requests
  Set ASG lifecycle hook to wait for connection draining before terminating

PITFALL 4: Secrets in environment variables
  ASG UserData or env vars with DB password → visible in launch template
  Fix: store in Secrets Manager; EC2 role fetches at startup

PITFALL 5: RDS Multi-AZ ≠ Read Scale
  Multi-AZ standby is NOT a read replica — it only activates on failover
  Fix: create explicit Read Replicas if you need to scale read traffic
```

---

### 8. AWS Architecture Example

```
COMPLETE ALB → EC2 → RDS SETUP:
─────────────────────────────────────────────────────────
  DNS: Route 53 → app.myapp.com → ALB alias record

  ALB:
    HTTPS listener 443 (ACM cert *.myapp.com)
    HTTP 80 → redirect to HTTPS
    Target Group: app-tg (protocol HTTP 8080, health check /health)
    Stickiness: off (app stores session in ElastiCache Redis)
    WAF: enabled (rate limit, OWASP rules)
    Access logs: S3 bucket app-alb-logs

  EC2 ASG:
    Launch Template v2 (t3.large, Amazon Linux 2023)
    IAM role: ec2-app-role
      - SSM (no bastion, no SSH port 22)
      - CloudWatch Agent (metrics + logs)
      - Secrets Manager: GetSecretValue on db-secret
      - ECR: pull Docker images (if containerized)

    Min: 2, Desired: 4, Max: 20
    Target tracking: ALBRequestCountPerTarget = 1000
    Health check grace: 120s
    Lifecycle hook: wait 30s before termination (drain connections)

  RDS:
    Engine: MySQL 8.0 / PostgreSQL 15
    Instance: db.r6g.large (memory-optimized)
    Multi-AZ: enabled
    Storage: gp3, 200GB, autoscale to 1TB
    Maintenance window: Sun 02:00-04:00 UTC (low traffic)
    Backup retention: 7 days
    1 Read Replica: db.r6g.medium (reporting traffic)
    RDS Proxy: enabled (pool connections, IAM auth)

  ElastiCache Redis (session store):
    Cluster mode: 1 primary + 1 replica per shard
    Session TTL: 30 min
    EC2 stores sessions here → ALB sticky sessions not needed

  Monitoring:
    CloudWatch Agent: memory, disk, app logs to /aws/ec2/app
    Alarms: EC2 CPU > 80%, RDS CPU > 80%, DB connections > 80%
    Alarm: unhealthy host count > 0 → SNS → PagerDuty
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"ALB → EC2 → RDS is the traditional three-tier architecture on AWS. ALB distributes HTTPS traffic across EC2 instances in an Auto Scaling Group spanning at least two AZs. RDS with Multi-AZ ensures database HA — automatic failover in ~60-120 seconds._
>
> _Key design choices: store sessions in ElastiCache (not EC2 memory) so any instance can serve any request. Use RDS Proxy if connection count is a concern. Use target tracking on ALBRequestCountPerTarget for smooth scaling._
>
> _Compare to serverless: EC2 has no cold starts, handles long-running processes, and supports complex SQL. But you manage instances, patches, and capacity — serverless eliminates that."_

---

### 10. Common Interview Questions

**Q1: How does Multi-AZ RDS failover work and what is the impact?**

> Multi-AZ maintains a synchronous standby replica in a different AZ. Data is synchronously replicated to standby (commit on primary is acknowledged only after standby confirms write). On failure: RDS detects primary failure, updates the CNAME DNS record from primary endpoint to standby (now primary). Failover time: ~60-120 seconds (DNS TTL + instance promotion). Application impact: existing DB connections are dropped; application must reconnect. Mitigate by: (1) using RDS Proxy — it handles reconnection transparently, reducing failover impact to ~30 seconds. (2) Implementing retry logic with exponential backoff in the application. (3) Setting JDBC/psycopg2 connection timeout to 5s and retry up to 3 times. Multi-AZ is NOT for read scaling — the standby is not accessible for reads.

**Q2: How do you scale an EC2 ASG for a web application?**

> Preferred: target tracking scaling. Set a metric target (e.g., ALBRequestCountPerTarget = 1000) and ASG automatically adjusts instance count to maintain that target. Simple and self-correcting. For more control: step scaling (if CPU > 60% for 5 min: add 2 instances; if CPU > 80% for 2 min: add 4 instances). Also: scheduled scaling for known traffic patterns (scale out at 8am, scale in at 10pm). Key settings: cooldown period (300s) prevents thrashing; instance warmup (120s) prevents new instances from being counted in scaling metrics too early. Always set Min: ≥2 for HA. Use ALBRequestCountPerTarget over CPUUtilization — CPU varies by task type, but request count directly reflects load on the ALB target.

**Q3: How do you handle database schema migrations with zero downtime?**

> Strategy: expand/contract (also called backward-compatible migrations). Expand phase: add new column (nullable or with default) → both old and new code work. Deploy new code that writes to both old and new columns. Migrate existing data in small batches (not one transaction for millions of rows → lock tables). Contract phase: remove old column once all code uses new. Tools: AWS Database Migration Service for data migration; Flyway or Liquibase for schema versioning. For blue/green: use RDS Blue/Green Deployments feature (Aurora, MySQL, PostgreSQL). AWS creates a clone (Green), migrates schema, you cut over with <1 minute downtime. Rollback: revert to Blue instantly if issues. Never run migration in production during peak traffic — use maintenance window or blue/green.

---

> **Next Topic →** [03 · S3 → CloudFront](./03-s3-cloudfront.md)
