-- upExpense — per-user currency
--
-- profiles.currency has existed since 001 (default 'LKR') but nothing read it.
-- The app now formats every amount in the user's own currency and asks new
-- accounts to pick one on first login.
--
-- currency_confirmed_at records that the user actually chose — a null means
-- "still on the default, show the picker". Amounts are stored as plain numbers
-- and never converted; the currency is a display setting.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

alter table public.profiles
  add column if not exists currency_confirmed_at timestamptz;

-- Existing accounts have been logging in rupees all along — keep them on LKR
-- without interrupting them. Only accounts created after this get the picker.
update public.profiles
set currency_confirmed_at = now()
where currency_confirmed_at is null;

-- ISO 4217 alphabetic codes only: three upper-case letters.
alter table public.profiles drop constraint if exists profiles_currency_check;
alter table public.profiles
  add constraint profiles_currency_check
  check (currency ~ '^[A-Z]{3}$');
