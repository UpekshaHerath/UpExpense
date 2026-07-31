-- upExpense — re-adjustable avatar crops
--
-- 005_avatars.sql stored only the finished picture. Users could not go back
-- and reframe it, and a second crop of an already-cropped image loses detail
-- for good. This migration keeps the untouched upload alongside the crop, plus
-- the transform that produced it, so "Adjust" reopens the editor exactly where
-- the user left off and always re-crops from full resolution.
--
--   avatar_url          → the square, circle-ready image the UI renders
--   avatar_original_url → the raw upload it was cut from
--   avatar_crop         → {"zoom":1,"nx":0,"ny":0,"rotation":0}
--                         nx/ny are pans expressed in crop-box widths, so the
--                         framing is independent of the editor's pixel size.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

alter table public.profiles
  add column if not exists avatar_original_url text,
  add column if not exists avatar_crop jsonb;

-- No new storage policies needed: originals live under the same
-- "<uid>/..." prefix in the avatars bucket that 005 already scoped by RLS.
