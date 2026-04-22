# Microservices Architecture

> **Subject**: System Design · **Group**: 🏗️ Design Patterns · **Topic**: 02 of 03
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Microservices** is an architectural style where a large application is split into small, independently deployable services. Each service:

- Owns a single business capability
- Has its own database
- Communicates via APIs or events
- Can be deployed, scaled, and developed independently

---

### 2. Why is it needed?

| Problem with Monolith                           | Microservices Solution             |
| ----------------------------------------------- | ---------------------------------- |
| One team's deploy breaks another team's feature | Each service deploys independently |
| Scaling the whole app for one bottleneck        | Scale only the bottleneck service  |
| One language/framework for everything           | Each service can use best-fit tech |
| Small change = full regression test             | Small change = test one service    |

---

### 3. Core Principles

| Principle                     | What it means                                             |
| ----------------------------- | --------------------------------------------------------- |
| **Single Responsibility**     | Each service does one thing (Order Service, User Service) |
| **Own your data**             | Each service has its own database — no shared DB          |
| **API contract**              | Services communicate via stable APIs (REST, gRPC, events) |
| **Failure isolation**         | One service failing doesn't cascade to all others         |
| **Independent deployability** | Deploy User Service without touching Order Service        |

---

### 4. How Does it Work?

```
MONOLITH:
  [All logic in one codebase] → [One shared DB]
  Deploy: entire app restarts
  Scale: entire app scales together

MICROSERVICES:
  [API Gateway]
      ↓ routes to:
  [User Service]         → [users-db (PostgreSQL)]
  [Product Service]      → [products-db (DynamoDB)]
  [Order Service]        → [orders-db (PostgreSQL)]
  [Payment Service]      → [payment-db (PostgreSQL)]
  [Notification Service] → [SES / SNS] (no own DB needed)

  Communication:
    Sync (request/response): REST or gRPC
    Async (events): SNS/SQS, Kafka, EventBridge

  Each service:
    - Deployed to ECS task or Lambda (independently)
    - Scales on its own metrics (Order Service scales on CPU, Payment on queue depth)
    - Has its own CI/CD pipeline
```

---

### 5. Service Communication Patterns

| Pattern            | When                                       | Example                                       |
| ------------------ | ------------------------------------------ | --------------------------------------------- |
| **REST**           | CRUD, simple request/response              | User Service GET /users/{id}                  |
| **gRPC**           | Internal, high-performance, typed          | Product Service → Inventory Service           |
| **Events (async)** | Cross-domain, fire-and-forget              | order.placed → Notification + Analytics       |
| **API Gateway**    | External clients                           | Mobile app → API Gateway → routed to services |
| **Service Mesh**   | Internal traffic management, observability | App Mesh + Envoy sidecar                      |

---

## PART 2

---

### 6. Trade-offs

#### ✅ Pros

| Advantage                  | Detail                                                        |
| -------------------------- | ------------------------------------------------------------- |
| **Independent scaling**    | Scale Order Service to 100 instances; User Service stays at 2 |
| **Fault isolation**        | Recommendation crash doesn't crash checkout                   |
| **Team autonomy**          | Team A owns Order Service end-to-end                          |
| **Technology flexibility** | ML team uses Python; Order team uses Java                     |
| **Faster deployments**     | Deploy one service in 5 min instead of whole app in 30 min    |

#### ❌ Cons (the real costs)

| Disadvantage                       | Detail                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| **Distributed systems complexity** | Network failures, latency, partial failure                   |
| **Data consistency**               | No ACID across services; eventual consistency + Saga pattern |
| **Operational overhead**           | N services = N CI/CD pipelines, N monitors, N log streams    |
| **Distributed tracing**            | Request span across 5 services is hard to trace              |
| **Inter-service latency**          | Local function call 1μs → network call 1ms (1000x slower)    |
| **Testing complexity**             | Integration tests must mock/spin up multiple services        |

---

### 7. Failure Scenarios

| Failure                                   | Handling                                                      |
| ----------------------------------------- | ------------------------------------------------------------- |
| **Service A calls Service B (down)**      | Circuit breaker + timeout + fallback                          |
| **Distributed transaction fails mid-way** | Saga pattern: compensating transactions (rollback via events) |
| **Service discovery fails**               | ECS Service Discovery / AWS Cloud Map with health checks      |
| **Data inconsistency across services**    | Design for eventual consistency; use idempotent operations    |
| **Cascading failure**                     | Bulkhead pattern + circuit breakers between all services      |

---

### 8. AWS Mapping

```
MICROSERVICES ON AWS:
─────────────────────────────────────────────────────────

API Gateway → ALB → ECS Fargate (per service)
  or
API Gateway → Lambda (per service, serverless)

Per service:
  User Service:     ECS Fargate + RDS PostgreSQL
  Product Service:  ECS Fargate + DynamoDB
  Order Service:    ECS Fargate + RDS PostgreSQL
  Payment Service:  ECS Fargate + RDS PostgreSQL (isolated VPC)
  Notification:     Lambda + SES/SNS (event-driven)

Container orchestration: ECS (managed) or EKS (Kubernetes)
Service mesh: AWS App Mesh (Envoy sidecar: circuit breaking, retries, mTLS)
Service discovery: AWS Cloud Map
Tracing: AWS X-Ray (trace across all services with same trace ID)
Centralized logging: CloudWatch Logs Insights / OpenSearch
Config: AWS AppConfig (feature flags per service)
Secrets: AWS Secrets Manager (per service, least privilege IAM)
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"Microservices decompose a system into independently deployable services, each owning its business domain and database. This enables teams to deploy independently, scale bottlenecks in isolation, and isolate failures._
>
> _The real cost is distributed systems complexity: network failures, eventual consistency instead of ACID transactions, and operational overhead across N services. On AWS, I use ECS Fargate per service, App Mesh for service-to-service traffic management with circuit breaking, X-Ray for distributed tracing, and SNS/SQS for async event-driven communication between services."_

---

### 10. Common Interview Questions

**Q1: How do you handle a transaction that spans multiple microservices?**

> Use the Saga pattern. Two types: Choreography saga — each service publishes an event on success; the next service consumes it and continues; on failure, each service publishes a compensating event to undo prior work. Orchestration saga — a central saga orchestrator (Step Functions) tells each service what to do; on failure, the orchestrator issues compensating transactions. Example: Order saga: Reserve Inventory → Charge Payment → Update Order Status. If Charge Payment fails: Release Inventory (compensating transaction). Step Functions makes the flow visible and handles retries.

**Q2: Should every microservice have its own database?**

> Yes — this is the "database per service" pattern and it's a core principle. Shared databases create hidden coupling: one team's schema change breaks another team's queries. With separate databases, each service chooses the best DB for its needs (Order Service: relational; Product Catalog: DynamoDB; Search: OpenSearch) and can evolve schema independently. The cost: cross-service queries become API calls or eventual consistency joins. Accept this cost — the alternative (shared DB) defeats the purpose of microservices.

**Q3: How small should a microservice be?**

> A common mistake is making services too small ("nanoservices") — one service per CRUD operation creates more network overhead and operational complexity than the autonomy is worth. Rule of thumb: size around business capabilities (not technical layers). A "User Service" that handles user profile, preferences, and account settings is right-sized. Splitting that into a "Profile Service" and "Preferences Service" is too fine. Start with larger services and split when a specific bottleneck or team ownership issue demands it — don't over-decompose upfront.

---

> **Next Topic →** [03 · Monolith vs Microservices](./03-monolith-vs-micro.md)
