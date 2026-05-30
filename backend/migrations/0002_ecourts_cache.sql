-- Local response cache for the eCourts India partner API.
--
-- Every authenticated eCourts endpoint costs credits per call, so we cache
-- responses keyed by a normalised "endpoint + params" string. The client
-- wrapper (backend/src/lib/ecourts.ts) checks this table before hitting the
-- network and writes successful responses back with a per-resource TTL.
--
-- Re-runnable: every statement is `if not exists` or idempotent.

create table if not exists public.ecourts_cache (
  cache_key text primary key,
  resource text not null,
  payload jsonb not null,
  request_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Lookups are by primary key (cache_key); this index supports cheap TTL
-- sweeps of expired rows without scanning the whole table.
create index if not exists idx_ecourts_cache_expires_at
  on public.ecourts_cache(expires_at);

-- Backend-owned data: the browser never reads this directly (same posture as
-- every other application table — access goes through the service role).
revoke all on public.ecourts_cache from anon, authenticated;

alter table public.ecourts_cache enable row level security;
