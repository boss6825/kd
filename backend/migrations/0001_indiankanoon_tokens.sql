-- Per-user Indian Kanoon API tokens. Stored in their own table rather
-- than extending user_api_keys.provider's check constraint (which is
-- tied to LLM model providers).
--
-- Re-runnable: every statement is `if not exists` or idempotent.

create table if not exists public.user_indiankanoon_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_token text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.user_indiankanoon_tokens from anon, authenticated;

alter table public.user_indiankanoon_tokens enable row level security;
