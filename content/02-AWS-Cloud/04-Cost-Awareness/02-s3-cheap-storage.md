# S3 Cheap Storage — Cost-Effective Data Storage

> **Subject**: AWS Cloud · **Group**: 💰 Cost Awareness · **Topic**: 02 of 2
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**S3 is AWS's cheapest durable object storage**, with storage costs starting at $0.023/GB/month for Standard and dropping to $0.0036/GB/month for Glacier Deep Archive. Knowing when and how to use S3's tiered storage model can slash storage costs by 50-95%.

```
STORAGE COST SPECTRUM (us-east-1, 2024):
  S3 Standard:             $0.023/GB/month   ← hot data, frequent access
  S3 Standard-IA:          $0.0125/GB/month  ← infrequent access, rare retrieval
  S3 One Zone-IA:          $0.01/GB/month    ← infrequent, can tolerate AZ loss
  S3 Intelligent-Tiering:  $0.023 → auto     ← unknown access patterns
  S3 Glacier Instant:      $0.004/GB/month   ← archive, retrieve in ms
  S3 Glacier Flexible:     $0.0036/GB/month  ← archive, retrieve in hours
  S3 Glacier Deep Archive: $0.00099/GB/month ← long-term, retrieve in 12h
                           ↑ 96% cheaper than Standard!
```

---

### 2. Storage Classes Compared

| Class                    | Retrieval        | Min Storage Duration | Use Case                         |
| ------------------------ | ---------------- | -------------------- | -------------------------------- |
| **Standard**             | Immediate        | None                 | Active data, web assets          |
| **Standard-IA**          | Immediate        | 30 days              | Backups accessed < monthly       |
| **One Zone-IA**          | Immediate        | 30 days              | Reproducible infrequent data     |
| **Intelligent-Tiering**  | Immediate (auto) | None                 | Unknown/changing access patterns |
| **Glacier Instant**      | Milliseconds     | 90 days              | Archives with occasional access  |
| **Glacier Flexible**     | Min to 12 hours  | 90 days              | Quarterly reports, backups       |
| **Glacier Deep Archive** | 12-48 hours      | 180 days             | Compliance, 7-year retention     |

> **Important**: Standard-IA and Glacier have minimum storage duration charges. If you delete a 30-day Standard-IA object after 10 days, you still pay for 30 days.

---

### 3. S3 Lifecycle Policies

```
LIFECYCLE RULES (automate tier transitions):
  Example: application logs

  Days 0-30:   S3 Standard    ($0.023/GB) — recent logs, queried frequently
  Days 31-90:  S3 Standard-IA ($0.0125/GB) — older logs, rarely queried
  Days 91-365: S3 Glacier Flexible ($0.0036/GB) — compliance archive
  Day 366+:    DELETE (if not needed) or Glacier Deep Archive

  LIFECYCLE RULE (JSON / Console):
    Transition to Standard-IA after 30 days
    Transition to Glacier Flexible after 90 days
    Expire (delete) after 365 days

  LIFECYCLE MATH (1TB of logs/month):
    Without lifecycle: 1TB × $0.023 × 12 months = $276/year (grows each year)
    With lifecycle: weighted average ~$0.007/GB = $84/year → 70% saving

COST OF NOT DOING THIS:
  Common mistake: put everything in S3 Standard, never delete
  1PB of old data × $0.023 = $23,000/month just for storage
  With Glacier Deep Archive: $1,000/month → $22,000/month saving
```

---

### 4. S3 Intelligent-Tiering

```
INTELLIGENT-TIERING (let AWS optimize for you):
  AWS monitors access patterns
  Automatically moves objects between tiers:
    Frequent Access tier:    same as Standard ($0.023/GB)
    Infrequent Access tier:  after 30 days idle ($0.0125/GB)
    Archive Instant tier:    after 90 days idle ($0.004/GB)
    Archive tier (opt-in):   after 90-180+ days ($0.0036/GB)
    Deep Archive tier (opt-in): after 180+ days ($0.00099/GB)

  Monitoring fee: $0.0025 per 1,000 objects/month

  WHEN TO USE:
    Unknown access patterns
    Mixed-use data (some files accessed daily, others never touched)
    Don't want to manually manage lifecycle rules
    Large number of objects with varying access frequency

  WHEN TO AVOID:
    Objects < 128KB (monitoring fee dominates cost)
    Objects with very predictable access patterns (use explicit rules instead)
    Short-lived objects (< 30 days) — use Standard
```

---

### 5. S3 Request Costs and Data Transfer

```
S3 PRICING BEYOND STORAGE:
  PUT/COPY/POST: $0.005 per 1,000 requests
  GET/SELECT:    $0.0004 per 1,000 requests

  DATA TRANSFER:
    S3 → Internet:  $0.09/GB (first 10TB/month)
    S3 → CloudFront: FREE (huge benefit of using CloudFront)
    S3 → EC2 same region: FREE
    S3 → EC2 different region: $0.02/GB
    CloudFront → Internet: $0.085/GB (cheaper + eliminates S3 GET costs)

  S3 → CLOUDFRONT OPTIMIZATION:
    Without CloudFront: user downloads 1GB from S3 = $0.09 data transfer + GET fee
    With CloudFront: S3→CloudFront = free; CloudFront→user = $0.085 (cheaper)
    PLUS: cached objects cost $0 for cache hits (no S3 GET requests at all)

REQUESTER PAYS:
  Normal: bucket OWNER pays data transfer
  Requester Pays: requester's AWS account pays for data transfer
  Use for: large public datasets (AWS Open Data), shared datasets between teams
```

---

## PART 2

---

### 6. Cost Scenarios

```
SCENARIO 1: Application log archival (100GB/day)
  Storage after 1 year: ~36TB
  Without policy (all Standard): 36TB × $0.023 = $828/month
  With lifecycle:
    0-30d Standard: 3TB × $0.023 = $69
    31-90d IA: 6TB × $0.0125 = $75
    91-365d Glacier: 27TB × $0.0036 = $97
    Total: ~$241/month → 71% saving

SCENARIO 2: Database backups (50GB/backup, daily, 90-day retention)
  Total: 4.5TB
  All Standard: $103.50/month
  Lifecycle: transition to Standard-IA after 7 days
    Current week (7 backups × 50GB): 350GB × $0.023 = $8.05
    Older (4150GB × $0.0125) = $51.88
    Total: ~$60/month → 42% saving

SCENARIO 3: Static website assets
  100GB of images/videos, CDN-served
  S3 Standard: $2.30/month storage
  CloudFront serving: 10TB/month CDN transfer = $850 (at $0.085/GB)

  Cost optimization: use CloudFront for delivery (free S3→CF transfer)
  vs direct S3: would cost $900/month in S3 GET + data transfer
  CloudFront with caching: 90% cache hit rate → only 1TB from S3
  Actual cost: $85 CDN + $0.40 S3 origin requests = $85.40 vs $900 → 90% saving
```

---

### 7. S3 Cost Anti-Patterns

```
ANTI-PATTERN 1: Using S3 Standard for everything
  EBS snapshots, CloudWatch Logs exports, CloudTrail logs, ALB access logs
  → These are write-once, read-rarely → should be in IA or Glacier
  → Set lifecycle rules on ALL log/backup buckets from day 1

ANTI-PATTERN 2: Versioning without lifecycle on old versions
  S3 Versioning: every PUT keeps old version
  Without lifecycle on old versions: unbounded cost growth
  FIX: lifecycle rule on non-current versions
    Transition non-current to Standard-IA after 30 days
    Expire non-current versions after 90 days

ANTI-PATTERN 3: Small objects in Glacier
  Glacier has 40KB overhead per object (metadata)
  10M objects × 40KB = 400GB of overhead billing
  FIX: don't archive millions of tiny files individually
       Aggregate into tar/zip archives first, then store in Glacier

ANTI-PATTERN 4: Large data transfer to internet via S3 directly
  1TB S3 → internet: $92 (S3 data transfer)
  1TB S3 → CloudFront → internet: $85 + no S3 transfer fee = $85
  For repeated access: CloudFront caching means far less origin data transfer

ANTI-PATTERN 5: Cross-region replication for all data
  CRR copies everything to another region
  Storage cost doubles; data transfer cost: $0.02/GB
  FIX: CRR only for critical data requiring DR; use lifecycle rules, not full replication
```

---

### 8. AWS Architecture Example

```
COST-OPTIMIZED S3 DESIGN:
─────────────────────────────────────────────────────────
  BUCKET STRATEGY:
    myapp-frontend:         Static website → CloudFront + OAC
    myapp-uploads:          User uploads → lifecycle after 30d to IA
    myapp-logs:             ALB/CloudFront/Lambda logs → lifecycle 30d IA, 90d Glacier
    myapp-backups:          RDS snapshots export → lifecycle 7d IA, 30d Glacier, delete 365d
    myapp-data-warehouse:   Parquet data → Glacier Instant (accessed via Athena)

  LIFECYCLE RULES (myapp-logs):
    Rule 1: Transition to Standard-IA after 30 days
    Rule 2: Transition to Glacier Flexible after 90 days
    Rule 3: Expire after 365 days (or 2555 days for compliance)

  LIFECYCLE RULES (myapp-uploads):
    Rule 1: Transition to Standard-IA after 30 days (user created content, rarely revisited)
    Rule 2: Transition to Glacier Instant after 90 days
    Rule 3 (old versions): Expire non-current after 7 days

  ATHENA QUERY COST (vs RDS for analytics):
    S3 Parquet + Athena: $5 per TB scanned
    Query 100GB of partitioned Parquet: $0.50
    RDS for same data: $200+/month just for instance
    → S3 + Athena is 99% cheaper for analytical queries

  MONITORING:
    S3 Storage Lens: cross-bucket visibility into storage patterns
    Cost Explorer: S3 cost breakdown by bucket, operation, and storage class
    CloudWatch: BucketSizeBytes metric by StorageType (track each class separately)
    Budget Alert: alert if S3 cost > $500/month
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"S3 storage cost optimization is about matching access patterns to storage class. S3 Standard ($0.023/GB) for active data; Standard-IA ($0.0125) after 30 days idle; Glacier Flexible ($0.0036) for archives; Glacier Deep Archive ($0.001) for 7-year compliance. That's a 95% cost difference._
>
> _Key tool: S3 Lifecycle rules — set them on every bucket from day 1. Log buckets, backup buckets, and CloudTrail exports should all transition automatically. Enable S3 Versioning but add a lifecycle rule to expire old versions within 30-90 days._
>
> _For analytics: don't store data in RDS — use S3 Parquet + Athena ($5/TB scanned vs $200+/month for RDS). For delivery: always use CloudFront in front of S3 — free S3-to-CF transfer plus caching reduces GET costs by 90%."_

---

### 10. Common Interview Questions

**Q1: How would you optimize costs for a bucket storing ALB access logs?**

> ALB logs are write-once, read-rarely — perfect for tiered storage. Day 1: set lifecycle rule: transition to S3 Standard-IA after 30 days ($0.023 → $0.0125). Transition to Glacier Flexible after 90 days ($0.0036). Delete after 365 days (or keep longer for compliance). Result: a bucket receiving 10GB/day of logs costs ~$50-70/month vs ~$280/month without lifecycle rules (70% saving). Additional optimization: enable S3 Intelligent-Tiering if unsure about access patterns — it auto-manages transitions. Enable S3 Storage Lens to monitor which storage classes are being used and identify buckets that haven't been optimized. Never put ALB/CloudFront/CloudTrail logs in Standard — they're automatically write-once; set lifecycle rules before the bucket fills up.

**Q2: What is S3 Intelligent-Tiering and when should you use it?**

> S3 Intelligent-Tiering monitors object access patterns and automatically moves objects between storage tiers: Frequent Access (Standard equivalent), Infrequent Access (after 30 days without access), Archive Instant (after 90 days). You can optionally enable Archive and Deep Archive tiers. It charges $0.0025 per 1,000 objects/month for monitoring. Use it when: you don't know which objects will be accessed (e.g., user-uploaded content — some users never revisit, others revisit constantly), or managing lifecycle rules manually is impractical (millions of objects with varying access patterns). Don't use it when: objects are < 128KB (monitoring fee exceeds savings), objects have very predictable access patterns (just use lifecycle rules), or objects exist for < 30 days (S3 Standard is cheaper for short-lived objects).

**Q3: How would you design a cost-effective data lake on AWS?**

> S3 as the storage layer (not HDFS, not EBS — S3 is 10-20× cheaper per GB). Organize by partitioned structure: `s3://datalake/events/year=2024/month=01/day=15/` — Athena and Glue skip irrelevant partitions. Use Parquet or ORC format (columnar): 10× compression vs CSV; Athena only reads relevant columns → 90% less data scanned → 90% lower Athena cost. Apply lifecycle rules: recent data in Standard; data > 90 days → Standard-IA; > 1 year → Glacier Instant (Athena can query Glacier Instant). Use AWS Glue for ETL (serverless, pay per DPU-hour). Use Athena for queries ($5/TB scanned). Compare: RDS for 100TB analytical data = $50,000+/month; S3 + Athena = $2,300/month storage + $50-500/month queries = 95% cheaper. For frequent complex analytics: add Redshift Spectrum or Redshift Serverless on top of S3.

---

> ✅ **Cost Awareness Complete (2/2)**
> ✅ **AWS Cloud Subject Complete (17/17 topics)**
> **Next Subject →** [DSA](../../03-DSA/)
