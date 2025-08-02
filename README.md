# Scalable Likes System – Social Media Event-Driven Architecture

This project i did up replicates how social media platforms handles **millions of likes per second** with **eventual consistency**, **Kafka-based decoupling**, **Redis caching**, **idempotent writes**, and **resilient retries**.

---

## Tech Stack

| Layer       | Tech                 |
| ----------- | -------------------- |
| Frontend    | React + Tailwind CSS |
| Backend     | NestJS + TypeORM     |
| Database    | PostgreSQL           |
| Cache Layer | Redis                |
| Messaging   | Kafka                |

---

## Architectural Overview

```
Client
  ↓
[React + Tailwind UI] ➔ POST /like
  ↓
[NestJS API Gateway]
  - Increments Redis like count
  - Produces Kafka event
  ↓
[Kafka Topic: like-events]
  ↓
[NestJS Kafka Consumer Service]
  - Idempotency check
  - Write to PostgreSQL with retries
  - Exponential backoff on failure
  ↓
[PostgreSQL]
  - Durable storage
  ↓
[Background Sync Job]
  - Periodically syncs DB counts back to Redis
```

---

## Core Concepts

### Eventual Consistency

- **Users see real-time like counts from Redis**.
- **Writes to PostgreSQL happen asynchronously via Kafka**.
- Redis and DB eventually converge using a background sync job.

---

### Idempotency

- Each like event contains a unique `event_id` (UUID).
- DB table `likes` uses `event_id` as a unique constraint to **prevent duplicate writes**.

---

### Exponential Backoff (Kafka Consumer)

On failure to write to PostgreSQL:

- Retry the same event with increasing delays:
  ```
  1s → 2s → 4s → 8s (max retries: 5)
  ```
- If all retries fail, move the message to a **dead-letter topic** (`like-events-dlq`) for alerting or manual intervention.

---

## State Machine: Like Processing Lifecycle

| State      | Description                      | Trigger                         |
| ---------- | -------------------------------- | ------------------------------- |
| `pending`  | Event produced to Kafka          | Redis increment + Kafka emit    |
| `retrying` | Kafka consumer retrying DB write | PostgreSQL write failed         |
| `success`  | Like persisted to PostgreSQL     | Kafka consumer write successful |
| `failed`   | Max retries exceeded             | Event sent to dead-letter topic |

---

## Redis Design

Used as the **fast-access layer** to handle spikes in read/write traffic.

### Redis Keys

| Key                         | Type   | Purpose                   |
| --------------------------- | ------ | ------------------------- |
| `post:{post_id}:like_count` | String | Tracks current like count |

> Redis is **not the source of truth**, but the **live cache** for speed.

---

## PostgreSQL Schema

### Table: `likes`

```sql
CREATE TABLE likes (
  event_id UUID PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `posts`

```sql
CREATE TABLE posts (
  id BIGINT PRIMARY KEY,
  like_count BIGINT DEFAULT 0
);
```

---

## Background Job – DB to Redis Sync

### When:

- Every few minutes (e.g., via CRON)
- On Redis cold start

### What it does:

```ts
// Pseudocode
for each post_id in DB:
  count = SELECT COUNT(*) FROM likes WHERE post_id = $id
  redis.set(`post:${id}:like_count`, count)
```

---

## API Documentation

This project includes **Swagger/OpenAPI** documentation for all API endpoints.

### Access Swagger UI

Once the backend is running, visit:

```
http://localhost:3001/api/docs
```

### Available Endpoints

| Method | Endpoint          | Description                             |
| ------ | ----------------- | --------------------------------------- |
| POST   | `/like`           | Toggle like/unlike for a post via kafka |
| GET    | `/like/count/:id` | Get real-time like count from redis     |

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

## Fault Tolerance

- If Kafka fails: Redis still counts; DB sync will be delayed.
- If DB fails: Kafka retries with exponential backoff.
- If Redis fails: Warm it up from DB with background sync.

---

## Summary

| Feature               | Supported                   |
| --------------------- | --------------------------- |
| Real-time likes       | via Redis                   |
| Durable storage       | via PostgreSQL              |
| High write throughput | via Kafka                   |
| Retry on failure      | with backoff                |
| Idempotent writes     | via `event_id`              |
| UI responsiveness     | sub-millisecond Redis reads |

---
