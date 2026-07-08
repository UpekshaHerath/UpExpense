# Product Requirements Document — upExpense

**Product:** upExpense — Personal Expense Management Web Application
**Author:** Upeksha Herath
**Date:** 2026-07-08
**Version:** 1.0
**Stack:** Next.js (frontend) · Supabase (backend — Postgres, Auth, RLS)

---

## 1. Overview

### 1.1 Purpose
upExpense is a web application for tracking personal daily expenses. Users record expenses against specific calendar dates, categorize them, and generate reports (monthly and yearly) that support better financial decisions.

### 1.2 Goals
- Make daily expense entry fast enough to become a habit (under 5 seconds per expense).
- Provide clear monthly and yearly visibility into where money goes.
- Support data-driven decisions through category breakdowns, trends, and budgets.

### 1.3 Target Users
Any individual who wants to track personal spending. Anyone can sign up and use the app. Each user's data is fully isolated from other users.

### 1.4 Platform
Responsive web application. Mobile-first design — most expense entry happens on a phone.

---

## 2. Scope

### In Scope
- Email/username + password authentication (signup, login, logout).
- Daily expense entry against any calendar date.
- User-managed expense categories with sensible defaults.
- Monthly and yearly reports with category breakdowns and trends.
- Budgets, recurring expenses, search, insights, and CSV export (later phases).

### Out of Scope (for now)
- Receipt photo upload.
- Multi-currency support and bank account syncing.
- Shared/household accounts.
- Income tracking and net-savings views.
- Native mobile apps.

---

## 3. Phased Feature Requirements

## Phase 1 — MVP

### 3.1 Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-1 | Users can sign up with email + password. Username stored in a `profiles` table (Supabase Auth uses email as the identifier). | Must |
| AUTH-2 | Users can log in with email (or username mapped to email) and password. | Must |
| AUTH-3 | Users can log out. Sessions persist across browser restarts until logout. | Must |
| AUTH-4 | Password minimum 8 characters, with a show/hide toggle on password fields. | Must |
| AUTH-5 | All data access is restricted to the owning user via Supabase Row Level Security (RLS) — not frontend checks alone. | Must |
| AUTH-6 | Clear inline validation errors on signup/login forms (invalid email, weak password, wrong credentials). | Must |

### 3.2 Daily Expense Entry

| ID | Requirement | Priority |
|----|-------------|----------|
| EXP-1 | A date picker/calendar lets the user navigate to any date (past or today). Default is today. | Must |
| EXP-2 | Users can add an expense with: amount (required), category (required), note (optional), payment method — cash/card (optional). | Must |
| EXP-3 | A day can hold multiple expenses. Each expense can be edited or deleted. | Must |
| EXP-4 | The day view lists all expenses for that date with a running day total. | Must |
| EXP-5 | Entry is optimized for speed: amount field autofocused, categories shown as tappable chips (not a dropdown), Enter key saves. Target: under 5 seconds per expense. | Must |
| EXP-6 | Optimistic UI on add/edit/delete — the interface updates instantly, syncs in background. | Should |

### 3.3 Categories

| ID | Requirement | Priority |
|----|-------------|----------|
| CAT-1 | New accounts are seeded with default categories: Petrol, Vehicle Repair, Dayout & Trips, Food, Gym, Supplements, Groceries, Utilities, Health, Other. | Must |
| CAT-2 | Users can create, rename, and delete their own categories. | Must |
| CAT-3 | Each category has a color and an icon for readable charts and chips. | Should |
| CAT-4 | Deleting a category that has expenses reassigns those expenses to "Other". Expense data is never orphaned or lost. | Must |

### 3.4 Basic Reports

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-1 | Monthly report: total spend, per-category breakdown (pie/bar chart), daily spending line chart. | Must |
| RPT-2 | Yearly report: total spend, per-category totals, month-by-month bar chart, top categories, highest-spend month. | Must |
| RPT-3 | Category drill-down: selecting a category in any report shows the list of its expenses in that period. | Must |
| RPT-4 | Report aggregation runs in Postgres (SQL views or Supabase RPC), not client-side loops — must stay fast with years of data. | Must |

---

## Phase 2 — Engagement & Control

| ID | Requirement | Priority |
|----|-------------|----------|
| P2-1 | **Calendar heatmap:** month grid where each day is shaded by spend intensity. Primary navigation surface for the "go to a specific date" flow. | Should |
| P2-2 | **Budgets:** monthly spending limit per category plus an overall limit. Progress bars shift green → amber → red. Contextual messaging, e.g. "80% of Food budget used, 10 days left." | Should |
| P2-3 | **Recurring expenses:** fixed monthly costs (gym fee, insurance, subscriptions) auto-added on a chosen day of month. Can be paused/deactivated. | Should |
| P2-4 | **Search & filters:** filter expenses by note text, category, amount range, and date range. | Should |
| P2-5 | **Comparisons:** month-vs-month and year-vs-year views (e.g. July vs June, 2026 vs 2025). | Should |
| P2-6 | **Quick-add:** floating "+" button on every screen, defaulting to today's date. | Should |
| P2-7 | **Dark mode** with system-preference detection. | Should |
| P2-8 | **Currency setting:** default LKR, user-configurable symbol/format. Single currency per account. | Should |

---

## Phase 3 — Decisions & Intelligence

| ID | Requirement | Priority |
|----|-------------|----------|
| P3-1 | **Insights panel:** rule-based observations, e.g. "Food up 34% vs last month", "Petrol averages Rs. X/month", "Biggest single expense this year". No AI/ML required. | Could |
| P3-2 | **Yearly summary page:** total spend, category ranking, monthly trend, average daily spend, count of no-spend days. | Could |
| P3-3 | **CSV export:** download expenses per month or year. | Could |
| P3-4 | **Spending goals:** target such as "keep monthly total under Rs. X", with streak tracking. | Could |
| P3-5 | **Day notes/tags:** label a day (e.g. "Trip to Kandy") to explain spending spikes in later reports. | Could |

---

## 4. Data Model

```
profiles   (id → auth.users, username, currency, created_at)
categories (id, user_id, name, color, icon, is_default)
expenses   (id, user_id, category_id, amount, note, payment_method,
            expense_date, created_at)
budgets    (id, user_id, category_id nullable, month, amount)          -- Phase 2
recurring  (id, user_id, category_id, amount, note, day_of_month,
            active)                                                    -- Phase 2
```

**Rules:**
- Index on `expenses(user_id, expense_date)` — every core query filters on it.
- RLS policy on every table: `user_id = auth.uid()`.
- `expense_date` stored as Postgres `date` (not timestamp) — an expense belongs to a calendar day; avoids timezone bugs.
- Amounts stored as `numeric`, never floating point.

---

## 5. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Performance | Day view and reports load in under 1 second with several years of data. Aggregations done server-side in Postgres. |
| Responsiveness | Mobile-first layout; fully usable on phone, tablet, and desktop. |
| Security | Supabase Auth for credentials; RLS enforced on all tables; no user data reachable across accounts. |
| Data integrity | No orphaned expenses (category deletion reassigns), no silent data loss, dates unaffected by timezones. |
| UX | Optimistic updates, autofocus on entry fields, keyboard-friendly forms. |

---

## 6. Success Criteria

- A new user can sign up, add an expense, and see it in a monthly report within 2 minutes.
- Adding a single expense takes under 5 seconds for a returning user.
- Yearly report gives an accurate, at-a-glance picture of total spend and top categories.
- Owner (primary user) uses the app daily for 2+ consecutive weeks after MVP release.

---

## 7. Build Order

1. **Phase 1 end-to-end:** auth → daily entry → categories → basic reports.
2. Use the app daily for ~2 weeks.
3. **Phase 2** features, prioritized by real usage friction.
4. **Phase 3** once meaningful data volume exists to power insights.
