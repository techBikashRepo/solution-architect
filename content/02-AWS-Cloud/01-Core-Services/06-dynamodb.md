# DynamoDB — Amazon DynamoDB

> **Subject**: AWS Cloud · **Group**: ☁️ Core Services · **Topic**: 06 of 12
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Amazon DynamoDB** is AWS's fully managed NoSQL database — serverless, horizontally scaled, single-digit millisecond performance at any scale. No servers to manage, no capacity planning for storage.

DynamoDB is a key-value and document database designed for applications that need consistent, fast performance at any size.

---

### 2. Key Concepts

| Concept                        | Detail                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| **Table**                      | The top-level container (like a SQL table but schema-less)                 |
| **Item**                       | A row — up to 400KB per item                                               |
| **Attribute**                  | A column value (String, Number, Boolean, List, Map, Set)                   |
| **Partition Key (PK)**         | Required primary key; determines which partition stores the item           |
| **Sort Key (SK)**              | Optional composite key; allows range queries within a partition            |
| **GSI**                        | Global Secondary Index — alternate PK/SK for different query patterns      |
| **LSI**                        | Local Secondary Index — alternate SK with same PK; must define at creation |
| **Read Capacity Units (RCU)**  | 1 strongly consistent read of 4KB; 0.5 RCU for eventual                    |
| **Write Capacity Units (WCU)** | 1 write of 1KB                                                             |
| **On-Demand mode**             | Auto-scales instantly; pay per request (no capacity planning)              |
| **Provisioned mode**           | Set RCU/WCU; auto-scaling available; cheaper for predictable load          |

---

### 3. Data Modeling Philosophy

```
RELATIONAL MODEL (SQL):
  Normalize data → multiple tables → JOIN at query time

  Users table: user_id, name, email
  Orders table: order_id, user_id, status
  Items table: item_id, order_id, product, qty

  Query "get user and their orders": 2 JOINs

DYNAMODB MODEL (single-table design):
  Denormalize → everything in ONE table
  Model based on ACCESS PATTERNS (define queries first, then schema)

  PK          SK                  Attributes
  USER#123    PROFILE             {name, email}
  USER#123    ORDER#ord-456       {status, total, date}
  USER#123    ORDER#ord-789       {status, total, date}
  ORDER#456   ITEM#prod-111       {qty, price, product_name}
  ORDER#456   ITEM#prod-222       {qty, price, product_name}

  Query "get user profile + all orders":
    Query(PK="USER#123") → returns profile + all order items ✅

  This is the "single-table design" pattern — one table, many entity types
```

---

### 4. Access Patterns (Design First, Schema Second)

```
DEFINE ACCESS PATTERNS BEFORE CREATING TABLE:

  AP1: Get user profile by user_id
       → Query: PK=USER#{user_id}, SK=PROFILE

  AP2: Get all orders for a user
       → Query: PK=USER#{user_id}, SK begins_with ORDER#

  AP3: Get order detail (order + items)
       → Query: PK=ORDER#{order_id}

  AP4: Get order by status (e.g., "all PENDING orders")
       → Not supported by PK/SK above
       → Create GSI: PK=status, SK=created_at
       → Query GSI: PK=PENDING, SK between(start, end)

  RULE: Every access pattern must have a corresponding PK/SK or GSI.
        If you need to query by a field, it must be a PK, SK, or indexed.
```

---

### 5. DynamoDB Features

| Feature                           | What it Does                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| **DynamoDB Streams**              | Change data capture — events on every insert/update/delete           |
| **TTL**                           | Automatically delete items after a Unix timestamp                    |
| **Global Tables**                 | Multi-region active-active replication (<1s lag)                     |
| **DAX**                           | In-memory cache (microsecond reads); no code change for cached reads |
| **Transactions**                  | ACID across up to 25 items in one request                            |
| **Conditional Writes**            | `ConditionExpression: attribute_not_exists(PK)` — atomic check+write |
| **PartiQL**                       | SQL-like query language for DynamoDB                                 |
| **Point-in-Time Recovery (PITR)** | Restore table to any second in the last 35 days                      |

---

## PART 2

---

### 6. When to Use DynamoDB

✅ **Use DynamoDB when**:

- Massive scale (millions of requests/sec, TB+ of data)
- Simple, known access patterns (always look up by user_id)
- Low, predictable latency at any scale
- Serverless / event-driven architectures
- Key-value: sessions, shopping carts, game state
- Time-series data with TTL cleanup
- Global distribution needed (Global Tables)

❌ **Don't use DynamoDB when**:

- Complex queries, ad-hoc filtering, JOINs → use **RDS/Aurora**
- Data relationships requiring multi-table JOINs → **PostgreSQL**
- Analytics on large datasets → **Redshift** or **Athena + S3**
- Item > 400KB → use S3 + DynamoDB (store S3 key in DynamoDB)

---

### 7. Common Pitfalls and Solutions

| Pitfall                      | Problem                                                   | Solution                                                                  |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Hot partition**            | All requests go to same partition key (e.g., PK=status)   | Add random suffix to PK ("status#0" through "status#9") then query all 10 |
| **Scan**                     | Full table scan is expensive, slow, unscalable            | Never scan production tables; use Query (PK required) or GSI              |
| **Large item**               | Item > 400KB → `ItemSizeTooLarge` error                   | Store large attributes in S3; store S3 key in DynamoDB item               |
| **GSI throttling**           | GSI has its own capacity; writes to GSI keys can throttle | Provision capacity for GSIs independently; or use On-Demand mode          |
| **Eventual read stale data** | Default reads are eventually consistent                   | Add `ConsistentRead=True` for strongly consistent reads (costs 2× RCU)    |

---

### 8. AWS Architecture Example

```
SESSION MANAGEMENT:
  Key: "session:{session_id}"
  Value: {user_id, permissions, last_active}
  TTL: 86400 (24 hours auto-delete)

  On every request: UpdateItem → set last_active=now, extend TTL
  Session expiry: automatic (no cleanup Lambda needed)

EVENT SOURCING (DynamoDB Streams):
  [App] → write order event → [DynamoDB: orders]
  [DynamoDB Streams] → trigger → [Lambda: event-processor]
  [Lambda] → update read model → [DynamoDB: order-views]
           → publish to SNS for downstream services

GLOBAL TABLES (multi-region):
  us-east-1 (primary region, writes)
  eu-west-1 (European users read locally)
  ap-southeast-1 (APAC users read locally)

  All regions accept writes (active-active)
  Replication: typically < 1 second
  Conflict: Last-Write-Wins (LWW) by timestamp

  Use case: global user sessions, player state, real-time inventory (with LWW accepted)

CAPACITY PLANNING:
  On-Demand: new services, unpredictable traffic, spiky workloads
  Provisioned + Auto-Scaling: steady-state production (20-40% cheaper)

  Auto-Scaling config:
    Min capacity: 100 RCU / 50 WCU
    Max capacity: 10,000 RCU / 5,000 WCU
    Target utilization: 70%
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"DynamoDB is AWS's serverless NoSQL — single-digit millisecond performance at any scale, no capacity planning for storage. The key difference from SQL: I design the data model around access patterns, not normalization. I define what queries I need first, then design the primary key and GSIs to satisfy those access patterns._
>
> _Common use cases: user sessions (with TTL auto-expiry), shopping carts, game state, anything that's primarily key-value lookup at massive scale. Not suitable for complex joins or ad-hoc queries — that's Aurora's territory._
>
> _In production: On-Demand mode for unpredictable traffic, Provisioned with auto-scaling for steady-state, Global Tables for multi-region active-active."_

---

### 10. Common Interview Questions

**Q1: Explain single-table design in DynamoDB.**

> In relational DBs, you normalize into multiple tables and JOIN at query time. In DynamoDB, joins don't exist — you denormalize and overload a single table with multiple entity types. The table has a PK and SK. Different entity types use different PK/SK patterns (e.g., `USER#123 / PROFILE` for user profile, `USER#123 / ORDER#456` for an order). When you query by user_id, you get all their data in one request. This minimizes round trips. The key discipline: define ALL access patterns before modeling, because you can't query attributes that aren't indexed.

**Q2: When would you use a GSI vs LSI in DynamoDB?**

> LSI (Local Secondary Index): same partition key, different sort key. Created at table creation time — can't add later. Shares throughput with the base table. Useful when you need multiple sort orders for items within the same partition. GSI (Global Secondary Index): different partition key and sort key. Can be added after table creation. Has its own throughput capacity. Allows queries on completely different key patterns. In practice: use GSI for almost everything (more flexible, addable post-creation, no partition dependency). Use LSI only when you specifically need to query items within the same partition by an alternate sort key and need strongly consistent reads (GSIs only support eventual consistency).

**Q3: How do you handle hot partitions in DynamoDB?**

> Hot partition: too many requests go to the same partition key. Example: using `status` as PK — all PENDING orders go to one partition. Solutions: (1) Write sharding: append a random suffix to the PK (`status#1` through `status#9`). Distribute writes. To read all PENDING orders, query all 10 shards and merge. (2) Composite PK: combine high-cardinality attribute with the hot attribute (`PENDING#user-123`). (3) Use a time-based component in PK: `status#2025-01` — naturally distributes over time. Root cause: DynamoDB partitions based on PK hash. Any PK with predictable values or low cardinality can create hot partitions.

---

> **Next Topic →** [07 · VPC](./07-vpc.md)
