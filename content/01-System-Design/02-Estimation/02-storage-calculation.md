# Storage Calculation

> **Subject**: System Design · **Group**: 🔥 Estimation (MUST) · **Topic**: 02 of 03
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

Storage estimation calculates **how much disk/DB space** your system will need — today, in 1 year, in 5 years.

It drives decisions on:

- Which database to use
- Whether to partition/shard
- How long to retain data
- What data to archive to cold storage

---

### 2. The Formula

$$\text{Storage/day} = \text{writes/day} \times \text{avg object size}$$

$$\text{Total storage (5 years)} = \text{storage/day} \times 365 \times 5$$

Add **20–30% overhead** for indexes, metadata, replication.

---

## PART 2

---

### 3. Size Reference Cheat Sheet (Memorize)

| Data Type                           | Typical Size               |
| ----------------------------------- | -------------------------- |
| User record (name, email, metadata) | 1 KB                       |
| Tweet / short message               | 300 bytes → use **0.5 KB** |
| Product listing (text)              | 2–5 KB                     |
| Profile photo (compressed)          | 200 KB                     |
| Standard photo                      | 1–5 MB                     |
| HD video (1 minute)                 | ~100 MB                    |
| 4K video (1 minute)                 | ~400 MB                    |

---

### 4. Worked Example — "Design Twitter"

```
Inputs:
  - 17,000 write RPS (from RPS estimation)
  - Average tweet: 0.5 KB

Storage/day:
  17,000 writes/sec × 86,400 sec/day × 0.5 KB
  = 17,000 × 86,400 × 500 bytes
  ≈ 17,000 × 86,400 × 0.0005 MB
  ≈ 734,000 MB/day ≈ 734 GB/day

1 year:  734 GB × 365 = ~268 TB
5 years: 268 TB × 5  = ~1.34 PB

+ 30% overhead (indexes, replication): ~1.75 PB over 5 years

Decision: Cannot fit in a single DB → sharding required
Media (photos/videos) → S3 (object storage), not DB
```

---

### 5. Storage Tiering Strategy

| Tier        | Age         | Storage                       | Cost     |
| ----------- | ----------- | ----------------------------- | -------- |
| **Hot**     | 0–30 days   | SSD-backed DB (RDS, DynamoDB) | High     |
| **Warm**    | 1–12 months | S3 Standard or EFS            | Medium   |
| **Cold**    | 1–5 years   | S3 Glacier                    | Low      |
| **Archive** | 5+ years    | S3 Glacier Deep Archive       | Very Low |

---

### 6. Interview-Ready Explanation (30 sec)

> _"For storage: assume 17,000 write RPS, each tweet is ~0.5 KB. That's 17K × 86,400 × 0.5 KB ≈ 730 GB/day. In 5 years, we're looking at ~1.3 PB. This means we need sharding on the DB side, and media should go to S3 — not the DB. For cost, data older than 30 days moves to S3 Glacier."_

---

### 7. Common Interview Questions

**Q1: How do you estimate storage for a photo-sharing app like Instagram?**

> 100M DAU, each user uploads 1 photo/day average. 100M photos/day × 1 MB = 100 TB/day. 5 years = 182 PB. Store originals on S3, generate thumbnails (50 KB each) at upload time — reduces serving cost 20x. CDN (CloudFront) serves cached thumbnails. Only originals stored long-term; thumbnails regenerated on-demand if deleted.

**Q2: When do you shard a database?**

> When a single DB instance cannot hold the data (storage limit) or handle the write throughput. Rule of thumb: consider sharding when DB exceeds 1–2 TB or write RPS exceeds ~5,000 on a single primary. For DynamoDB, sharding is automatic — just ensure high-cardinality partition keys.

---

> **Next Topic →** [03 · Read vs Write Ratio](./03-read-write-ratio.md)
