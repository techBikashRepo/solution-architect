# File Upload System — System Design

> **Subject**: System Design · **Group**: 🎯 Must Practice Designs · **Topic**: 06 of 06
> **Status**: ✅ Done

---

## Part 1: Requirements & Estimation

---

### Functional Requirements

| Requirement           | Detail                                                 |
| --------------------- | ------------------------------------------------------ |
| **Upload files**      | Users can upload any file type; up to 5GB per file     |
| **Download files**    | Retrieve uploaded files by URL                         |
| **Resumable uploads** | Large files can resume after network interruption      |
| **File processing**   | Auto-generate thumbnails for images; transcode video   |
| **Access control**    | Private files (owner only), public files, shared links |
| **Versioning**        | Optionally keep previous versions of a file            |

### Non-Functional Requirements

| Requirement      | Target                                            |
| ---------------- | ------------------------------------------------- |
| **Scale**        | 10M uploads/day; 100M downloads/day               |
| **File size**    | Up to 5GB per upload                              |
| **Availability** | 99.99% for downloads; 99.9% for uploads           |
| **Durability**   | 11 nines (never lose a file)                      |
| **Latency**      | Upload initiation: <200ms; Download start: <100ms |

---

### Estimation

```
UPLOADS:
  10M uploads/day = 116/sec average
  Average file size: 10MB → 116 × 10MB = 1.16 GB/sec upload throughput

DOWNLOADS:
  100M downloads/day = 1,157/sec average
  Average download: 10MB → 11.57 GB/sec download throughput
  → CDN essential; origin cannot handle this

STORAGE:
  10M files/day × 10MB = 100 TB/day
  1-year retention: 100TB × 365 = 36.5 PB
  → S3 with storage tiering (Standard → IA → Glacier)

COST OPTIMIZATION:
  Hot files (recent): S3 Standard
  Warm files (>30 days): S3 Infrequent Access (40% cheaper)
  Cold files (>1 year): S3 Glacier Instant Retrieval (68% cheaper)
  Archive (>5 years): S3 Glacier Deep Archive (95% cheaper)
```

---

## Part 2: High-Level Design + Detailed Design

---

### Why Direct-to-S3 Upload (Not Via App Server)

```
BAD APPROACH — upload through app server:
  Client → [POST /upload body=5GB] → [App Server] → [S3]

  Problems:
    - App server RAM/disk used to buffer 5GB file
    - App server bandwidth consumed
    - App server timeout issues (5GB upload takes minutes)
    - App server can't scale to 116 uploads/sec easily

CORRECT APPROACH — presigned URL (client uploads directly to S3):
  Step 1: Client → POST /upload/initiate → [App Server]
  Step 2: App Server → S3.presigned_url(key, TTL=15min) → returns URL to client
  Step 3: Client → PUT {presigned_url} body=5GB → [S3] directly
          App server NOT involved in the upload at all
  Step 4: S3 → triggers Lambda on upload complete
  Step 5: Lambda → updates file metadata in DynamoDB

  Benefits:
    App server: handles only metadata (tiny)
    S3: handles file bytes directly (built for this)
    Upload parallelism: unlimited (S3 scales automatically)
```

---

### Multipart Upload for Large Files (>5MB)

```
For files >5MB (especially 1GB+), use S3 Multipart Upload:

1. Client → POST /upload/initiate → App Server
2. App Server → S3.create_multipart_upload() → returns upload_id
3. App Server → S3.generate_presigned_url(part=1..N) × N parts
4. Returns to client: {upload_id, presigned_urls[]}

5. Client uploads each part in parallel:
   PUT presigned_urls[0] body=5MB_chunk → returns ETag
   PUT presigned_urls[1] body=5MB_chunk → returns ETag
   PUT presigned_urls[N] body=remaining → returns ETag

   Network interruption: resume from last successful part
   Client tracks which parts completed (store in localStorage)

6. Client → POST /upload/complete {upload_id, etags[]}
7. App Server → S3.complete_multipart_upload(upload_id, parts=[{PartNumber, ETag}])
8. S3 reassembles parts into single object
9. S3 → event notification → Lambda → update DynamoDB status=available

PART SIZE RECOMMENDATION:
  5MB - 100MB per part (S3 min: 5MB, except last part)
  Optimal: 25MB parts for good throughput + reasonable retry granularity
  5GB file → 200 parts of 25MB
```

---

### File Processing Pipeline

```
S3 Event Notification → [SNS] → [SQS: processing-queue]
                                       ↓
                           [Lambda: file-processor]

  For images:
    Lambda reads from S3 (source)
    Sharp library: resize to thumbnail (200px × 200px)
    Write thumbnail to S3 (thumbnails/{file_id}.jpg)
    Update DynamoDB: thumbnail_url populated

  For videos (larger processing):
    Lambda → MediaConvert job → HLS transcoding → S3 output
    MediaConvert → CloudWatch event on complete → Lambda → update DynamoDB

  For documents:
    Lambda → Textract (OCR) → extracted text stored in OpenSearch
    Enables: full-text search across uploaded documents

PROCESSING STATUS:
  File status in DynamoDB: uploading → processing → available | failed
  Client polls: GET /files/{id}/status
  Or: WebSocket / SNS push when processing complete
```

---

### Access Control

```
THREE ACCESS LEVELS:
  private:  only owner can access
  shared:   specific user IDs can access
  public:   anyone with the URL

IMPLEMENTATION:
  Private/Shared: S3 bucket is PRIVATE; access via presigned download URL
    GET /files/{id}/download
    → App verifies user has access (DynamoDB ACL check)
    → App generates presigned S3 URL (TTL=15min)
    → Returns presigned URL to client
    → Client downloads directly from S3

  Public: S3 + CloudFront URL (permanent, cached)
    Public files: S3 object ACL=public-read + CloudFront distribution
    Or: CloudFront Signed URL with long TTL (days/weeks)

  Shared link:
    POST /files/{id}/share → returns token
    GET /share/{token} → validates token → presigned URL
    Token stored in DynamoDB: {token, file_id, expires_at, allowed_users[]}
```

---

### Data Model

```
Table: files (DynamoDB)
  PK: file_id (UUID)
  Attributes:
    owner_id: "usr-123"
    filename: "report.pdf"
    size: 2048000
    content_type: "application/pdf"
    s3_key: "files/usr-123/file-uuid.pdf"
    thumbnail_s3_key: "thumbnails/file-uuid.jpg" (if image)
    status: "uploading" | "processing" | "available" | "failed"
    access: "private" | "shared" | "public"
    version: 2
    created_at: timestamp
    updated_at: timestamp
    TTL: optional
    upload_id: "s3-multipart-upload-id" (during upload)

GSI: owner_id-created_at-index → list all files for a user (inbox)

Table: file_shares (DynamoDB)
  PK: share_token
  Attributes: file_id, expires_at, created_by, allowed_users[]
```

---

## Part 3: Scaling, Failure Handling & AWS Architecture

---

### Scaling Strategy

| Challenge                            | Solution                                             |
| ------------------------------------ | ---------------------------------------------------- |
| **11.57 GB/sec downloads**           | CloudFront CDN; S3 Transfer Acceleration             |
| **File processing queue**            | SQS absorbs spike; Lambda auto-scales                |
| **Large file uploads (5GB)**         | Multipart + direct-to-S3; no app server bottleneck   |
| **Storage growth (36.5 PB/year)**    | S3 Intelligent Tiering auto-moves to cheaper storage |
| **Metadata reads (list user files)** | DynamoDB auto-scaling; GSI by owner_id               |

---

### Failure Handling

| Failure                            | Handling                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Upload interrupted mid-way**     | Multipart: client resumes from last part; S3 keeps partial upload 7 days                          |
| **Processing Lambda fails**        | SQS DLQ; retry; alert on DLQ depth                                                                |
| **S3 event notification missed**   | S3 event notifications are at-least-once; Lambda is idempotent (check status before reprocessing) |
| **Multipart upload not completed** | S3 Lifecycle rule: abort incomplete multipart uploads after 7 days (cost cleanup)                 |
| **Presigned URL expires**          | Client requests new presigned URL; 15-min TTL is sufficient for most uploads                      |

---

### AWS Architecture

```
UPLOAD PATH:
  [Client]
    → POST /upload/initiate → [API Gateway → Lambda: initiate-upload]
    → Lambda creates S3 multipart upload → returns {upload_id, presigned_urls[]}
    → Client uploads parts directly to [S3] (bypasses app)
    → Client POST /upload/complete → [Lambda: complete-upload]
    → Lambda calls S3.complete_multipart_upload()
    → [S3] assembled object triggers [S3 Event Notification]
    → [SNS] → [SQS: processing-queue] → [Lambda: file-processor]
    → DynamoDB updated: status=available

DOWNLOAD PATH:
  [Client]
    → GET /files/{id}/download → [Lambda: generate-presigned-url]
    → Lambda checks DynamoDB (ownership + access)
    → Lambda generates S3 presigned URL (15-min TTL)
    → Client downloads directly from [S3] or [CloudFront]

STORAGE POLICY:
  [S3 Intelligent Tiering or Lifecycle Rules]
    0-30 days: S3 Standard
    31-90 days: S3 Standard-IA (40% cheaper)
    91-365 days: S3 Glacier Instant Retrieval
    365+ days: S3 Glacier Deep Archive (95% cheaper)

SECURITY:
  S3 bucket: private (no public access block enabled)
  All access via presigned URLs or CloudFront signed URLs
  KMS encryption at rest (SSE-KMS)
  VPC endpoint for S3 (internal traffic stays in VPC)
  CloudTrail: audit all S3 operations

MONITORING:
  CloudWatch: S3 request metrics, 4xx/5xx errors
  SQS queue depth: processing backlog
  Lambda: processing duration, error rate
  S3 Storage Lens: storage analytics, cost per prefix
```

---

### Interview Answer (2-min verbal walkthrough)

> _"The core insight for file upload at scale: never route file bytes through your app server. Instead, use S3 presigned URLs — the client uploads directly to S3, and my app only handles metadata._
>
> _Flow: client requests an upload → my API generates a presigned URL (or multipart presigned URLs for large files) → client uploads directly to S3 → S3 event notification triggers a Lambda for processing (thumbnails, transcoding) → DynamoDB updated when done._
>
> _For large files (up to 5GB): multipart upload. Client splits file into 25MB parts, uploads in parallel, can resume after network interruption. S3 reassembles on completion._
>
> _Access control: S3 bucket is always private. All downloads go through my API which validates permissions and returns a short-lived presigned download URL. Public files are served via CloudFront for global CDN distribution._
>
> _Storage cost: S3 Lifecycle rules auto-transition files from Standard to IA to Glacier as they age — 95% cost reduction for old files."_

---

### Common Interview Questions

**Q1: How do you implement file versioning?**

> Option 1: S3 native versioning — enable S3 versioning on the bucket. S3 automatically keeps all versions of every object. Downside: cost grows; harder to query. Option 2: Application-level versioning — when a file is updated, store the new version with a new key `files/{file_id}/v{version}`. DynamoDB stores current version number and version history. User can retrieve specific versions via GET /files/{id}/versions/{n}. Lifecycle rule: auto-delete versions older than 90 days to control cost. Most products implement option 2 — gives more control over retention and cost.

**Q2: How would you implement file deduplication?**

> Content-addressed storage: compute SHA-256 hash of the file before upload. Check if this hash already exists in DynamoDB (hash → s3_key mapping). If it exists: don't upload; create a new DynamoDB record pointing to the same S3 object (reference counting). Only store each unique file once regardless of how many users upload it. Dropbox uses this approach — saves massive storage cost. Implementation: client computes hash → sends hash to API → API checks dedup table → returns existing presigned URL or issues new presigned URL for upload → on upload complete, create dedup record.

**Q3: How do you scan uploaded files for malware?**

> Never serve uploaded files directly to users without scanning. Flow: user uploads to S3 staging bucket (not accessible to public). S3 event → Lambda → triggers malware scan (Amazon GuardDuty Malware Protection for S3 in 2023, or ClamAV Lambda layer, or third-party like Trend Micro). If CLEAN: Lambda moves file from staging bucket to production bucket; updates DynamoDB status=available. If INFECTED: Lambda deletes file; updates status=infected; notifies user. Production bucket only contains scanned files. This staging → production pipeline ensures no infected file is ever served.

---

> ✅ **Must Practice Designs Group COMPLETE (6/6)**
>
> ✅ **System Design Subject COMPLETE (28/28 topics)**
>
> **Next Subject →** [02 · AWS Cloud](../../02-AWS-Cloud/)
> First topic: [EC2](../../02-AWS-Cloud/01-Core-Services/01-ec2.md)
