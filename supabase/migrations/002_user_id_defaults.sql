-- Fix: client inserts don't include user_id, so RLS "with check
-- (user_id = auth.uid())" rejected them. Defaulting user_id to the
-- authenticated user makes inserts pass and keeps the column out of
-- client payloads entirely.

alter table public.categories
  alter column user_id set default auth.uid();

alter table public.expenses
  alter column user_id set default auth.uid();
