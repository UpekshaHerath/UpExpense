-- upExpense — profile avatars
--
-- Adds a custom profile picture users can upload/change/remove. Google
-- sign-in also provides a photo, but that is read live from the auth
-- user's metadata in the UI (avatar_url / picture) — we only persist a
-- value here when the user uploads or removes a *custom* image.
--
-- Deliberately does NOT redefine handle_new_user(): the signup trigger
-- already creates the profile row (username = email prefix for OAuth users)
-- and seeds default categories. Keeping this migration off that function
-- avoids clobbering other migrations that also touch it.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

-- ---------------------------------------------------------------------------
-- 1. Custom avatar URL on the profile.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

-- ---------------------------------------------------------------------------
-- 2. Storage bucket for avatar images (public read; CDN-served).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS — anyone can read; a user may only write within a folder
--    named after their own uid (path: "<uid>/<file>").
-- ---------------------------------------------------------------------------
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: own insert" on storage.objects;
create policy "avatars: own insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: own update" on storage.objects;
create policy "avatars: own update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: own delete" on storage.objects;
create policy "avatars: own delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
