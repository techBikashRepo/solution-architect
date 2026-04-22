# API Gateway → Lambda → DynamoDB

> **Subject**: AWS Cloud · **Group**: 🗺️ Architecture Mapping · **Topic**: 01 of 3
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is this Pattern?

**API Gateway → Lambda → DynamoDB** is the classic AWS serverless stack. Zero servers to manage, auto-scales from 0 to millions of requests, and pay-per-use pricing. It's the default starting point for modern AWS APIs.

```
Client → API Gateway → Lambda → DynamoDB
           (HTTPS)    (compute)  (storage)
```

---

### 2. Each Component's Role

| Component       | Responsibility                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **API Gateway** | TLS termination, auth (Cognito/JWT/API Key), rate limiting, request validation, routing to Lambda |
| **Lambda**      | Business logic: validate input, call DynamoDB, format response                                    |
| **DynamoDB**    | Fully managed NoSQL storage; single-digit ms reads; auto-scales on demand                         |

---

### 3. Architecture Deep Dive

```
FULL REQUEST FLOW:
─────────────────────────────────────────────────────────
  Client (mobile/web)
      ↓ HTTPS POST /orders
  [API Gateway]
    - TLS termination (ACM cert)
    - JWT validation (Cognito Authorizer) → reject 401 if invalid
    - Rate limit: 1000 req/sec per API key
    - Request validation: required fields (body schema)
    - Passes event JSON to Lambda
      ↓ invoke (sync)
  [Lambda: create-order]
    - Parse event.body
    - Business logic: price calculation, inventory check
    - Write to DynamoDB:
        PK: ORDER#<orderId>, SK: METADATA#<timestamp>
        GSI: userId for "get my orders" query
    - Return: {statusCode: 201, body: {orderId, status}}
      ↓ response
  [API Gateway]
    - Forward Lambda response to client
      ↓ HTTP 201
  Client receives: {"orderId": "ord_abc123", "status": "created"}

LATENCY BUDGET:
  Cold start Lambda (Python): ~300-500ms (mitigate with Provisioned Concurrency)
  Warm Lambda invocation: ~5-10ms overhead
  DynamoDB single-item write: ~2-5ms (same region)
  Total warm path: ~10-30ms end-to-end
```

---

### 4. IAM and Security

```
API GATEWAY AUTHORIZATION OPTIONS:
  1. Cognito User Pool Authorizer (JWT):
     API Gateway validates JWT automatically
     Lambda receives identity in event.requestContext.authorizer
     Best for: user-facing apps with Cognito auth

  2. Lambda Authorizer:
     Custom Lambda validates Bearer token → returns IAM policy
     Best for: custom auth (OAuth2 with external IdP, API keys with DB lookup)

  3. API Key + Usage Plan:
     API key in x-api-key header
     Usage plan: throttle 100 req/sec, 10,000 req/day per key
     Best for: B2B partner APIs

  4. IAM Auth (Signature V4):
     AWS_IAM auth; caller signs request with AWS credentials
     Best for: internal service-to-service (not user-facing)

LAMBDA EXECUTION ROLE (least privilege):
  Allow: dynamodb:PutItem, GetItem, UpdateItem, Query on orders table
  Allow: logs:CreateLogGroup, logs:PutLogEvents
  Deny: everything else
```

---

### 5. DynamoDB Design for This Pattern

```
ACCESS PATTERNS (design table around these):
  1. Create order → PutItem (PK: ORDER#id)
  2. Get order by ID → GetItem (PK: ORDER#id)
  3. List orders by user → Query on GSI (PK: USER#userId, SK: timestamp)
  4. List orders by status → Query on GSI (PK: STATUS#status, SK: timestamp)

TABLE DESIGN:
  Table: orders
  PK: ORDER#<orderId>    SK: METADATA

  GSI1: userId-timestamp-index
    GSI1PK: USER#<userId>   GSI1SK: <timestamp>

  Attributes: orderId, userId, status, items, total, createdAt

API → DynamoDB MAPPING:
  POST /orders     → PutItem
  GET /orders/:id  → GetItem
  GET /orders      → Query GSI (by userId from JWT claims)
  PUT /orders/:id  → UpdateItem (status)
  DELETE (soft): UpdateItem (status = CANCELLED)
```

---

## PART 2

---

### 6. When to Use This Pattern

✅ **Ideal for**:

- REST or GraphQL APIs with spiky or unpredictable traffic
- Microservices with simple key-value or document data access
- Teams that want zero server management
- CRUD APIs, mobile backends, IoT event ingestion

❌ **Reconsider when**:

- Complex relational queries (joins) → use RDS
- Long-running processes (> 15 min Lambda limit) → use ECS/Fargate
- Extremely high sustained throughput at lowest cost → use EC2/ALB/RDS
- Real-time connections (WebSocket) → use API Gateway WebSocket + Lambda + DynamoDB (same stack, different API type)

---

### 7. Pitfalls

```
PITFALL 1: Lambda cold starts (p99 latency spike)
  Problem: first invocation after idle period takes 300-2000ms
  Fix: Provisioned Concurrency (keep N lambdas warm); or SnapStart (Java)

PITFALL 2: DynamoDB hot partitions
  Problem: all writes to same PK (e.g., date-based PK) → 1 shard handles all
  Fix: high-cardinality PK (orderId, userId + randomized shard suffix for writes)

PITFALL 3: Lambda timeout from API Gateway
  API Gateway max timeout: 29 seconds
  If Lambda exceeds 29s: API Gateway returns 504
  Fix: for long operations, use async (API Gateway → SQS → Lambda; return 202 Accepted)

PITFALL 4: API Gateway payload limit
  Max request body: 10MB
  For file uploads: use presigned S3 URLs directly (not via API Gateway)

PITFALL 5: DynamoDB on-demand vs provisioned
  On-demand: auto-scales; higher per-request cost; best for unpredictable traffic
  Provisioned: cheaper for steady-state; requires capacity planning
```

---

### 8. AWS Architecture Example

```
SERVERLESS ORDER API:
─────────────────────────────────────────────────────────
  Route 53 → api.myapp.com → API Gateway (custom domain + ACM cert)

  API Gateway REST API:
    Cognito User Pool Authorizer (JWT)
    Resources:
      POST   /orders          → Lambda: create-order
      GET    /orders          → Lambda: list-orders
      GET    /orders/{id}     → Lambda: get-order
      PUT    /orders/{id}     → Lambda: update-order

    Stage: prod
    Throttle: 500 RPS burst, 100 RPS steady
    WAF: enable (SQL injection, rate limit by IP)

  Lambda Functions:
    Runtime: Python 3.12 or Node.js 20
    Memory: 512MB (tune based on observed usage)
    Timeout: 10s (DynamoDB calls should complete in <1s)
    Concurrency: Reserved 100 for critical paths
    Provisioned: 10 warm instances for create-order (critical path)
    Tracing: X-Ray enabled
    Environment: TABLE_NAME, ENVIRONMENT (no secrets; use Secrets Manager SDK)

  DynamoDB:
    Table: orders-prod
    Billing: on-demand (traffic unpredictable)
    TTL: 90 days for order records (compliance)
    Streams: enabled → Lambda: sync-to-elasticsearch for search
    Backup: point-in-time recovery enabled

  Monitoring:
    Alarm: Lambda Errors > 1% → SNS → PagerDuty
    Alarm: API Gateway 5XX > 1% → SNS → PagerDuty
    Alarm: Lambda p99 Duration > 5s → SNS → Slack
    Dashboard: requests/min, error rate, latency p50/p99, DynamoDB consumed RCU/WCU
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"API Gateway → Lambda → DynamoDB is the standard serverless stack. API Gateway handles TLS, JWT auth via Cognito, and rate limiting. Lambda has the business logic — no server management, scales automatically from zero. DynamoDB stores data with single-digit ms reads._
>
> _Table design is critical: design access patterns first, then table. A GSI lets you query orders by userId even though the table's PK is orderId._
>
> _Key limitation: 29-second API Gateway timeout. For async tasks: return 202 Accepted and push to SQS; Lambda processes asynchronously and client polls or gets notified via WebSocket or email."_

---

### 10. Common Interview Questions

**Q1: How do you handle Lambda cold starts in a production API?**

> Cold starts happen when a new Lambda execution environment is created — takes 300ms–2s depending on runtime and package size. Solutions: (1) Provisioned Concurrency: pre-warm N Lambda instances; they're always ready to serve; costs ~60% of full Lambda price but eliminates cold start latency for those instances. (2) SnapStart (Java): Lambda takes a snapshot of initialized execution environment; restores in ~100ms instead of JVM startup time. (3) Language choice: Python/Node.js have much shorter cold starts (~100-500ms) vs Java (~2-5s). (4) Reduce package size: cold start time correlates with package size; tree-shake dependencies. (5) Keep Lambda warm (hack): scheduled EventBridge rule pings Lambda every 5 minutes — not recommended for production, use Provisioned Concurrency instead.

**Q2: How do you design DynamoDB tables for this pattern?**

> Start with access patterns, not the data model. List every query the API needs to make before designing the table. For each query, ensure there's either a base table query (by PK) or a GSI (by alternate key). Example: `POST /orders` → PutItem with PK=ORDER#orderId. `GET /orders/123` → GetItem by PK. `GET /users/456/orders` → needs GSI with PK=USER#456, sort key=timestamp, returns all orders for user in time order. `GET /orders?status=PENDING` → GSI with PK=STATUS#PENDING for listing. Keep hot attributes in the base table (orderId, status, total). Keep the item count per partition low for write-heavy tables — add a shard suffix to avoid hot partitions.

**Q3: API Gateway synchronous vs asynchronous Lambda invocation?**

> Synchronous (default REST API): client waits for Lambda to complete and return. 29-second max timeout. Good for: CRUD operations, real-time validation. Asynchronous: API Gateway responds 202 immediately; Lambda processes in background. Options: (1) API Gateway → SQS → Lambda (most reliable; SQS buffers, retries, DLQ). Client gets 202 and a jobId; polls `GET /jobs/{jobId}` for status. (2) API Gateway async Lambda invocation directly (no guarantee of delivery at scale). Use async for: image processing (POST image → 202 → WebSocket/webhook when done), report generation, bulk operations. The pattern: synchronous for user-facing CRUD (response immediately); asynchronous for anything >2-3 seconds or batch work.

---

> **Next Topic →** [02 · ALB → EC2 → RDS](./02-alb-ec2-rds.md)
