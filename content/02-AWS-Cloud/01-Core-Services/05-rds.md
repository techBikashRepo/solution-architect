# RDS — Amazon Relational Database Service

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 05 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon RDS** is a managed relational database service. AWS handles OS patching, DB engine updates, automated backups, Multi-AZ replication, and monitoring. You focus on schema design and queries.

Supported engines: **PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, Aurora (PostgreSQL/MySQL compatible)**.

---

### 2. Key Concepts

| Concept               | Detail                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| **DB Instance**       | The actual database server (select instance type: db.t3.micro to db.r6g.48xlarge)  |
| **Multi-AZ**          | Synchronous standby replica in another AZ; auto-failover in 1-2 min                |
| **Read Replica**      | Asynchronous copy for read scaling; can be promoted to primary                     |
| **Automated Backups** | Daily snapshots + transaction logs; point-in-time recovery (PITR) to any second    |
| **Subnet Group**      | VPC subnets where RDS can be placed (use private subnets)                          |
| **Parameter Group**   | DB engine configuration (buffer pool size, connection limits)                      |
| **Aurora**            | AWS-built MySQL/PostgreSQL-compatible engine — 5x MySQL, 3x PostgreSQL performance |

---

### 3. RDS vs Aurora (Important Distinction)

| Dimension             | RDS (MySQL/PostgreSQL)             | Aurora                                              |
| --------------------- | ---------------------------------- | --------------------------------------------------- |
| **Performance**       | Standard MySQL/PostgreSQL          | 5× MySQL, 3× PostgreSQL                             |
| **Storage**           | EBS, fixed allocation              | Distributed shared storage, auto-grows to 128TB     |
| **Replication**       | Async to read replicas             | Ultra-fast (<10ms) to 15 replicas (shared storage)  |
| **Failover**          | 1-2 minutes (Multi-AZ)             | <30 seconds (Aurora Multi-AZ)                       |
| **Cost**              | Lower instance cost                | Higher instance cost (~20% more)                    |
| **Best for**          | Lift-and-shift, standard workloads | High-performance, cloud-native, variable storage    |
| **Serverless option** | No                                 | Aurora Serverless v2 (scales CPU/RAM automatically) |

---

### 4. Multi-AZ vs Read Replica

```
MULTI-AZ (High Availability, NOT performance):
─────────────────────────────────────────────────────────
  Primary DB (us-east-1a) ── sync replication ── Standby (us-east-1b)

  - All reads and writes go to PRIMARY
  - Standby cannot be read by your app
  - On primary failure: DNS failover to standby in 1-2 min
  - Purpose: HA (survive AZ failure)

READ REPLICA (Scaling reads, NOT HA):
─────────────────────────────────────────────────────────
  Primary DB ── async replication ──→ Read Replica 1
                                  ──→ Read Replica 2
                                  ──→ Read Replica (different region)

  - App reads from replicas, writes to primary
  - Replicas can be in different AZ or region
  - Replication lag: usually <1s (can be longer under load)
  - Promote to primary: takes a few minutes; promoted replica is standalone
  - Purpose: scale reads, offload analytics, DR

COMBINE BOTH:
  Primary (Multi-AZ for HA) + Read Replicas (for scale)
  Most production setups use both
```

---

### 5. Aurora Specifics

```
AURORA STORAGE ARCHITECTURE:
  Data stored across 6 copies in 3 AZs automatically
  Tolerate: 2 AZ failures (writes); 3 AZ failures (reads)

  Aurora Cluster:
    Writer Endpoint → always points to primary instance
    Reader Endpoint → load balances across all read replicas
    Custom Endpoint → route specific query types to specific instances

AURORA SERVERLESS v2:
  Scales ACUs (Aurora Capacity Units) instantly with load
  Min: 0.5 ACU; Max: 128 ACU (set per cluster)
  Best for: variable/unpredictable workloads, dev/test, APIs
  Billing: per ACU-hour (not per instance)

  vs Aurora provisioned:
    Provisioned: fixed instance, predictable performance, lower cost for steady workloads
    Serverless: variable, no capacity planning, higher per-unit cost but zero idle cost

AURORA GLOBAL DATABASE:
  Primary Region → replication (< 1s) → Secondary Regions (up to 5)
  Disaster Recovery: promote secondary to primary in < 1 minute
  Read scaling: globally distributed read replicas
```

---

## PART 2

---

### 6. When to Use RDS/Aurora

✅ **Use RDS when**:

- Standard relational workloads (OLTP)
- Complex queries, JOINs, ACID transactions
- Existing MySQL/PostgreSQL application (lift-and-shift)
- Compliance requirements for managed DB

✅ **Use Aurora when**:

- Higher throughput requirement than standard MySQL/PostgreSQL
- Variable storage growth (Aurora auto-grows)
- Need faster failover (<30s vs 1-2min)
- Cloud-native new application
- Aurora Serverless for variable workloads

❌ **Don't use RDS when**:

- In-memory data → Redis/ElastiCache
- Non-relational, flexible schema → DynamoDB
- Data warehouse / analytics → Redshift
- Simple key-value at massive scale → DynamoDB

---

### 7. RDS Performance and Security

```
PERFORMANCE:
  Connection pooling: use PgBouncer (PostgreSQL) or ProxySQL (MySQL)
  For Lambda: always use RDS Proxy (handles connection pooling)

  Read/Write split:
    Writer endpoint → all INSERT/UPDATE/DELETE
    Reader endpoint → all SELECT (analytics, reporting)

  Performance Insights: visualize DB load, identify slow queries
  Enhanced Monitoring: OS-level metrics (1-second granularity)

SECURITY:
  Always in PRIVATE subnet (no public access)
  Security Group: allow only from App Security Group
  Encryption at rest: KMS (enable at creation; can't enable post-creation without restore)
  Encryption in transit: SSL/TLS (enforce with `rds.force_ssl=1` parameter)
  IAM Database Authentication: authenticate with IAM token instead of password
  Secrets Manager: store and rotate DB credentials automatically

BACKUP:
  Automated backups: 1-35 day retention window
  Manual snapshots: retained until explicitly deleted
  PITR: restore to any second within backup retention window

  For cross-region PITR: enable automated backup replication to another region
```

---

### 8. AWS Architecture Example

```
PRODUCTION 3-TIER APP:
  [App Servers (ECS)]
      ↓ writes
  [Aurora MySQL Cluster — Writer Endpoint]
      ↓ sync
  [Aurora — Standby (Multi-AZ, different AZ)]
      ↓ async
  [Aurora Read Replica × 2]  ← App reads from [Reader Endpoint]

  [RDS Proxy] (for Lambda → RDS connection pooling)
  [Secrets Manager] → auto-rotates DB password every 30 days

DISASTER RECOVERY:
  Option 1: Read Replica in different region → promote on failure
            RPO: seconds; RTO: 15 minutes

  Option 2: Aurora Global Database
            Primary: us-east-1
            Secondary: eu-west-1 (reads served locally)
            Failover: promote secondary in < 1 min
            RPO: < 1 second; RTO: < 1 minute

MONITORING:
  CloudWatch → DB CPU, connections, freeable memory, replica lag
  Alert: CPU > 70%, connections > 80% of max, replica lag > 30s
  Performance Insights: top SQL queries by load
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"RDS is AWS's managed relational database — it handles backups, patching, Multi-AZ replication, and failover so I focus on the data model and queries. For new cloud-native apps, I use Aurora over standard MySQL/PostgreSQL — it's 3-5x faster, has faster failover (<30s), and auto-grows storage._
>
> _For HA: Multi-AZ gives a synchronous standby with auto-failover in 1-2 minutes. For scale: read replicas offload SELECT queries — up to 15 for Aurora. For Lambda: always add RDS Proxy between Lambda and Aurora to prevent connection exhaustion._
>
> _For security: DB in private subnets, KMS encryption, Secrets Manager for credential rotation."_

---

### 10. Common Interview Questions

**Q1: What is the difference between RDS Multi-AZ and Read Replica?**

> Multi-AZ: synchronous replication to a standby in another AZ. The standby is NOT accessible for reads — it's purely for high availability. On primary failure, RDS automatically fails over (DNS update) in 1-2 minutes. Read Replica: asynchronous replication to one or more copies. These ARE accessible for reads. They're for scaling read throughput and can be in different regions. They don't provide automatic failover (you must manually promote). In production: use BOTH — Multi-AZ for HA, read replicas for read scale. Misconception: Multi-AZ does NOT improve read performance.

**Q2: How do you minimize downtime when upgrading RDS?**

> For minor version upgrades: enable `auto minor version upgrade` — RDS applies during the maintenance window. Downtime: ~30-60 seconds for Multi-AZ (failover to standby, then upgrade primary). For major version upgrades: (1) Create read replica → upgrade the replica (replica downtime, not primary). (2) Test application against upgraded replica. (3) Promote replica and switch application traffic (Blue/Green). (4) RDS Blue/Green Deployment feature: creates a staging environment (Green) with the new version; atomic switchover with <1 minute downtime. Always test major upgrades in staging first — some queries behave differently across PostgreSQL versions.

**Q3: How would you handle a sudden 10× increase in DB reads?**

> Add read replicas (Aurora: up to 15; RDS: up to 5). Update application to route read queries to the Aurora reader endpoint (load-balanced across all replicas). Add caching layer: ElastiCache Redis in front of DB for frequently-read data. RDS Proxy: if using Lambda, add RDS Proxy to pool connections. Long-term: partition hot tables, add DB indexes on query patterns. If reads are for analytics/reporting: set up a dedicated read replica for analytics and route those queries there — keeps analytics load from affecting production queries.

---

> **Next Topic →** [06 · DynamoDB](./06-dynamodb.md)
