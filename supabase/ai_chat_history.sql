-- ── AI Chat history (per-user persisted conversations) ──────────────────
-- Run this in the Supabase SQL editor. Safe to re-run.

create table if not exists public.ai_chat_history (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  messages  jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_chat_history enable row level security;

drop policy if exists "ai_chat_history_select_own" on public.ai_chat_history;
create policy "ai_chat_history_select_own"
  on public.ai_chat_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_chat_history_insert_own" on public.ai_chat_history;
create policy "ai_chat_history_insert_own"
  on public.ai_chat_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "ai_chat_history_update_own" on public.ai_chat_history;
create policy "ai_chat_history_update_own"
  on public.ai_chat_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
