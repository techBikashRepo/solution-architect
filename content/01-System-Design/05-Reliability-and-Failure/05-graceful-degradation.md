# Graceful Degradation

> **Subject**: System Design · **Group**: 🔥 Reliability & Failure (MUST) · **Topic**: 05 of 05
> **Status**: ✅ Done

---

## PART 1

---

### 1. What is it?

**Graceful degradation** means the system continues to provide **partial functionality** when a component fails, rather than crashing completely. It trades full features for continued availability.

The opposite of graceful degradation: a monolith where one failing component brings down everything (cascade failure).

---

### 2. Why is it needed?

| Without Graceful Degradation                     | With Graceful Degradation                                 |
| ------------------------------------------------ | --------------------------------------------------------- |
| Recommendation service down → homepage 500 error | Recommendation service down → show top-20 static products |
| Search service down → entire app unusable        | Search service down → hide search box, show categories    |
| Payment API slow → checkout hangs for 30s        | Payment API slow → fail fast, show "try again" within 2s  |

Users get a reduced experience instead of a broken one. Revenue continues. SLA maintained.

---

### 3. Where is it used?

| Use Case                                 | Degraded State                                        |
| ---------------------------------------- | ----------------------------------------------------- |
| **Netflix**: CDN down                    | Serve lower-resolution stream from alternative server |
| **Amazon**: Recommendations service down | Show empty recommendations section (not a 500 error)  |
| **Twitter**: Timeline fanout slow        | Show cached timeline, not real-time                   |

---

### 4. How Does it Work?

```
FEATURE FLAGS — toggle features under load:
─────────────────────────────────────────────────
  if (featureFlag.isEnabled("personalizedRecommendations")) {
      return recommendationService.get(userId);  // might fail
  } else {
      return staticTopProducts.get();            // always works
  }

  On incident: flip flag → all users get static products instantly
  After fix: flip flag back → personalized recommendations restored

FALLBACK HIERARCHY:
─────────────────────────────────────────────────
  1. Real-time personalized data (primary)
  2. Cached data from Redis (stale but works)
  3. Static default data (always available)
  4. Empty response (hide the feature section)
  5. Error message (last resort — never crash)

CIRCUIT BREAKER AS DEGRADATION ENABLER:
─────────────────────────────────────────────────
  Recommendation API → Circuit Breaker
    CLOSED: real-time recommendations ✅
    OPEN:   fallback to cached top products ✅
    HALF-OPEN: probe if recommendation API recovered
```

---

### 5. Degradation Strategies

| Strategy             | How                                      | Example                                  |
| -------------------- | ---------------------------------------- | ---------------------------------------- |
| **Feature toggle**   | Disable non-critical features under load | Turn off recommendations, notifications  |
| **Cache fallback**   | Serve stale cached data                  | Old product prices for a few minutes     |
| **Static fallback**  | Hardcoded safe response                  | Top 20 products, popular categories      |
| **Load shedding**    | Reject low-priority traffic              | Drop analytics writes; keep order writes |
| **Queue offloading** | Async instead of sync                    | Email sends queued instead of immediate  |
| **Read-only mode**   | Accept reads, queue writes               | "Writes temporarily unavailable"         |

---

## PART 2

---

### 6. Trade-offs

| Approach            | Pros                                   | Cons                                                |
| ------------------- | -------------------------------------- | --------------------------------------------------- |
| **Feature toggle**  | Instant on/off, no deploy needed       | Requires LaunchDarkly or similar; code complexity   |
| **Cache fallback**  | Transparent to user; data is valid     | Stale data; cache may also be down                  |
| **Static fallback** | Always available; zero dependency      | Not personalized; may feel broken                   |
| **Load shedding**   | Protects core; transparent degradation | Some users get rejected — needs fair prioritization |
| **Read-only mode**  | Simple to implement                    | Users can't complete actions; frustrating           |

#### 🚫 What must NOT degrade

- **Payment processing** — critical path; don't degrade; make it as reliable as possible separately
- **Auth / login** — if auth degrades, users can't do anything
- **Order confirmation** — user needs this guarantee

---

### 7. Failure Scenarios

| Failure                         | Graceful Degradation Response                                                  |
| ------------------------------- | ------------------------------------------------------------------------------ |
| **Recommendation service down** | Circuit breaker opens → serve top products from cache                          |
| **Search service down**         | Return empty results + "Search unavailable, try browsing"                      |
| **DB overloaded**               | Load shedding: drop analytics writes; queue other writes; protect order writes |
| **CDN down**                    | Serve from origin (slower but functional)                                      |
| **Third-party maps API down**   | Show address text instead of interactive map                                   |
| **Full region outage**          | Route 53 failover to secondary region (if multi-region)                        |

---

### 8. AWS Mapping

| Need                         | AWS Service                                       | How                                                          |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **Feature flags**            | **AWS AppConfig**                                 | Dynamic configuration, instant flag flips without deploy     |
| **Circuit breaker fallback** | **App Mesh + Envoy** or **Resilience4j**          | Auto-fallback when circuit opens                             |
| **Cache fallback**           | **ElastiCache**                                   | Serve stale cached data on DB failure                        |
| **Load shedding**            | **API Gateway throttling** + **SQS**              | Reject excess traffic; queue the rest                        |
| **Read-only mode**           | **RDS read replica** routing                      | Route all traffic to read replica during primary maintenance |
| **Region failover**          | **Route 53 failover routing** + **health checks** | Automatic DNS failover to secondary region                   |
| **Static fallback**          | **S3 + CloudFront**                               | Static site as fallback for dynamic app                      |

---

### 9. Interview-Ready Explanation (30 sec)

> _"Graceful degradation means serving reduced functionality instead of total failure when a component breaks. For example, if our recommendation service is down, rather than returning a 500 error, we fall back to showing the top 20 products from Redis cache — the user gets a slightly worse experience, but the page loads._
>
> _I implement this with three layers: circuit breakers that trigger fallbacks automatically, feature flags via AWS AppConfig for instant feature toggling without deploys, and a fallback hierarchy from real-time → cached → static. The key rule: identify which features are critical path (payments, auth, orders) and which are nice-to-have (recommendations, personalization), then design the nice-to-haves to degrade gracefully."_

---

### 10. Common Interview Questions

**Q1: How do you decide what to degrade vs what to protect?**

> Use a criticality matrix: categorize every feature as (1) Core — system fails without it (auth, payments, order creation), (2) Important — degrades experience but system works (search, recommendations, personalization), (3) Nice-to-have — remove under load (analytics tracking, personalized notifications). Only Core features get redundancy + no-degrade treatment. Everything else gets graceful degradation design.

**Q2: What is load shedding and how does it relate to graceful degradation?**

> Load shedding is the decision to reject some requests to protect the system for others. It's a form of graceful degradation at the traffic level. Priority-based shedding: drop analytics, logging, non-critical writes first; protect order/payment writes last. Implementation: API Gateway throttling + circuit breaker + priority queues. Netflix uses load shedding: drop non-video-serving requests (account page, recommendations) before dropping video streaming.

**Q3: How do you test graceful degradation?**

> Chaos engineering. Use AWS Fault Injection Simulator (FIS) to inject failures: kill recommendation Lambda, add 5s latency to DB, drop 50% of API calls. Verify: (1) fallback is invoked correctly, (2) users see degraded experience (not errors), (3) core features still work. Run these tests in staging weekly. Game day exercises in production quarterly (with monitoring ready).

---

> ✅ **Reliability & Failure Group COMPLETE (5/5)**
>
> **Next Group →** [06 · Design Patterns](../06-Design-Patterns/)
> First topic: [Event-Driven Architecture](../06-Design-Patterns/01-event-driven.md)
