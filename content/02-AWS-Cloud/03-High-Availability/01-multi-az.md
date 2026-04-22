# Multi-AZ — High Availability Design

> **Subject**: AWS Cloud · **Group**: 🔒 High Availability · **Topic**: 01 of 2
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Multi-AZ** means distributing your application and data across multiple **Availability Zones** (AZs) within an AWS region. Each AZ is a physically separate data center with independent power, cooling, and networking. If one AZ fails, traffic automatically fails over to the remaining AZs.

```
Single AZ:                  Multi-AZ:
  us-east-1a                  us-east-1a    us-east-1b
  ─────────                   ─────────     ─────────
  EC2 + RDS                   EC2 + RDS     EC2 + RDS

  AZ fails → full outage      AZ fails → traffic to 1b ✅
```

---

### 2. Availability Math

| Architecture                 | Availability | Downtime/Year |
| ---------------------------- | ------------ | ------------- |
| Single EC2, single AZ        | ~99.9%       | ~8.7 hours    |
| Multi-AZ (2 AZs)             | ~99.99%      | ~52 minutes   |
| Multi-AZ (3 AZs)             | ~99.999%     | ~5 minutes    |
| Multi-region (active-active) | ~99.9999%    | ~31 seconds   |

> AZ failure probability ≈ 0.1%/year. With 2 independent AZs: P(both fail) = 0.001 × 0.001 = 0.000001 → 99.9999% if truly independent.

---

### 3. Multi-AZ per AWS Service

```
EC2 + AUTO SCALING GROUP:
  ASG spans 2+ AZs
  Min 2 instances (one per AZ minimum)
  If AZ fails: ASG detects capacity reduction → launches replacement in remaining AZs
  ALB automatically stops routing to unhealthy AZ instances

RDS MULTI-AZ:
  Primary: us-east-1a
  Standby: us-east-1b (synchronous replication — every write confirmed by standby)
  Failover: RDS detects primary failure → promotes standby → updates DNS endpoint
  RTO (Recovery Time Objective): ~60-120 seconds
  RPO (Recovery Point Objective): 0 (no data loss; synchronous replication)

  IMPORTANT: Multi-AZ standby ≠ Read Replica
  Standby: only for failover, not accessible for reads
  Read Replica: asynchronous, used for read scaling (may have slight lag)

ELASTICACHE REDIS:
  Primary + Replica across AZs
  Automatic failover: primary failure → replica promoted in ~30 seconds
  Cluster mode: multiple shards × multiple replicas = both scale + HA

RDS AURORA:
  6 copies of data across 3 AZs (2 copies per AZ)
  Can lose 2 copies for writes, 3 copies for reads (still functions)
  Faster failover than MySQL Multi-AZ: ~30 seconds
  Up to 15 Read Replicas (vs 5 for MySQL RDS)

NAT GATEWAY:
  Deploy one per AZ
  Each private subnet routes to its local NAT Gateway
  Single NAT Gateway = SPOF for outbound internet from private subnets
```

---

### 4. Multi-AZ Networking

```
SUBNET DESIGN (mandatory for HA):
  Each tier has subnets in ≥2 AZs:

  Public subnets:
    10.0.1.0/24 (us-east-1a) — ALB, NAT GW A
    10.0.2.0/24 (us-east-1b) — ALB, NAT GW B

  Private App subnets:
    10.0.11.0/24 (us-east-1a) — EC2 ASG
    10.0.12.0/24 (us-east-1b) — EC2 ASG

  Private DB subnets (RDS Subnet Group must have ≥2 AZs):
    10.0.21.0/24 (us-east-1a) — RDS Primary
    10.0.22.0/24 (us-east-1b) — RDS Standby

  Route tables:
    Private App 1a → NAT GW A (local AZ)
    Private App 1b → NAT GW B (local AZ)

ALB IS MULTI-AZ BY DEFAULT:
  ALB spans all AZs in its subnets
  ALB node in each AZ; Route 53 DNS returns all ALB IPs
  If 1a is down: DNS TTL expires; clients use 1b ALB node only
```

---

### 5. Health Checks — The Glue of Multi-AZ

```
WITHOUT HEALTH CHECKS: Multi-AZ is useless
  Traffic still routes to failed AZ → errors
  DB failover happens but app doesn't retry → errors

HEALTH CHECK LAYERS:
  1. ALB health check → /health endpoint on EC2
     Unhealthy: stop routing to that instance

  2. ASG health check (uses ALB health check)
     Unhealthy: terminate instance, launch replacement in other AZ

  3. Route 53 health check (for multi-region):
     Endpoint health check → if primary region down → failover to DR region

  4. RDS Multi-AZ: AWS monitors primary → auto-failover if primary is unhealthy

  /health endpoint should check:
    ✅ DB connection pool (can connect to RDS)
    ✅ Cache connection (can reach ElastiCache)
    ✅ Critical dependencies
    Return 200 if healthy, 503 if not
    (DO NOT return 200 always — defeats the purpose)
```

---

## PART 2

---

### 6. RTO and RPO Design

| Term                               | Definition                 | Target           |
| ---------------------------------- | -------------------------- | ---------------- |
| **RTO** (Recovery Time Objective)  | How long can we be down?   | Seconds to hours |
| **RPO** (Recovery Point Objective) | How much data can we lose? | Zero to hours    |

```
MULTI-AZ ACHIEVES:
  RTO ≈ 60-120 seconds (RDS failover; ASG replacement)
  RPO = 0 (synchronous replication, no data loss)

FOR LOWER RTO:
  RDS Aurora: ~30s failover
  ElastiCache: ~30s Redis failover
  ASG: <5 min to launch + warm new instance
  Pre-warm: keep desired capacity slightly above minimum

FOR DR (DISASTER RECOVERY):
  Multi-AZ = protection against AZ failure (within region)
  Multi-Region = protection against region failure (rare but possible)

  Multi-Region options:
    Backup & Restore: RPO hours, RTO hours (cheapest)
    Pilot Light: RPO minutes, RTO 10-30 min (replicate data, minimal compute)
    Warm Standby: RPO seconds, RTO minutes (scaled-down prod in DR region)
    Active-Active: RPO 0, RTO 0 (Route 53 distributes traffic to both regions)
```

---

### 7. Common Multi-AZ Mistakes

```
MISTAKE 1: Setting ASG Min=1
  Only one instance running → if it fails or AZ goes down → full outage
  FIX: Always Min≥2, spread across ≥2 AZs

MISTAKE 2: Single NAT Gateway
  All private subnets → one NAT GW → if that AZ goes down, all outbound fails
  FIX: one NAT GW per AZ; private subnets route to local NAT GW

MISTAKE 3: RDS subnet group with one AZ
  RDS Multi-AZ requires a subnet group with subnets in ≥2 AZs
  FIX: DB subnet group must include subnets in all AZs you want failover in

MISTAKE 4: /health always returns 200
  ALB thinks all instances are healthy even when app can't reach DB
  FIX: /health checks actual dependencies; returns 503 if DB is unreachable

MISTAKE 5: No connection retry on app failover
  RDS failover DNS propagates in ~60s but existing connections die immediately
  FIX: implement retry with exponential backoff; use RDS Proxy (handles reconnect)
```

---

### 8. Interview-Ready Explanation (30 sec)

> _"Multi-AZ means spreading every tier across at least two Availability Zones — each is a physically isolated data center. For EC2: Auto Scaling Group spans both AZs; ALB routes only to healthy instances. For RDS: Multi-AZ keeps a synchronous standby — zero data loss, automatic failover in ~60-120 seconds._
>
> _Key rules: minimum 2 instances per ASG; one NAT Gateway per AZ; RDS subnet group with subnets in each AZ; /health endpoint checks real dependencies._
>
> _Multi-AZ protects against AZ failure (99.99% availability). Multi-region protects against full region failure — much rarer but needed for critical systems."_

---

### 9. Common Interview Questions

**Q1: How does RDS Multi-AZ failover work and what is the application impact?**

> RDS continuously replicates synchronously to a standby in another AZ. On primary failure (or maintenance), RDS: promotes the standby to primary, updates the RDS endpoint DNS CNAME to point to the new primary (~60 seconds DNS TTL). Application impact: existing database connections are dropped (TCP connection terminated). Application must: (1) reconnect using the RDS endpoint (not hardcoded IP), (2) implement retry logic. Solutions: RDS Proxy maintains a connection pool and handles failover transparently to the application — app reconnects to proxy, proxy re-establishes DB connection. Aurora Multi-AZ is faster (~30s) and promotes a read replica. Configure JDBC/psycopg2 with connect_timeout=5 and application-level retry with backoff.

**Q2: How would you design for 99.99% availability on AWS?**

> Multi-AZ everything: (1) EC2 ASG spanning ≥2 AZs, Min=2. ALB with health checks. (2) RDS Multi-AZ with automatic failover. (3) ElastiCache with Multi-AZ enabled (primary + replica in different AZs). (4) One NAT Gateway per AZ. (5) /health endpoints that check real dependencies. Monitoring: CloudWatch alarms on HealthyHostCount < 2 → immediate alert. Runbooks for failover scenarios. Regular DR testing: terminate an AZ's EC2 instances — does traffic seamlessly shift? Fail over RDS manually — does app reconnect? The architecture achieves ~99.99% because the probability of BOTH AZs failing simultaneously is extremely low. For 99.999%, you need multi-region.

**Q3: What is the difference between Multi-AZ and a Read Replica?**

> Multi-AZ (HA focus): synchronous replication to standby in another AZ. The standby is not accessible — it only activates on failover. RPO=0 (no data loss). RTO=60-120 seconds. Used for: fault tolerance and availability. Read Replica (scale focus): asynchronous replication to one or more readable replicas. Used for: scaling read traffic (reporting queries, analytics). The replica may lag behind primary by seconds. You point read traffic explicitly to the replica endpoint. Read Replicas can be in a different AZ or different region. Key trap: Multi-AZ does NOT help you scale reads. You need explicit Read Replicas for that. You can use BOTH: Multi-AZ for HA, plus Read Replicas for scale. Aurora is better for this — up to 15 Read Replicas that also serve as failover targets.

---

> **Next Topic →** [02 · Auto Scaling](./02-auto-scaling.md)
