# Chapter 16 — Scaling and Infrastructure

A demo runs on one process on one laptop. A product serves many users concurrently, holds long-lived streaming connections, processes files, and calls slow external APIs — all without falling over. This chapter covers the infrastructure patterns that take an agent from "works for me" to "works for everyone," and where the bottlenecks actually are.

## What's different about scaling an agent

Agents stress infrastructure in specific ways:

- **Long-lived connections.** Streaming turns hold a connection open for many seconds. A server that assumes short requests will exhaust its connection pool.
- **Slow, external bottleneck.** The dominant latency is the *model provider*, which you don't control. Your own compute is often nearly idle while waiting on the model.
- **Bursty, heavy work.** File processing and bulk extraction spike CPU and memory unpredictably.
- **Rate limits upstream.** Providers and external APIs cap your throughput; scaling your own fleet doesn't help if you hit their ceiling.

So scaling an agent is less about raw compute and more about concurrency, statelessness, and respecting upstream limits.

## Statelessness: the foundation

The single most important property for horizontal scaling is **stateless application servers**. Each request should be servable by any instance, carrying no in-memory state between requests. Achieve it by:

- Keeping all durable state in shared stores (database, object storage, cache), not in process memory.
- Making the agent loop a function of its inputs — it loads context from the database at the start and writes results at the end (Chapters 2, 9), holding nothing between turns.
- Carrying session/identity in tokens validated per request (Chapter 11), not server-side session memory.

With stateless servers, you scale by adding instances behind a load balancer, and any instance can handle any user.

## Handling streaming connections at scale

Long-lived SSE connections need attention:

- **Async, non-blocking I/O.** Use a server model that handles many concurrent open connections cheaply (event-loop or async runtimes), since most connections are just *waiting* on the model. A thread-per-connection model would exhaust threads quickly.
- **Proxy configuration.** Reverse proxies and load balancers must allow long-lived streaming connections and not buffer them (or the real-time feel dies). Configure timeouts and buffering accordingly.
- **Connection cleanup.** When a client disconnects mid-stream, release resources and abort the in-flight model call so abandoned turns stop consuming tokens and compute.
- **Graceful shutdown / deploys.** Draining a server with open streams needs care so in-flight turns finish or fail cleanly rather than being cut off.

## Move heavy work off the request path

CPU/memory-heavy or slow work — document conversion, OCR, large bulk extraction — shouldn't run inside the request that holds a user's connection. As load grows, move it to **background workers** fed by a **queue**:

- The request enqueues a job and returns quickly (with a `processing` status; Chapter 9).
- Workers pull jobs, do the heavy work, and update status; the client polls or subscribes for completion.
- Workers scale independently of the web tier, so a burst of uploads doesn't starve interactive chat.

As emphasized in Chapter 10, *design for this from the start with status fields even if you begin synchronous* — the migration to workers is then localized.

## Respect and manage upstream rate limits

You can scale your fleet infinitely and still be capped by the model provider's rate limits. Manage them deliberately:

- **Concurrency control / queuing** toward providers so you don't blow past limits and trigger errors.
- **Backoff and retry** on rate-limit responses (Chapter 13).
- **Spread load** across providers or accounts where appropriate; tiering (Chapter 14) also helps by sending bulk work to higher-throughput smaller models.
- **Cache** to avoid redundant calls (Chapter 9).

When fanning out parallel work (bulk extraction), bound the fan-out to stay within limits rather than firing thousands of simultaneous calls.

## Data tier scaling

The database and storage have their own scaling story:

- **Connection pooling.** Many app instances × many connections can overwhelm a database; use a pooler. (Note that schema-migration/DDL connections sometimes need a separate, unpooled path.)
- **Indexing for access paths.** Index the columns your hot queries filter and sort on (per-user, per-project, per-document-by-time). Avoid N+1 queries by batching lookups (e.g. resolve many artifacts' current versions in one query).
- **Object storage for blobs.** Keep large content in object storage, the database for metadata and pointers (Chapter 9). Object storage scales effectively infinitely; your database stays lean.
- **Read/write patterns.** As you grow, consider read replicas for heavy read paths, and keep write paths (the turn-persistence) lean.

## Caching tiers

Introduce caching where it pays:

- **External-API cache** (a table or a fast cache like Redis) for slow/rate-limited upstream calls.
- **Hot-data cache** for frequently-read, rarely-changed data.
- **Provider prompt caching** by keeping a stable context prefix (Chapter 14).

Add these as evidence (from observability, Chapter 15) shows a hotspot — not preemptively.

## Don't over-build early

A caution: it's easy to design a microservice-and-queue cathedral before you have users. The pragmatic path:

- **Start as a single well-structured service** with a relational DB and object storage. This scales remarkably far with stateless instances behind a load balancer.
- **Keep the seams ready** — status fields for future async, a provider abstraction, stateless servers — so you can extract workers and add caches *when the load justifies it*.
- **Let observability drive infra decisions.** Add the queue when synchronous processing actually hurts; add the cache when a call is actually hot; add replicas when reads actually saturate. Build for the scale you have plus a bit, not the scale you fantasize about.

## Deployment and operational basics

- **Containerize** so the runtime (including any subprocess dependencies like a document converter) is reproducible.
- **Health checks** so the load balancer routes only to healthy instances.
- **Horizontal autoscaling** on the stateless web tier based on connections/CPU; separate scaling for workers based on queue depth.
- **Config via environment** (secrets in a manager; Chapter 12), so the same image runs in every environment.
- **Observability and alerting** (Chapter 15) so you see saturation and failures before users do.

## The scaling mindset

Scaling an agent is mostly about **statelessness, concurrency, and respecting the slow external bottleneck**. Keep servers stateless so you can add them freely; use async I/O so idle streaming connections are cheap; push heavy work to workers behind a queue; keep blobs in object storage and metadata in a well-indexed database; cache and rate-limit toward upstreams; and let real measurements — not speculation — tell you when to add the next piece of infrastructure.

---

Next: [Chapter 17 — Domain-specific and regulated-industry agents](chapter-17-domain-and-compliance.md)
