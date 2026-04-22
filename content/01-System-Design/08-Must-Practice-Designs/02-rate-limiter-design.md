# Rate Limiter — System Design

> **Subject**: System Design · **Group**: 🎯 Must Practice Designs · **Topic**: 02 of 06
> **Status**: ✅ Done

---

## Part 1: Requirements & Estimation

---

### Functional Requirements

| Requirement                | Detail                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| **Limit requests**         | Allow max N requests per user/IP per time window                  |
| **Multiple granularities** | Limit per second, per minute, per hour                            |
| **Multiple levels**        | Per user, per IP, per API key, global                             |
| **Return headers**         | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| **Reject over limit**      | Return 429 Too Many Requests                                      |
| **Low latency overhead**   | Rate check must not add >1ms to request latency                   |

### Non-Functional Requirements

| Requirement      | Target                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Throughput**   | 100K+ requests/sec                                                                                     |
| **Latency**      | <1ms for rate limit decision                                                                           |
| **Accuracy**     | Should not allow significantly more than the limit                                                     |
| **Availability** | If rate limiter fails → fail open (let traffic through) OR fail closed (block all) — business decision |
| **Distributed**  | Multiple app servers must share the same rate limit state                                              |

---

### Estimation

```
If protecting API that receives 100K RPS:
  Each request = 1 Redis operation (INCR or sorted set update)
  Redis throughput: ~1M ops/sec single node
  → Redis handles 100K RPS easily

  Storage per user:
    Counter-based: key="{user_id}:{window}", value=count, TTL=window
    ~40 bytes per key; 10M users = 400 MB → small
```

---

## Part 2: Algorithms + Detailed Design

---

### Algorithm Comparison

| Algorithm                  | How It Works                                                                    | Pros                      | Cons                                                         |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| **Fixed Window Counter**   | Count requests in fixed windows (0:00-0:59, 1:00-1:59)                          | Simple; low memory        | Boundary burst: 100 at 0:59 + 100 at 1:00 = 200 in 2 seconds |
| **Sliding Window Log**     | Store timestamp of each request; count those within window                      | Accurate                  | High memory: store all timestamps                            |
| **Sliding Window Counter** | Weighted blend of current + previous window                                     | Near-accurate; low memory | Approximation, not exact                                     |
| **Token Bucket**           | Bucket holds N tokens; replenished at fixed rate; each request consumes 1 token | Allows bursts; smooth     | Slightly complex; tokens can "bank up"                       |
| **Leaky Bucket**           | Requests enter queue; processed at fixed rate                                   | Smooth output; no bursts  | Doesn't allow any burst; queue may fill                      |

---

### Recommended: Sliding Window Counter (Redis)

```
KEY DESIGN:
  key = "rate_limit:{user_id}:{window_start}"
  value = count
  TTL = window_size * 2

ALGORITHM:
  window_size = 60 seconds
  limit = 100 requests / minute

  current_window = floor(now / 60) * 60          # e.g., 1705123200
  prev_window = current_window - 60

  current_count = Redis.GET("rate:{user_id}:{current_window}") or 0
  prev_count = Redis.GET("rate:{user_id}:{prev_window}") or 0

  elapsed = (now - current_window) / window_size  # 0.0 to 1.0
  weighted_count = prev_count * (1 - elapsed) + current_count

  if weighted_count + 1 > limit:
      return 429  # Too Many Requests
  else:
      Redis.INCR("rate:{user_id}:{current_window}")
      Redis.EXPIRE("rate:{user_id}:{current_window}", 120)
      return proceed

EXAMPLE:
  59 seconds into the minute: elapsed = 0.98
  prev_count = 80, current_count = 30
  weighted = 80 * 0.02 + 30 = 31.6 → allowed (< 100)

  vs fixed window: would allow 110 at the boundary
```

---

### Token Bucket (for burst-friendly limits)

```python
# Redis Lua script (atomic — no race condition)
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])  -- tokens per second
local now = tonumber(ARGV[3])
local tokens_requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Refill tokens based on elapsed time
local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens >= tokens_requested then
    -- Allow request
    redis.call('HMSET', key, 'tokens', new_tokens - tokens_requested, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 1  -- allowed
else
    -- Reject
    return 0  -- denied
end
```

---

### High-Level Architecture

```
[Client] → [API Gateway / Load Balancer]
                    ↓
           [Rate Limiter Middleware]  ← embedded in API Gateway or sidecar
                    ↓
           [Redis Cluster]           ← shared state across all app servers
           rate_limit:{user_id}:{window} → count
                    ↓
           ALLOWED → [Application Server]
           DENIED  → 429 Too Many Requests

DISTRIBUTED SETUP:
  Multiple app servers all check the SAME Redis keys
  Redis INCR is atomic → no race conditions
  Redis Cluster: shard keys across nodes for throughput

RESPONSE HEADERS:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 37
  X-RateLimit-Reset: 1705123260 (unix timestamp of next window reset)
  Retry-After: 23 (seconds until reset, on 429 response)
```

---

## Part 3: Scaling, Failure Handling & AWS Architecture

---

### Scaling Strategy

| Challenge                             | Solution                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| **100K RPS → 100K Redis ops/sec**     | Redis Cluster: shard by user_id across nodes                                            |
| **Redis hot key (1 user hammering)**  | Per-shard isolation; key already includes user_id                                       |
| **Global rate limits across regions** | DynamoDB Global Tables for global limit (higher latency) or per-region limits (simpler) |
| **Different limits per user tier**    | Store limit config in DynamoDB; cache in Redis                                          |

---

### Failure Handling

| Failure                                             | Impact                                                     | Solution                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Redis down**                                      | Can't enforce rate limits                                  | Fail open (let traffic through) + alert + fallback to in-memory (inaccurate but functional) |
| **Redis replica lag**                               | Rate limit check on stale replica                          | Always write and read from Redis primary for rate limit ops                                 |
| **Race condition: two servers INCR simultaneously** | Both see count=0, both increment, count ends up at 1 not 2 | Redis INCR is atomic — no race condition                                                    |
| **Redis INCR returns wrong count**                  | Doesn't happen — INCR is atomic in Redis                   | Use Lua scripts for more complex atomic operations                                          |

---

### AWS Architecture

```
OPTION 1: API GATEWAY BUILT-IN RATE LIMITING
  API Gateway Usage Plans:
    Per-method, per-API key rate limits
    429 returned automatically
    No Redis needed
    Limit: coarse-grained (not per-user with custom logic)

OPTION 2: CUSTOM RATE LIMITER
  [CloudFront] → [API Gateway] → [Lambda: rate-limiter-middleware]
                                       ↓
                                [ElastiCache Redis (cluster)]
                                       ↓
                                 ALLOWED → [Lambda: main handler]
                                 DENIED  → 429 response

OPTION 3: APP MESH / ENVOY SIDECAR
  Envoy can enforce rate limits at the proxy level
  Envoy → [Rate Limit Service (gRPC)] → [Redis]
  Works across any language/framework uniformly

PRODUCTION RECOMMENDATION:
  Layer 1: CloudFront → WAF rate-based rules (IP-level, protects from DDoS)
  Layer 2: API Gateway → Usage Plans (API key level)
  Layer 3: Application → Redis sliding window (user-level, business logic)
```

---

### Interview Answer (2-min verbal walkthrough)

> _"Rate limiting prevents abuse and ensures fair resource use. I'd implement it as middleware between API Gateway and the application using Redis as the shared state store._
>
> _Algorithm choice: sliding window counter. It prevents boundary bursts that fixed windows allow, uses minimal memory, and Redis handles 100K+ ops/sec easily. The key is `rate:{user_id}:{window_start}`, and I use Redis INCR which is atomic — so multiple app servers checking the same key don't race._
>
> _For failure: if Redis is down, I fail open by default (let traffic through) rather than blocking all legitimate users — business decision. I'd alert immediately and have circuit breaker logic._
>
> _On AWS: CloudFront WAF for IP-level DDoS protection, API Gateway usage plans for API key limits, and custom Redis middleware for fine-grained user-level limits. Response includes standard `X-RateLimit-_` headers so clients know their quota."\*

---

### Common Interview Questions

**Q1: What is the difference between token bucket and leaky bucket?**

> Token bucket: tokens accumulate at a fixed rate, capped at bucket capacity. Each request consumes a token. Allows bursting: if a user has banked tokens, they can fire a burst of requests up to the bucket size. Good for APIs where bursts are acceptable. Leaky bucket: requests enter a queue and are processed at a fixed rate, regardless of how they arrive. No bursts — output is always at a constant rate. Good for rate-smoothing use cases (protecting a downstream service from spikes). For user-facing APIs: token bucket (bursts OK). For protecting a backend DB: leaky bucket (smooth the write rate).

**Q2: How do you handle rate limiting for distributed systems across multiple regions?**

> Per-region rate limits: simplest approach — each region tracks its own limits. Downside: a user can circumvent per-region limits by routing to different regions. Global rate limits: use DynamoDB Global Tables or a dedicated distributed rate limit service. Higher latency (~100ms cross-region round trip) to check the global count. Compromise: use per-region limits for most APIs, global only for highly sensitive endpoints (payment, account creation). AWS WAF provides global IP-level rate limiting via CloudFront, which is a practical starting point.

**Q3: How do you implement different rate limits for different user tiers (free vs premium)?**

> Store tier limits in a configuration: DynamoDB or Redis hash `rate_config:{user_id} → {limit: 1000, window: 60}`. On each rate limit check: fetch the user's limit config (cached in app memory or Redis with 5-min TTL), then apply the sliding window using their specific limit. Free tier: 100 req/min. Premium: 1000 req/min. Enterprise: custom. Cache the config to avoid extra lookups on every request. When a user upgrades tiers, invalidate their config cache key.

---

> **Next Topic →** [03 · Notification System](./03-notification-system.md)
