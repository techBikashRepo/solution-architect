# E-Commerce Backend — System Design

> **Subject**: System Design · **Group**: 🎯 Must Practice Designs · **Topic**: 05 of 06
> **Status**: ✅ Done

---

## Part 1: Requirements & Estimation

---

### Functional Requirements

| Requirement              | Detail                                              |
| ------------------------ | --------------------------------------------------- |
| **Product catalog**      | Browse, search, filter products                     |
| **Shopping cart**        | Add/remove items, persist across sessions           |
| **Order placement**      | Checkout, payment, order creation                   |
| **Inventory management** | Track stock levels, prevent overselling             |
| **Order tracking**       | Order status updates (placed → shipped → delivered) |
| **User accounts**        | Registration, authentication, address management    |

### Non-Functional Requirements

| Requirement      | Target                                                       |
| ---------------- | ------------------------------------------------------------ |
| **Scale**        | 10M DAU; 1M orders/day; 100K concurrent during sales         |
| **Availability** | 99.99% for checkout; 99.9% for catalog                       |
| **Latency**      | Product search: <200ms; Checkout: <2s                        |
| **Consistency**  | Inventory: strong (prevent overselling); prices: eventual OK |

---

### Estimation

```
1M orders/day = 11.6 orders/sec average; peak sales: 100K/sec
10M DAU → 100K concurrent active users during peak

Product catalog reads:
  100K users × 5 page views/min = 500K product reads/sec
  → Heavy caching needed

Inventory writes:
  1M orders/day × avg 3 items = 3M inventory updates/day
  = 34.7 inventory decrements/sec average; 10K/sec during flash sales

Storage:
  Product: 5M products × 5KB = 25 GB
  Orders: 1M/day × 2KB × 365 days = 730 GB/year
  Images: 5M products × 5 images × 500KB = 12.5 TB → CDN
```

---

## Part 2: High-Level Design + Detailed Design

---

### Microservices Architecture

```
[Mobile/Web Client]
        ↓
[CloudFront CDN]  ← cache product images, static assets
        ↓
[API Gateway]     ← auth, rate limiting, routing
        ↓
┌─────────────────────────────────────────────────────┐
│                INTERNAL SERVICES                      │
│                                                       │
│  [User Service]      → RDS PostgreSQL                 │
│  [Product Service]   → DynamoDB + OpenSearch          │
│  [Cart Service]      → Redis (TTL sessions)           │
│  [Inventory Service] → RDS PostgreSQL (ACID!)         │
│  [Order Service]     → RDS PostgreSQL                 │
│  [Payment Service]   → Stripe/external (isolated VPC) │
│  [Notification]      → SES + APNs/FCM                 │
│  [Search Service]    → OpenSearch                     │
└─────────────────────────────────────────────────────┘
        ↓ events
[SNS/EventBridge]  → async downstream processing
```

---

### Critical Path: Checkout Flow

```
POST /checkout
  1. Validate cart (Cart Service → Redis)
  2. Check inventory (Inventory Service → DB, STRONG consistency)
  3. Reserve inventory (UPDATE items SET reserved=reserved+qty WHERE stock >= qty)
  4. Create order (Order Service → RDS, status=PENDING)
  5. Charge payment (Payment Service → Stripe API, sync)
  6. If payment SUCCESS:
       - Update order status=CONFIRMED
       - Commit inventory reservation (reserved → sold)
       - Return 200 + order_id to user
  7. If payment FAILS:
       - Release inventory reservation
       - Update order status=FAILED
       - Return 402 Payment Required

SAGA PATTERN (distributed transaction):
  Step 1: Reserve inventory  → COMPENSATING: release reservation
  Step 2: Charge payment    → COMPENSATING: issue refund
  Step 3: Confirm order     → COMPENSATING: cancel order

  Orchestrated via Step Functions:
    On any step failure → Step Functions triggers compensating transactions backwards
```

---

### Inventory: Preventing Oversell

```
NAIVE APPROACH (WRONG — race condition):
  1. Read: SELECT stock FROM items WHERE id=X  → stock=1
  2. Check: if stock >= qty
  3. Write: UPDATE items SET stock=stock-1     ← another request does the same here

  Two concurrent requests both see stock=1, both proceed, stock goes to -1 ❌

CORRECT APPROACH (atomic conditional update):
  UPDATE items
  SET reserved=reserved+1
  WHERE item_id=X AND (stock - reserved) >= qty_requested

  Returns 0 rows affected → reject (out of stock)
  Returns 1 row affected → success (atomic)

FOR HIGH-THROUGHPUT FLASH SALES:
  Problem: thousands of concurrent transactions on the same item row → DB contention

  Solution: Redis inventory buffer
    Redis SET: "inventory:item-X" = 1000 (stock count)
    On purchase: DECRBY "inventory:item-X" qty
    If result < 0: INCRBY (rollback) + reject
    DECRBY is atomic → no oversell
    Async: sync Redis count to RDS every 5 seconds
    Recovery: on Redis failure, fall back to RDS (with lock)
```

---

### Product Search

```
Two-tier search:
  Tier 1: ElastiCache/DynamoDB for exact product ID lookups (catalog page)
  Tier 2: OpenSearch for full-text search + filters

[Client] → GET /search?q=iphone&category=electronics&minPrice=500
  → [Search Service]
  → [OpenSearch cluster]
  → Returns: products with name match, filtered, sorted by relevance

OpenSearch index:
  {
    "product_id": "prod-123",
    "name": "iPhone 15 Pro",
    "category": "electronics",
    "brand": "Apple",
    "price": 999.99,
    "in_stock": true,
    "tags": ["smartphone", "5G", "camera"],
    "description": "...",
    "rating": 4.8
  }

Sync strategy: DynamoDB Streams → Lambda → update OpenSearch index
  Near real-time (seconds); search index eventually consistent with catalog
```

---

### Cart Service

```
SESSION-BASED CART (Redis):
  Key: "cart:user-{user_id}"
  Value: Hash { "product-123": 2, "product-456": 1 }
  TTL: 7 days (auto-expire abandoned carts)

  Operations:
    Add item:    HSET "cart:user-X" "product-Y" qty
    Update qty:  HSET "cart:user-X" "product-Y" new_qty
    Remove item: HDEL "cart:user-X" "product-Y"
    Get cart:    HGETALL "cart:user-X"

  Guest carts: same pattern with "cart:guest-{session_id}"
  On login: merge guest cart into user cart

  Why Redis (not DynamoDB)?
    Sub-millisecond reads; TTL auto-expiry; atomic INCR/DECR for qty;
    Cart is ephemeral — if Redis fails, cart data loss is acceptable (user repopulates)
```

---

## Part 3: Scaling, Failure Handling & AWS Architecture

---

### Scaling Strategy

| Component                            | Scale Approach                                                  |
| ------------------------------------ | --------------------------------------------------------------- |
| **Product catalog reads (500K/sec)** | CloudFront CDN + ElastiCache; DynamoDB auto-scaling             |
| **Checkout (100K/sec flash sales)**  | SQS queue for orders; async processing; reserve inventory first |
| **Inventory updates**                | Redis atomic decrement for flash sales; sync to RDS async       |
| **Search**                           | OpenSearch cluster with 3+ data nodes; request routing          |
| **Image serving**                    | S3 + CloudFront; zero app server involvement                    |

---

### Failure Handling

| Failure                                     | Handling                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| **Payment gateway timeout**                 | Timeout after 10s; release inventory reservation; return error to user          |
| **Order created but payment not confirmed** | Step Functions saga; compensating transaction (cancel order, release inventory) |
| **Inventory Redis fails during flash sale** | Fall back to RDS with row-level locking; accept some performance degradation    |
| **Order Service DB overloaded**             | Write orders to SQS first → async persist; return order_id from SQS message id  |
| **Search (OpenSearch) down**                | Degrade gracefully: show category browsing, hide search box                     |

---

### AWS Architecture

```
FRONTEND:
  [S3 static hosting] + [CloudFront] → React/Next.js app
  Images: S3 + CloudFront (origin)

BACKEND:
  [API Gateway] → [ALB] → [ECS Fargate per service]
  OR [API Gateway] → [Lambda per endpoint] (lower scale)

DATABASES:
  User + Order + Inventory: Aurora PostgreSQL (Multi-AZ, ACID)
  Product Catalog: DynamoDB (high read throughput, flexible schema)
  Cart: ElastiCache Redis (ephemeral sessions)
  Search: OpenSearch Service
  Inventory buffer (flash sales): ElastiCache Redis

EVENTS:
  order.placed → [SNS] →
    [SQS: inventory-queue] → Lambda update-inventory
    [SQS: notify-queue] → Lambda send-email confirmation
    [SQS: analytics-queue] → Kinesis → S3 → Athena

PAYMENT:
  Payment Service in isolated VPC subnet (PCI-DSS compliance)
  Stripe API via PrivateLink or NAT Gateway
  KMS encryption for payment data at rest

OBSERVABILITY:
  X-Ray: distributed tracing across services
  CloudWatch Container Insights: ECS metrics
  OpenSearch Dashboards: business metrics (GMV, conversion rate)
  Alarms: order failure rate > 1%, inventory stock level < 10 units

CDN + CACHING LAYERS:
  CloudFront: product pages (TTL 5min), images (TTL 1 day)
  ElastiCache: product details (TTL 30min), search results (TTL 1min)
  DynamoDB DAX: optional for DynamoDB read acceleration
```

---

### Interview Answer (2-min verbal walkthrough)

> _"E-commerce has two critical constraints: high read throughput for browsing (500K reads/sec during sales) and strong consistency for inventory to prevent overselling._
>
> _Architecture: microservices with domain-specific databases. Product catalog in DynamoDB (high read throughput, flexible schema), cached in ElastiCache and CloudFront. Orders and inventory in Aurora PostgreSQL for ACID guarantees._
>
> _The hardest part: checkout. I use a saga pattern orchestrated by Step Functions: reserve inventory atomically (conditional UPDATE), charge payment via Stripe, confirm order. If payment fails: compensating transactions release the inventory reservation._
>
> _For flash sales at 100K/sec: Redis atomic DECRBY for inventory reservations — no DB contention. Sync to RDS async every 5 seconds. SQS absorbs checkout bursts; async order persistence. Search: OpenSearch with DynamoDB Streams keeping the index current."_

---

### Common Interview Questions

**Q1: How do you handle a flash sale with 100K concurrent users buying the last item?**

> Redis inventory buffer is key. Set Redis counter `inventory:item-X = 1` (1 item in stock). All 100K concurrent requests atomically DECRBY. First request gets result 0 (success). All others get negative result → return 409 Out of Stock, and INCRBY to roll back. Redis DECRBY is atomic → exactly one user gets the item. The winner's purchase is then async persisted to RDS. Speed: Redis can handle 1M ops/sec; all 100K requests resolved in <1ms at the Redis layer.

**Q2: How do you implement product recommendations?**

> Collaborative filtering: "users who bought X also bought Y." Data pipeline: order events → Kinesis → S3 data lake → EMR/SageMaker batch job (daily/weekly) → writes recommendations to DynamoDB (PK: product_id → recommended_product_ids[]). Read path: product page loads → Product Service reads recommendations from DynamoDB. Cache in ElastiCache (TTL 1 hour). Real-time recommendations (expensive): stream order events to Kinesis → Lambda → SageMaker real-time endpoint → immediate personalization. Start with batch; add real-time if conversion rate justifies cost.

**Q3: How would you design the order status tracking feature?**

> Order status follows a state machine: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED (or CANCELLED, FAILED at any step). Store current status + history in RDS. Event sourcing option: store every status change as an immutable event; current state = replay of events. On each status change: publish event to SNS → notify user (email/push) + update tracking DB. Customer-facing: GET /orders/{id}/tracking returns status history + estimated delivery. Polling vs push: for delivery tracking, WebSocket or Server-Sent Events (SSE) for real-time updates on the tracking page; fall back to 30-second polling.

---

> **Next Topic →** [06 · File Upload System](./06-file-upload.md)
