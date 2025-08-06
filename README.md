# Scalable Likes System – Social Media Event-Driven Architecture

This project replicates how social media platforms handle **millions of likes per second** with **Redis caching with TTL**, **immediate like state tracking**, **Kafka-based post count updates**, **state machine-driven event processing**, **eventual consistency** and **idempotent writes with retries**.

---

## Tech Stack

| Layer       | Tech                 |
| ----------- | -------------------- |
| Frontend    | React + Tailwind CSS |
| Backend     | NestJS + TypeORM     |
| Database    | PostgreSQL           |
| Cache Layer | Redis (with TTL)     |
| Messaging   | Kafka                |
| State Mgmt  | Custom State Machine |

---

## How to run

Create env file based off .env.example, update docker-compose.yml with database password, run docker-compose up

---

## Architectural Overview

```
Client
  ↓
[React + Tailwind UI] ➔ POST /like
  ↓
[NestJS API Gateway]
  - Updates likes table immediately (user liked/unliked state)
  - Produces Kafka event for post count update
  ↓
[Kafka Topic: post-count-events]
  ↓
[NestJS Kafka Consumer Service + State Machine]
  - Event created with PENDING status
  - Idempotency check
  - State transitions: PENDING → RETRYING → SUCCESS/FAILED
  - Updates posts.like_count with retries
  - Exponential backoff on failure
  ↓
[PostgreSQL posts table]
  - Updated like count

For Like Count Retrieval:
Client ➔ GET /like/count/:id
  ↓
Redis Check (with TTL)
  ↓ (if miss)
PostgreSQL Query ➔ Update Redis with TTL
```

---

## State Machine Flow

### Event Processing States

```
PENDING ──(retry)──> RETRYING ──(retry)──> RETRYING
   │                     │                     │
   │                     │                     │
   └─(success)──> SUCCESS │                     │
   │                     └─(success)──> SUCCESS │
   └─(fail)────> FAILED   └─(fail)────> FAILED
```

### State Transitions

| From State | Event        | To State | Action                |
| ---------- | ------------ | -------- | --------------------- |
| PENDING    | SET_RETRYING | RETRYING | Increment retry_count |
| PENDING    | SET_SUCCESS  | SUCCESS  | Mark as processed     |
| PENDING    | SET_FAILED   | FAILED   | Send to DLQ           |
| RETRYING   | SET_RETRYING | RETRYING | Increment retry_count |
| RETRYING   | SET_SUCCESS  | SUCCESS  | Mark as processed     |
| RETRYING   | SET_FAILED   | FAILED   | Send to DLQ           |

---

## Core Concepts

### Immediate Like State + Async Count Updates

- **User like/unlike state is tracked immediately** in the `likes` table for instant UI feedback.
- **Post like counts are updated asynchronously** via Kafka to maintain performance.
- **Redis caches like counts with TTL** to reduce database load.

---

### State Machine-Driven Event Processing

- Each Kafka event goes through a **state machine** that tracks processing status.
- **PENDING**: Event received and queued for processing
- **RETRYING**: Event failed and is being retried with exponential backoff
- **SUCCESS**: Event processed successfully
- **FAILED**: Event failed after all retries and sent to dead letter queue

---

### Redis TTL Strategy

- Like counts are cached in Redis with a **configurable TTL (e.g., 5 minutes)**.
- On cache miss, the system queries the database and refreshes the cache.
- This ensures eventual consistency without requiring background sync jobs.

---

### Idempotency

- Each post count update event contains a unique `event_id` (UUID).
- Events are processed exactly once using database constraints.
- **State machine prevents duplicate processing** of the same event.

---

### Exponential Backoff (Kafka Consumer)

On failure to update post counts:

- State transitions from PENDING → RETRYING
- Retry the same event with increasing delays:
  ```
  1s → 2s → 4s → 8s → 16s (max retries: 5)
  ```
- State tracks retry_count and increments on each RETRYING transition
- If all retries fail, state transitions to FAILED and message goes to DLQ

---

## Database Schema

### Table: `likes`

```sql
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
```

### Table: `posts`

```sql
CREATE TABLE posts (
  id BIGINT PRIMARY KEY,
  like_count BIGINT DEFAULT 0
);
```

### Table: `post_count_events` (with State Machine)

```sql
CREATE TABLE post_count_events (
  event_id UUID PRIMARY KEY,
  post_id BIGINT NOT NULL,
  delta INTEGER NOT NULL, -- +1 for like, -1 for unlike
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, RETRYING, SUCCESS, FAILED
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

---

## Redis Design

### Redis Keys

| Key                         | Type   | TTL       | Purpose           |
| --------------------------- | ------ | --------- | ----------------- |
| `post:{post_id}:like_count` | String | 5 minutes | Cached like count |

---

## API Documentation

### Available Endpoints

| Method | Endpoint          | Description                            |
| ------ | ----------------- | -------------------------------------- |
| POST   | `/like`           | Toggle like/unlike (immediate + async) |
| GET    | `/like/count/:id` | Get like count (Redis → DB fallback)   |

### Example API Usage

#### Toggle Like

```bash
curl -X POST http://localhost:3001/like \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": 123,
    "user_id": 456
  }'
```

#### Get Like Count

```bash
curl http://localhost:3001/like/count/123
```

---

## Kafka Events

### Post Count Update Event

```json
{
  "event_id": "uuid-v4",
  "post_id": 123,
  "delta": 1,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Fault Tolerance

- If Kafka fails: Like states are still updated; post counts will be eventually consistent when Kafka recovers.
- If Redis fails: System falls back to database queries.
- If Database fails: State machine tracks retries with exponential backoff and eventually moves to FAILED state.
- **State machine ensures no event is lost** and provides full audit trail.

---

## Summary

| Feature               | Implementation                       |
| --------------------- | ------------------------------------ |
| Instant like feedback | Direct `likes` table updates         |
| Cached like counts    | Redis with TTL                       |
| Async count updates   | Kafka + consumer with state machine  |
| Event state tracking  | PENDING → RETRYING → SUCCESS/FAILED  |
| Cache invalidation    | TTL-based (no manual sync)           |
| Retry on failure      | State machine + exponential backoff  |
| Idempotent writes     | Event deduplication + state tracking |
| UI responsiveness     | Sub-millisecond Redis reads          |
| Audit trail           | Complete event lifecycle in database |

---
