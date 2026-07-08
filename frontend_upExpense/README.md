# upExpense

Personal expense tracker — Next.js 16 frontend, Supabase backend (Postgres + Auth + RLS).

See [PRD.md](./PRD.md) for full requirements. Phase 1 (MVP) is implemented:

- Signup / login / logout (email + password, username stored in `profiles`)
- Daily expense entry: date navigation, category chips, notes, cash/card, edit/delete
- Category management: add, rename, recolor, delete (expenses reassigned to "Other")
- Reports: monthly & yearly — totals, per-category bars with drill-down, daily/monthly columns

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Open **SQL Editor** and run the migration: [`../supabase/migrations/001_init.sql`](../supabase/migrations/001_init.sql).
   This creates `profiles`, `categories`, `expenses`, RLS policies, the new-user
   trigger (seeds 10 default categories), and the report functions.
3. Optional: **Authentication → Providers → Email** — disable "Confirm email"
   for instant signup during development.

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in from Supabase Dashboard → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign up, then
you land on today's day view.

## Structure

```
src/
├── proxy.ts                     # Next 16 proxy (middleware): session refresh + route guard
├── lib/
│   ├── supabase/                # browser / server / proxy Supabase clients
│   ├── format.ts                # money + local-date helpers (no TZ bugs)
│   └── types.ts
├── components/
│   ├── auth.tsx                 # AuthShell, PasswordInput
│   ├── nav-bar.tsx
│   └── day-view.tsx             # entry form + expense list
└── app/
    ├── login/  signup/          # public pages
    └── (app)/                   # authenticated pages
        ├── day/[date]/          # daily entry (YYYY-MM-DD in URL)
        ├── categories/
        └── reports/             # month/year tabs, drill-down
```

## Notes

- All authorization is enforced by Postgres RLS (`user_id = auth.uid()`); the
  frontend never filters by user id.
- Report aggregation happens in Postgres via `category_totals`, `daily_totals`,
  `monthly_totals` RPC functions (PRD RPT-4).
- Default category colors are a CVD-validated 10-slot categorical palette; all
  charts also carry direct text labels so identity never relies on color alone.
