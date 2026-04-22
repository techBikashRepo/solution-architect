# S3 → CDN (CloudFront Concept)

> **Subject**: AWS Cloud · **Group**: 🗺️ Architecture Mapping · **Topic**: 03 of 3
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is this Pattern?

**S3 → CloudFront** is the standard AWS pattern for serving static content globally at low latency and low cost. S3 stores files (HTML, JS, CSS, images, videos); CloudFront is the CDN that caches and serves them from edge locations close to users worldwide.

```
User → CloudFront Edge → (cache hit) → serve instantly
                       → (cache miss) → S3 origin → cache → serve
```

---

### 2. Why This Pattern?

| Without CDN (direct S3)                              | With S3 → CloudFront                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Latency = us-east-1 to user (100-300ms across globe) | Latency = nearest edge (<30ms for cached content)                   |
| S3 bandwidth cost: $0.09/GB                          | CloudFront to internet: $0.085/GB (cheaper + free S3 → CF transfer) |
| S3 URL exposed publicly                              | Custom domain + HTTPS via ACM                                       |
| No DDoS protection                                   | CloudFront + AWS Shield Standard (free)                             |
| No origin protection                                 | OAC: users can ONLY access via CloudFront                           |

---

### 3. CloudFront Architecture

```
CLOUDFRONT KEY CONCEPTS:
  Distribution: your CloudFront setup (CDN config)
  Origin: where CloudFront gets content (S3, ALB, API Gateway, custom HTTP)
  Behavior: rules per path pattern (/* , /api/*, /images/*)
  Edge Location: 450+ worldwide; serves cached content
  Regional Edge Cache: between edge and origin (larger cache tier)
  OAC (Origin Access Control): grants CloudFront permission to S3; blocks direct S3 access

CACHING LAYERS:
  Browser cache → Edge Location (450+) → Regional Edge Cache (13) → S3 Origin

  TTL (Cache duration):
    Default: 24 hours
    Min: 0 seconds (always validate)
    Max: 31,536,000 seconds (1 year)

    Static assets (CSS, JS with hash in filename): 1 year
      /app.a3b4c5d.js → immutable; cache forever
      Deploy new version → new filename → new cache entry

    HTML (index.html): 0 or 60 seconds (needs to reflect new deploy quickly)

    Cache-Control headers from S3 override CloudFront defaults
```

---

### 4. Static Website Hosting Pattern (SPA)

```
SPA DEPLOYMENT (React/Vue/Angular):
  S3 bucket: myapp-frontend
    Objects: index.html, /static/js/main.a1b2c3.js, /static/css/app.d4e5f6.css
    Block public access: ENABLED (CloudFront handles all access via OAC)
    Versioning: optional (helps with rollback)

  CLOUDFRONT DISTRIBUTION:
    Origin: S3 bucket (via OAC — not static website URL)
    Default root object: index.html

    Error pages (SPA routing):
      403 → /index.html (HTTP 200) ← React Router handles routing
      404 → /index.html (HTTP 200) ← All routes served by SPA

    Behaviors:
      /static/*  → TTL 31536000 (1 year; files have content hash in name)
      /api/*     → Forward to ALB (no cache or short TTL)
      /*         → TTL 60s (HTML files)

    HTTPS: ACM certificate (us-east-1 only for CloudFront)
    Custom domain: app.myapp.com → Route 53 alias to CloudFront
    Price class: PriceClass_100 (US+Europe) or All (worldwide)

  S3 BUCKET POLICY (allow CloudFront OAC only):
    {
      "Effect": "Allow",
      "Principal": {"Service": "cloudfront.amazonaws.com"},
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::myapp-frontend/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT:distribution/DIST_ID"
        }
      }
    }
```

---

### 5. Cache Invalidation

```
CACHE INVALIDATION:
  When you deploy new frontend code, old files may be cached at edge locations

  STRATEGY 1: Content hash in filename (recommended)
    /static/js/main.a1b2c3.js → deploy → /static/js/main.x9y8z7.js
    New filename = new cache miss = serves immediately
    Old filename: edge cache expires naturally
    Benefit: zero invalidation calls; zero edge-to-origin requests for unchanged files

  STRATEGY 2: CloudFront Invalidation (for index.html)
    aws cloudfront create-invalidation \
      --distribution-id DIST_ID \
      --paths "/*" or "/index.html"

    Cost: first 1,000 invalidation paths/month free; $0.005/path after
    Time: 5-15 minutes to propagate globally (not instant)

    CI/CD pipeline:
      1. Build: generate hashed JS/CSS
      2. Sync to S3: aws s3 sync ./dist s3://myapp-frontend
      3. Invalidate: cloudfront create-invalidation --paths "/index.html"

VERSIONED S3 PATHS (alt strategy):
  /v1.2.3/index.html → CloudFront behavior with version prefix
  Route 53 → CloudFront → S3 prefix per version
  Blue/green: flip CloudFront behavior path from v1.2.2 to v1.2.3
```

---

## PART 2

---

### 6. CloudFront + API Backend (Full Architecture)

```
FULL-STACK PATTERN:
─────────────────────────────────────────────────────────
  Single CloudFront Distribution for EVERYTHING:

  app.myapp.com (CloudFront):
    Behavior 1: /api/*
      → Origin: API Gateway (or ALB)
      → Cache: no-cache (TTL=0) or short TTL for GET responses
      → Forward: Authorization header, query strings

    Behavior 2: /static/*
      → Origin: S3 bucket
      → Cache TTL: 1 year (content-hashed filenames)

    Behavior 3: /* (default)
      → Origin: S3 bucket
      → Cache TTL: 60 seconds
      → Error pages: 404/403 → /index.html (SPA routing)

  BENEFITS:
    Single domain (no CORS issues between frontend and API)
    HTTPS everywhere (one ACM cert)
    WAF applied to ALL traffic at CloudFront layer
    CloudFront compresses responses (gzip, brotli) automatically
```

---

### 7. CloudFront Security

```
WAF + CLOUDFRONT:
  Attach WAF WebACL to CloudFront distribution
  Rules:
    AWS Managed Rules: block common web exploits (SQLi, XSS)
    Rate limit: 2000 req/5min per IP (DDoS protection)
    Geo restriction: block countries you don't serve

AWS SHIELD:
  Standard: free; protects against Layer 3/4 DDoS automatically
  Advanced: $3,000/mo; SRT (Shield Response Team), attack visibility,
            cost protection, Layer 7 DDoS mitigation

SIGNED URLS / SIGNED COOKIES:
  Restrict content to authorized users
  Signed URL: per-file access (one pre-signed URL per object)
    Use for: one-off secure file downloads, video streaming
  Signed Cookies: access to multiple files (e.g., all content in /premium/*)
    Use for: premium subscription content behind paywall

  Flow: User authenticates → Lambda generates signed URL/cookie → CloudFront validates
```

---

### 8. Interview-Ready Explanation (30 sec)

> _"S3 → CloudFront is the standard static content delivery pattern. S3 stores the files; CloudFront has 450+ edge locations worldwide and caches content close to users — sub-30ms for cached content vs 200ms+ direct from S3 to a user in Asia._
>
> _Security: use OAC to block direct S3 access — users must go through CloudFront. Attach ACM cert for HTTPS, WAF for protection._
>
> _For SPAs: deploy with content-hashed filenames for JS/CSS (cache 1 year), invalidate only index.html on deploy. For SPA routing: configure CloudFront to return index.html for 404/403 so React Router handles the routes."_

---

### 9. Common Interview Questions

**Q1: How do you deploy a React SPA to S3 + CloudFront with zero downtime?**

> Build process generates content-hashed filenames: `main.a1b2c3.js`. Deploy steps: (1) `aws s3 sync ./dist s3://myapp-frontend --delete` — uploads new files (new hashes), removes deleted files. Old files are untouched until their names change. (2) `aws cloudfront create-invalidation --paths "/index.html"` — forces edge locations to fetch new index.html which references new hashed JS/CSS. Zero downtime because: new JS/CSS files have new names (new cache entries); old users still downloading old files get the old JS/CSS (still in S3); new page loads immediately get new index.html → new hashed filenames → new content. The `--delete` flag on sync removes old files after new ones are deployed, so old users aren't broken.

**Q2: What is OAC and why is it better than OAI?**

> OAC (Origin Access Control) is the modern replacement for OAI (Origin Access Identity). Both restrict S3 access so only CloudFront can read the bucket. Why OAC is better: (1) Supports all S3 operations (including SSE-KMS encrypted objects — OAI couldn't sign requests for KMS). (2) Supports S3 in all regions including newer regions (some had OAI issues). (3) Uses IAM service principal (`cloudfront.amazonaws.com`) instead of a special CloudFront identity, aligning with standard AWS IAM patterns. Setup: create OAC in CloudFront, attach to distribution, add bucket policy allowing `cloudfront.amazonaws.com` with condition `AWS:SourceArn` matching your distribution ARN. Remove any public access on the S3 bucket.

**Q3: How does CloudFront handle cache invalidation and what are the tradeoffs?**

> Two strategies: (1) Content-hashed filenames: `app.a1b2c3.js` — new deploy = new filename = automatic cache miss. Zero cost, zero wait, zero manual steps. Recommended for all CSS/JS assets. (2) Explicit invalidation: `create-invalidation --paths "/*"`. Propagates to all 450+ edge locations in 5-15 minutes. First 1,000 path invalidations/month are free; $0.005 per path after that. `/*` counts as one path but invalidates everything. Tradeoff: explicit invalidation is slower (15 min wait) and can be costly if done frequently. Cache-hashing solves this for versioned assets but requires a build system that generates hashes. Hybrid: use hash-based filenames for all static assets; explicit invalidation only for index.html on deploy.

---

> ✅ **Architecture Mapping Complete (3/3)**
> **Next Group →** [High Availability](../03-High-Availability/)
