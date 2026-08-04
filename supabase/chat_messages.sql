-- ── Live community chat (Cameras page) ────────────────────────────────────
-- Run this in the Supabase SQL editor for the same project the frontend
-- connects to (VITE_SUPABASE_URL). Safe to re-run.

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  -- Derived from the authenticated session by default; the RLS check below
  -- rejects any client-supplied value that is not the caller's own id.
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  sender_name text not null default 'User',
  content     text not null check (char_length(content) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

-- Everyone (including guests) can read the community chat.
drop policy if exists "chat_messages_select_all" on public.chat_messages;
create policy "chat_messages_select_all"
  on public.chat_messages for select
  using (true);

-- Only signed-in users can post, and only as themselves.
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No update/delete policies on purpose: messages are immutable.

-- Realtime: broadcast inserts to subscribed clients (idempotent).
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;