# Sharding

> **Subject**: System Design · **Group**: Data Layer · **Topic**: 02 of 04
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Sharding** is horizontal partitioning of a database — splitting data across multiple DB instances (shards) so each shard holds a **subset of the data**. Each shard is a separate, independent database node.

Unlike replication (copies of same data), sharding splits data. Shard 1 has users A–M, Shard 2 has users N–Z.

---

### 2. Why is it needed?

| Limit Hit                                  | Sharding Solution                         |
| ------------------------------------------ | ----------------------------------------- |
| Single DB can't store 10TB+                | Split data: each shard stores a portion   |
| Single primary can't handle 10K+ write RPS | Each shard handles a fraction of writes   |
| Query latency on massive tables            | Smaller tables per shard = faster queries |

Sharding is the answer when **vertical scaling hits the ceiling and read replicas don't help writes**.

---

### 3. Where is it used?

| Use Case                     | Shard Key         | Reason                                           |
| ---------------------------- | ----------------- | ------------------------------------------------ |
| **User accounts** (1B users) | `user_id`         | Evenly distributed, user data isolated per shard |
| **Multi-tenant SaaS**        | `tenant_id`       | Each tenant's data on same shard                 |
| **Chat messages**            | `conversation_id` | All msgs in a conversation on one shard          |

---

### 4. How Does it Work?

```
RANGE-BASED SHARDING:
  Shard 1: user_id 1 – 10,000,000
  Shard 2: user_id 10,000,001 – 20,000,000
  Shard 3: user_id 20,000,001 – 30,000,000
  ✅ Simple, range queries work well
  ❌ Hotspot: shard 3 (latest users) gets all new writes

HASH-BASED SHARDING (most common):
  shard = hash(user_id) % total_shards
  user_id=1001 → hash=4523 → 4523 % 3 = 1 → Shard 1
  user_id=1002 → hash=9812 → 9812 % 3 = 2 → Shard 2
  ✅ Even distribution
  ❌ Adding shards requires re-hashing all data (use consistent hashing to mitigate)

CONSISTENT HASHING:
  Map shards and keys on a ring (0–2^32)
  Each key routes to nearest shard clockwise
  Adding a shard: only adjacent shard's keys need to move
  ✅ Minimizes data movement when resharding
  → Used by Cassandra, DynamoDB internally, Redis Cluster

DIRECTORY-BASED (Lookup Service):
  Separate mapping table: user_id → shard_id
  ✅ Most flexible; can move data between shards freely
  ❌ Lookup service is a SPOF + bottleneck
```

---

### 5. Types / Strategies Comparison

| Strategy            | Distribution      | Range Queries     | Resharding Cost | Use When                    |
| ------------------- | ----------------- | ----------------- | --------------- | --------------------------- |
| **Range**           | Uneven (hotspots) | ✅ Easy           | High            | Time-series, ordered data   |
| **Hash**            | Even              | ❌ Scatter-gather | High            | General purpose, user data  |
| **Consistent Hash** | Even              | ❌                | Low             | Dynamic shard counts        |
| **Directory**       | Configurable      | ✅ (via lookup)   | Low             | Complex routing needs       |
| **Geo-based**       | By region         | ✅ Within region  | Medium          | Data residency requirements |

---

## PART 2

---

### 6. Trade-offs

#### ✅ Pros

| Advantage                        | Detail                                          |
| -------------------------------- | ----------------------------------------------- |
| Unlimited horizontal write scale | Write load spread across N shards               |
| Smaller tables                   | Faster queries, smaller indexes per shard       |
| Fault isolation                  | Shard 1 down → only affects its subset of users |

#### ❌ Cons / When NOT to use

| Disadvantage                          | Detail                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Cross-shard queries are expensive** | JOIN across shards = scatter-gather → slow                                                      |
| **Cross-shard transactions**          | Distributed transactions (2PC) are complex and slow                                             |
| **Resharding is painful**             | Adding shards requires moving data                                                              |
| **Operational complexity**            | N databases to monitor, backup, maintain                                                        |
| **Don't shard prematurely**           | Single DB handles TB of data; shard only when you've exhausted vertical scaling + read replicas |

---

### 7. Failure Scenarios

| Failure                           | Impact                                 | Handling                                                                    |
| --------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| **One shard crashes**             | ~1/N users affected (not all)          | Shard replication (each shard has primary + replica); automatic failover    |
| **Hot shard (uneven load)**       | One shard overloaded while others idle | Re-shard with better key; virtual shards; add randomness to shard key       |
| **Cross-shard transaction fails** | Partial write on one shard, not other  | Saga pattern: compensating transactions; avoid cross-shard writes in design |
| **Shard key change needed**       | Major migration                        | Plan shard key at design time; changing it later is very painful            |
| **Adding new shard**              | Must move data                         | Consistent hashing minimizes movement; do during low-traffic window         |

---

### 8. AWS Mapping

| Need                             | AWS Approach                                             | Notes                                                                    |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Auto-sharded DB (serverless)** | **DynamoDB**                                             | Transparent sharding by partition key; no manual shard management        |
| **Manual sharding (PostgreSQL)** | **RDS (multiple instances)** + application-level routing | App determines which RDS instance based on shard key                     |
| **Sharded Redis**                | **ElastiCache Redis Cluster**                            | Consistent hashing across 16,384 hash slots; up to 500 nodes             |
| **Managed sharding (MySQL)**     | **Aurora Sharding** (via application)                    | Aurora doesn't shard automatically; use Vitess on EKS for MySQL sharding |
| **Cassandra-style**              | **Amazon Keyspaces**                                     | Wide-column, consistent hashing managed by AWS                           |

**DynamoDB — the "sharding without thinking" option:**

```
Table: users
Partition Key: user_id (high cardinality)

DynamoDB internally:
  - Splits table into partitions (shards) automatically
  - Each partition: 10GB max, 3,000 RCU + 1,000 WCU
  - When partition is full or hot: auto-splits

You never manage shards — DynamoDB does it transparently
Cost: design your partition key for even distribution
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"Sharding is horizontal partitioning — splitting data across multiple DB instances so each shard holds a subset. Unlike replication which copies all data, sharding divides it. I use a shard key to route writes: hash-based sharding gives even distribution._
>
> _The key trade-off: cross-shard queries are expensive — you have to scatter-gather across all shards. So the shard key must be chosen so the most common queries hit a single shard. In practice, I avoid manual sharding by using DynamoDB, which shards automatically by partition key. For SQL, I only shard when vertical scaling is exhausted."_

---

### 10. Common Interview Questions

**Q1: How do you handle a cross-shard JOIN?**

> Avoid it at the data model level — denormalize so related data lives on the same shard (same `user_id` as shard key). If unavoidable: scatter-gather (query all shards in parallel → merge in application). For analytics requiring cross-shard aggregation: stream data to a warehouse (Redshift, Athena) where full scans are expected.

**Q2: What is the difference between sharding and partitioning?**

> Partitioning: splitting a table within a single DB instance (PostgreSQL table partitioning by date). Data stays on one server; easier to manage. Sharding: splitting across multiple independent DB instances on different servers. Both reduce table size, but sharding scales write throughput; partitioning improves query performance on one server.

**Q3: What makes a good vs bad shard key?**

> Good: high cardinality, evenly distributed, aligns with query patterns, rarely changes. Example: `user_id` UUID. Bad: low cardinality (`country_code` — US gets 80% of writes), monotonically increasing integers (all new writes go to last shard — hotspot), mutable values (user changes country → must move shard).

---

> **Next Topic →** [03 · Replication](./03-replication.md)
