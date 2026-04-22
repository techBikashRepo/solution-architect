# Partitioning Basics

> **Subject**: System Design · **Group**: Data Layer · **Topic**: 04 of 04
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Partitioning** divides a large table into smaller, more manageable sub-tables — **within a single database instance**. The DB engine routes queries to the correct partition automatically.

> Key distinction: **Partitioning = same DB, split table. Sharding = different DB instances.**

---

### 2. Why is it needed?

| Without Partitioning                            | With Partitioning                                      |
| ----------------------------------------------- | ------------------------------------------------------ |
| Full table scan on 1B row orders table          | Scan only the relevant partition (e.g., current month) |
| Deleting old data: slow DELETE on massive table | Drop entire partition instantly                        |
| All queries compete for table-level resources   | Queries isolated to smaller partitions                 |

---

### 3. How Does it Work?

```
RANGE PARTITIONING (by date — most common):
  orders_2023 → rows where created_at in 2023
  orders_2024 → rows where created_at in 2024
  orders_2025 → rows where created_at in 2025

  Query: SELECT * FROM orders WHERE created_at > '2025-01-01'
  → DB scans only orders_2025, not all 3 partitions ✅ (partition pruning)

LIST PARTITIONING (by discrete value):
  orders_us   → country = 'US'
  orders_eu   → country in ('DE', 'FR', 'UK')
  orders_apac → country in ('IN', 'SG', 'AU')

HASH PARTITIONING (by hash of key):
  Hash(user_id) % 4 → assigns to partition 0–3
  Even distribution, no range queries
```

---

### 4. Partitioning vs Sharding

| Dimension              | Partitioning                             | Sharding               |
| ---------------------- | ---------------------------------------- | ---------------------- |
| Location               | Same DB instance                         | Multiple DB instances  |
| Write scaling          | ❌ Same primary                          | ✅ Distributed         |
| Query routing          | Automatic (DB engine)                    | Application-level      |
| Operational complexity | Low                                      | High                   |
| Best for               | Query performance, archival, maintenance | Scale beyond single DB |

---

## PART 2

---

### 5. Trade-offs

#### ✅ Pros

| Advantage              | Detail                                          |
| ---------------------- | ----------------------------------------------- |
| Partition pruning      | Queries scan only relevant partitions           |
| Fast archival/deletion | `DROP TABLE orders_2020` is instant vs `DELETE` |
| Parallel query         | Modern DBs can query partitions in parallel     |
| Index smaller          | Index per partition = smaller, faster B-tree    |

#### ❌ Cons

| Disadvantage                     | Detail                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| **Cross-partition queries**      | Still scans all partitions if partition key not in WHERE                        |
| **Single DB limits still apply** | Partitioning doesn't increase write throughput (same primary)                   |
| **Wrong partition key**          | Choosing a partition key that doesn't match query patterns = no pruning benefit |

---

### 6. AWS Mapping

| Need                                | AWS Approach                                | Notes                                                                   |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| **Table partitioning (PostgreSQL)** | **RDS PostgreSQL** declarative partitioning | Native `PARTITION BY RANGE/LIST/HASH`                                   |
| **DynamoDB partitioning**           | Transparent (managed)                       | DynamoDB auto-partitions by partition key                               |
| **Analytics partitioning**          | **S3 + Athena** (Hive-style partitions)     | `s3://bucket/year=2025/month=04/` → Athena scans only relevant folders  |
| **Redshift**                        | **Distribution + Sort keys**                | Distribution key = which node; sort key = partition pruning within node |

**S3 + Athena partition example (very common in interviews):**

```
S3 path: s3://logs/year=2025/month=04/day=15/

Athena query:
  SELECT * FROM logs
  WHERE year='2025' AND month='04'
  → Only scans April 2025 data, not all 3 years
  → Cost = data scanned × $5/TB

Without partitioning:
  Full S3 bucket scan → expensive + slow
```

---

### 7. Interview-Ready Explanation (30 sec)

> _"Partitioning splits a large table into sub-tables within the same database — the DB engine routes queries to the right partition automatically. Most commonly, I partition by date range so queries for recent data only scan recent partitions, not historical data._
>
> _It's different from sharding: partitioning doesn't increase write throughput since it's still one DB instance, but it dramatically speeds up range queries and makes data archival trivial — you just drop old partitions instantly. On S3 + Athena, Hive-style partitioning by date is essential for cost-effective analytics."_

---

### 8. Common Interview Questions

**Q1: How is partitioning different from an index?**

> An index narrows down rows _within_ a table by creating a lookup structure. Partitioning physically splits the table into sub-tables so the DB doesn't even access irrelevant sub-tables (partition pruning). They complement each other: partition by date → index within each partition for faster row lookup. Partitioning helps with large-scale archival and range scans; indexes help with specific row lookups.

**Q2: When should you partition vs shard?**

> Partition first when: data is large but a single DB can still handle write throughput; you need fast range queries or easy archival. Shard when: write throughput exceeds what one DB can handle, or storage exceeds what one server can hold. Partitioning is simpler to implement and manage — exhaust it before sharding.

---

> ✅ **Data Layer Group COMPLETE (4/4)**
>
> **Next Group →** [05 · Reliability & Failure (🔥 MUST)](../05-Reliability-and-Failure/)
> First topic: [Retry Mechanisms](../05-Reliability-and-Failure/01-retry-mechanisms.md)
