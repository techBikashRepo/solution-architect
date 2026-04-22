# Circuit Breaker (Deeper)

> **Subject**: System Design · **Group**: 🔥 Reliability & Failure (MUST) · **Topic**: 03 of 05
> **Status**: ✅ Done

---

> This is the deeper reliability-focused coverage. For the core concept introduction, see [Core Components: Circuit Breaker](../03-Core-Components/06-circuit-breaker.md).

---

## Deep Dive: Production Patterns

---

### 1. Circuit Breaker + Retry Together

```
WRONG — Retry into open circuit (amplifies failure):
  Request → CB open → fail fast → immediate retry → CB open → fail fast → ...
  Result: wasted CPU + worse recovery for downstream

CORRECT — Circuit breaker wraps retry:
  Request
    → Retry (3 attempts, exponential backoff)
        → If all 3 fail → CB records failures
            → CB trips open after threshold
                → Future requests: fail fast (no retry)
                    → After timeout → HALF-OPEN probe
                        → Success → CLOSE circuit

Pattern: Retry for transient errors. CB for sustained failures.
```

---

### 2. Bulkhead Pattern (Companion to Circuit Breaker)

```
WITHOUT BULKHEAD:
  Service A → Payment API (slow)
  All 100 threads in Service A waiting for Payment API
  → Service A can't handle any other requests
  → Service A crashes

WITH BULKHEAD (thread pool isolation):
  Payment API calls → dedicated thread pool: 10 threads
  Shipping API calls → dedicated thread pool: 10 threads
  User API calls    → dedicated thread pool: 20 threads

  Payment API crashes → only its 10 threads affected
  Other services continue normally ✅

  Implementation: Resilience4j Bulkhead or semaphore-based
```

---

### 3. Timeout + Circuit Breaker Together

```
A slow dependency is WORSE than a crashed one:
  Crashed: fails fast → CB trips quickly
  Slow:    threads blocked for 30s each → pool exhausts → CB trips slowly

SOLUTION: Set tight timeouts + treat timeout as failure:
  Payment API timeout: 2 seconds (not default 30s)
  After 2s: treat as failure → CB records it
  3 timeouts in 5 requests → CB opens → fail fast immediately

Rule: timeout < CB sliding window duration
  Timeout: 2s
  CB window: 10 calls
  CB trips when 5/10 calls timeout (50% failure rate)
```

---

### 4. Fallback Strategies (Deep)

| Fallback Type        | Implementation                       | When to Use                               |
| -------------------- | ------------------------------------ | ----------------------------------------- |
| **Cached response**  | Return last-known-good from Redis    | Price, product info — slight staleness OK |
| **Default value**    | Return empty list, default config    | Recommendations, non-critical features    |
| **Degraded feature** | Disable feature; show "unavailable"  | Search, personalization                   |
| **Static response**  | Return hardcoded response            | Emergency maintenance mode                |
| **Queue for later**  | Write to SQS, process when recovered | Notifications, analytics events           |

> **Anti-pattern**: fallback calls another external service that might also be failing. Fallbacks must be LOCAL.

---

### 5. AWS App Mesh — Infrastructure-Level Circuit Breaker

```yaml
# Envoy outlier detection (circuit breaker at sidecar proxy level)
# Applied to every service in the mesh — no code changes

outlierDetection:
  consecutive5xx: 5 # 5 consecutive errors → eject this instance
  interval: 30s # evaluation interval
  baseEjectionTime: 30s # initial ejection duration
  maxEjectionPercent: 50 # never eject >50% of hosts (keep some available)


# Effect:
# Without code changes, Envoy stops routing to failing pod instances
# Works across languages (Java, Python, Go, Node) uniformly
```

---

### 6. Monitoring Circuit Breaker Health

Metrics to track in production:

| Metric                             | Alert Condition                                        |
| ---------------------------------- | ------------------------------------------------------ |
| `cb.state` (CLOSED/OPEN/HALF-OPEN) | Alert when OPEN                                        |
| `cb.failure_rate`                  | Alert when > 30%                                       |
| `cb.open_duration_seconds`         | Alert when stays OPEN > 5 min (service not recovering) |
| `cb.half_open_attempts`            | Watch for repeated HALF-OPEN failures                  |

On AWS: emit CB state as CloudWatch custom metric → CloudWatch Alarm → SNS → PagerDuty.

---

### 7. Interview-Ready Explanation (45 sec — deep version)

> _"Circuit breaker prevents cascade failures by stopping calls to a failing service. It has three states: CLOSED, OPEN (fail fast), and HALF-OPEN (probe for recovery)._
>
> _In production, I combine it with three patterns: (1) Retry wraps the individual call, circuit breaker wraps the retry block — retry handles transient errors, CB handles sustained failures. (2) Bulkhead pattern — isolate thread pools per dependency so one failing service can't exhaust all threads. (3) Tight timeouts — a slow service is worse than a crashed one; I set 2-second timeouts and count them as failures for CB purposes._
>
> _For fallbacks: always use local cache or a degraded response — never fall back to another external service that might also be down. On AWS, App Mesh Envoy provides infrastructure-level circuit breaking without code changes."_

---

### 8. Common Interview Questions

**Q1: What is the difference between circuit breaker and bulkhead?**

> Circuit breaker: stops calling a failing service after a threshold. Bulkhead: limits the resources (threads/connections) allocated to a specific service call, isolating failure. Use both: bulkhead prevents thread exhaustion while the circuit breaker threshold is being reached; circuit breaker stops wasting even the few bulkhead threads once the service is clearly down.

**Q2: How do you test circuit breaker behavior in production?**

> Chaos Engineering: use tools like AWS Fault Injection Simulator (FIS) to inject latency or errors into dependencies and verify the circuit breaker trips correctly. Test: (1) CB trips when failure rate exceeded. (2) Fallback is invoked correctly. (3) CB moves to HALF-OPEN after timeout. (4) CB recovers when service is healthy again. Game day exercises simulate this in staging first.

**Q3: How would you implement a circuit breaker without a library?**

> Simple implementation: maintain a counter of recent failures and timestamp of last failure. If failure_count > threshold AND within window: OPEN state (fail fast). Store state in Redis for distributed consistency across multiple app instances. After open_duration: move to HALF-OPEN (allow one request through). Success: reset counter (CLOSED). Failure: back to OPEN with doubled timeout (exponential backoff on re-open).

---

> **Next Topic →** [04 · Dead Letter Queue (SQS DLQ)](./04-dlq.md)
