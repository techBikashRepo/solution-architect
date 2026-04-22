# Chat System — System Design

> **Subject**: System Design · **Group**: 🎯 Must Practice Designs · **Topic**: 04 of 06
> **Status**: ✅ Done

---

## Part 1: Requirements & Estimation

---

### Functional Requirements

| Requirement                 | Detail                                     |
| --------------------------- | ------------------------------------------ |
| **1:1 messaging**           | Send and receive direct messages           |
| **Group chat**              | Up to 500 members per group                |
| **Online status**           | Show if user is online/last seen           |
| **Message delivery status** | Sent → Delivered → Read receipts           |
| **Message history**         | Fetch past messages (pagination)           |
| **Media sharing**           | Images, files (optional; defer to Phase 2) |

### Non-Functional Requirements

| Requirement      | Target                                    |
| ---------------- | ----------------------------------------- |
| **Latency**      | Message delivery: <500ms                  |
| **Scale**        | 500M users; 100M DAU; 50B messages/day    |
| **Consistency**  | Message ordering guaranteed within a chat |
| **Availability** | 99.99%                                    |

---

### Estimation

```
50B messages/day = 50B / 86400 ≈ 578,000 messages/sec ≈ 580K RPS

Average message size: 100 bytes
Daily storage: 50B × 100B = 5 TB/day
5-year storage: 5TB × 365 × 5 ≈ 9.1 PB (need sharding + tiered storage)

Concurrent connections (WebSocket):
  100M DAU × 50% online simultaneously = 50M concurrent WebSocket connections
  Each server handles ~50K connections → need 1,000 chat servers

Online status updates:
  Users send heartbeat every 30 sec
  50M online × 1 heartbeat/30s ≈ 1.67M status updates/sec
```

---

## Part 2: High-Level Design + Detailed Design

---

### Core Communication: WebSocket

```
WHY WEBSOCKET FOR CHAT:
  HTTP (polling): Client polls every 1s → wasteful, 1s latency
  HTTP Long Poll: Better, but server holds connections; complex
  WebSocket: Persistent bidirectional connection; server PUSHES to client
    → Real-time; efficient; industry standard for chat

CONNECTION FLOW:
  Client → [WebSocket Connect] → [Chat Server]
  Chat Server maintains: {user_id → connection}

  Send message:
    Sender → WebSocket → Chat Server A
    Chat Server A → routes to → Chat Server B (where receiver is connected)
    Chat Server B → WebSocket → Receiver

CROSS-SERVER ROUTING:
  Problem: sender connected to Server A; receiver on Server B
  Solution: use a pub/sub layer between servers
    Chat Server A → Redis Pub/Sub channel "user:{receiver_id}" → Chat Server B
    Chat Server B pushes to receiver
```

---

### High-Level Architecture

```
[Client]
   ↕ WebSocket
[Chat Server (ECS/EC2)] — {user_id → ws_conn} in-memory map
        ↓                    ↑
  [Redis Pub/Sub]  ←─────────┘  (cross-server message routing)
        ↓
  [Message Queue (SQS)] — for async persistence
        ↓
  [Message Persist Lambda]
        ↓
  [DynamoDB — messages table]

SUPPLEMENTARY SERVICES:
  [Presence Service]  → Redis (heartbeat: user_id → last_seen timestamp)
  [User Service]      → RDS (user profiles)
  [Media Service]     → S3 + CloudFront (image uploads)
  [Notification Service] → APNs/FCM (offline push notifications)

API GATEWAY (HTTP):
  POST /messages → for offline send (fallback if WebSocket down)
  GET /messages?chat_id=X&before=ts&limit=50 → fetch history
  GET /users/{id}/presence → online status
```

---

### Message Flow (1:1 Chat)

```
ONLINE RECEIVER:
1. Sender types "Hello" → WebSocket frame to Chat Server A
2. Chat Server A:
   a. Validate sender auth (JWT)
   b. Generate message_id (Snowflake ID — sortable, unique)
   c. Publish to Redis channel: "user:{receiver_id}" with message payload
   d. Enqueue to SQS for persistence (async)
   e. Return ACK to sender (message_sent status)
3. Chat Server B subscribed to "user:{receiver_id}":
   a. Receives message from Redis
   b. Pushes to receiver via WebSocket
   c. Receiver receives message in <100ms
4. Receiver sends "delivered" ack → Chat Server B → Redis → Chat Server A → Sender
5. SQS → Lambda → DynamoDB (persisted within seconds)

OFFLINE RECEIVER:
1. Steps 1-2d same
2. Redis Pub/Sub: no subscriber for that user (offline)
3. Chat Server A detects no delivery → triggers Notification Service
4. Notification Service → APNs/FCM push notification
5. When receiver comes online: fetch missed messages from DynamoDB
```

---

### Data Model

```
Table: messages (DynamoDB)
  PK: chat_id          (for 1:1: sorted user_ids "usr123#usr456"; for group: group_id)
  SK: message_id       (Snowflake ID — sortable by time)
  Attributes:
    sender_id: "usr-123"
    content: "Hello!"
    type: "text" | "image" | "file"
    created_at: timestamp
    status: "sent" | "delivered" | "read"
    TTL: optional (auto-delete after 7 years)

  Access patterns:
    Get messages for chat (newest 50): Query(PK=chat_id) ORDER BY SK DESC LIMIT 50
    Get messages before cursor: Query(PK=chat_id, SK < cursor) LIMIT 50

Table: chats (DynamoDB)
  PK: user_id
  SK: chat_id
  Attributes:
    last_message_preview: "Hello!"
    last_message_at: timestamp
    unread_count: 3

  Access pattern: Get all chats for a user (inbox view)

Redis: Presence
  Key: "presence:{user_id}"
  Value: last_heartbeat_timestamp
  TTL: 60 seconds (auto-expire when user goes offline)
```

---

## Part 3: Scaling, Failure Handling & AWS Architecture

---

### Scaling Strategy

| Challenge                                 | Solution                                                             |
| ----------------------------------------- | -------------------------------------------------------------------- |
| **50M concurrent WebSocket connections**  | 1,000 chat servers × 50K connections each; NLB distributes           |
| **580K messages/sec persistence**         | SQS buffers; DynamoDB auto-scales; batch writes                      |
| **Redis Pub/Sub at scale**                | Redis Cluster; shard channels by user_id hash                        |
| **Message history for large groups**      | DynamoDB GSI; paginate; cache recent messages in Redis               |
| **Large group chat fanout (500 members)** | Fan out to 500 Redis channels or use a group channel; SQS per member |

---

### Failure Handling

| Failure                                      | Handling                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| **Chat Server crashes**                      | Client auto-reconnects WebSocket; NLB routes to new server     |
| **Redis down (pub/sub)**                     | Fall back to HTTP polling briefly; alert; Redis replicas       |
| **Message not delivered (receiver offline)** | Push notification; receiver fetches from DynamoDB on reconnect |
| **Duplicate message delivery**               | Deduplicate by message_id on receiver side                     |
| **Message ordering**                         | Snowflake IDs (time-sortable) ensure ordering; SK in DynamoDB  |
| **SQS message lost**                         | DLQ captures failures; alert and reprocess                     |

---

### AWS Architecture

```
[Client (Mobile/Web)]
      ↕ WebSocket
[Network Load Balancer] — sticky sessions (same server for WebSocket)
      ↓
[ECS Fargate: chat-servers] — 1,000 tasks, each handling 50K connections
  In-memory: {user_id → websocket_connection}

      ↓ publish message
[ElastiCache Redis Cluster]
  Pub/Sub: channel "user:{id}" per user
  Presence: "presence:{id}" → TTL 60s heartbeat

      ↓ SQS for async persistence
[SQS: messages-queue (FIFO per chat_id)]
      ↓
[Lambda: persist-messages]
      ↓
[DynamoDB: messages table]
  - Auto-scaling read/write capacity
  - DynamoDB Streams → Lambda → update unread_count in chats table

MEDIA:
[Client uploads] → [S3 presigned URL] → [S3]
[S3] → [Lambda: generate-thumbnail] → [S3 thumbnails/]
[CloudFront] → serves images/videos

OFFLINE PUSH:
Chat Server detects offline (no Redis subscriber)
→ SQS: push-notification-queue
→ Lambda: push-worker → APNs/FCM

MONITORING:
  CloudWatch: WebSocket active connections per server
  Alert: connections > 45K/server (scale out)
  Alert: message persistence lag > 5s (SQS queue depth)
  X-Ray: trace message from send to delivery
```

---

### Interview Answer (2-min verbal walkthrough)

> _"Chat requires real-time bidirectional communication — WebSocket is the right choice over polling. Each user maintains a persistent WebSocket connection to a chat server._
>
> _When User A sends a message to User B: the message goes to Chat Server A, which publishes it to Redis Pub/Sub channel `user:{B_id}`. Chat Server B, subscribed to that channel, receives it and pushes to User B. This handles cross-server routing. Simultaneously, the message is enqueued to SQS for async DynamoDB persistence._
>
> _For offline users: Redis Pub/Sub has no subscriber, so I trigger a push notification (APNs/FCM). When they come online, they fetch missed messages from DynamoDB using a paginated query by chat_id._
>
> _Scale: 50M concurrent connections = ~1,000 servers at 50K connections each, behind a Network Load Balancer with sticky sessions. Message ordering: Snowflake IDs as DynamoDB sort keys."_

---

### Common Interview Questions

**Q1: How does message read receipt work?**

> When receiver views the message: client sends a WebSocket frame `{type: "read_ack", message_ids: ["msg-123", "msg-124"]}`. Chat server updates DynamoDB: `UpdateItem(PK=chat_id, SK=message_id, status=read)`. Chat server also notifies sender via Redis Pub/Sub: publish to `user:{sender_id}` channel that their messages were read. Sender's chat server receives the pub/sub event and pushes the read receipt to sender via WebSocket. Batch read acks: when user opens chat, send ack for all messages in view at once (not per-message).

**Q2: How do you handle group chat at scale?**

> For groups of 100-500 members, fan-out on write is expensive. Two approaches: (1) Fan-out on write: when a message is sent, publish to all 500 members' Redis channels simultaneously. Simple but expensive for large groups. (2) Fan-out on read: store the message once; clients fetch new messages by polling (or WebSocket triggers a "new message" ping). Clients query DynamoDB for messages after their last-seen timestamp. WhatsApp uses fan-out on write up to a limit; for very large groups switches to a pull model. Practical split: < 100 members: fan-out on write. 100-500: fan-out on write with batching. 500+: fan-out on read.

**Q3: How do you handle end-to-end encryption?**

> E2E encryption: messages are encrypted on sender's device; only the recipient's device can decrypt. Server stores ciphertext only — can't read messages. Key exchange: use Signal Protocol (used by WhatsApp, Signal). Each user has a key bundle (identity key, signed prekey, one-time prekeys) stored on server. On first message: sender fetches receiver's key bundle → derives shared secret (Diffie-Hellman). All subsequent messages encrypted with derived keys. Server design impact: server can't search message content, can't provide backup decrypt, can't help law enforcement. Metadata (who sent to whom, when) is still visible to the server.

---

> **Next Topic →** [05 · E-Commerce Backend](./05-ecommerce-backend.md)
