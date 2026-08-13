# upExpense — Engagement & Rewards Plan

**Author:** Upeksha Herath · **Date:** 2026-08-13

Companion to `PRD.md`. Covers *why* someone opens this app on day 40, not just
day 1.

---

## 1. The problem

An expense tracker is **input now, payoff later**. The user pays the cost
(typing) every single day and collects the value (reports) once a month. That
gap is where tracking apps die.

Fix: move a slice of the payoff to the moment of entry.

## 2. Two rules

1. **Reward the logging, never the spending.** "🎉 You spent Rs. 40,000!" is an
   insult. "Day 12 logged 🔥" is not.
2. **Never guilt.** No "you haven't logged in 3 days 😢". Shame kills apps
   faster than boredom.

---

## 3. Reward tiers

Frequency decides the form. Only tier 4 is allowed to interrupt.

| Tier | Frequency | Form | Interrupts? |
|------|-----------|------|-------------|
| 1 — Micro | every save | button ✓ morph, row flies in, totals count up, haptic tap | no |
| 2 — Daily | once a day | toast, streak flame ticks | no |
| 3 — Weekly | once a week | inline card on the day view | no |
| 4 — Milestone | rare, once per account | modal + confetti | yes |

**Hard budget: one modal per day.** A queued milestone waits for tomorrow, or
degrades to a toast. Break this and confetti becomes noise.

---

## 4. Tier 1 — Micro-feedback

Every save, under 300 ms, no copy at all:

- Submit button → spinner → green ✓ → back to normal.
- New row slides in with a flash of its category colour.
- Day totals **count up** to the new number instead of snapping.
- `navigator.vibrate(10)` on mobile — cheap, makes the app feel physical.

No database work. Biggest felt improvement per hour spent.

## 5. Tier 2 — Streak engine

The main retention lever. Streak = consecutive days with **at least one entry**.
Not amount, not budget — logging only.

- Flame + count in the nav bar, always visible: `🔥 12`.
- First save of the day → toast: `Day 12. Streak intact.`
- **Grace day:** one miss per rolling 7 days is forgiven, surfaced as
  `🔥 12 (1 skip left)`. Without it, a single busy day ends the streak and the
  user quits. This is the most important detail on this page.
- Milestones at 3 / 7 / 14 / 30 / 100 days escalate to tier 4.

Computed server-side: RPC over `distinct expense_date`, gap-scan.

**Zero-spend day** — the other half of tier 2. On an empty day the view offers
`[ Nothing spent today 🧘 ]`, which records a `no_spend_days` row, keeps the
streak alive and rewards *not* spending. It converts the app's churn moment
("nothing to log, why open it") into a win.

## 6. Tier 3 — Weekly review

Sunday, dismissible inline card at the top of the day view. One number, one
funny line, rule-based (no AI):

- `7/7 days logged. Frankly, suspicious.`
- `Food ate 41% of your week. Literally.`
- `3 no-spend days. Monk behaviour.`

Reuses the existing `category_totals` / `daily_totals` RPCs.

## 7. Tier 4 — Milestone modals

One-time per account, confetti, big emoji.

| Key | Trigger | Copy |
|-----|---------|------|
| `first_expense` | first expense saved | Look at you, adulting! |
| `first_income` | first income saved | Money came IN? Bold move. |
| `first_no_spend` | first zero-spend day | A whole day, wallet untouched. Zen master. |
| `streak_7` | 7-day streak | One week straight. Habit forming — resistance futile. |
| `streak_30` | 30-day streak | 30 days. You're not tracking expenses any more, you're just… like this now. |
| `entries_100` | 100th entry | 100 entries logged. Your spreadsheet-loving ancestors are proud. |
| `full_deck` | every category used once | Every category used. Completionist detected. |
| `first_green_month` | month where income > expenses | Ended the month in the green. Cue smug face. |
| `budget_survived` | first month under budget | Budget: survived. Barely counts as a miracle. |

## 8. Ambient progress

No popups — progress that is simply *visible*:

- **Calendar heatmap** (PRD P2-1) doubles as the reward surface; filling squares
  is intrinsically satisfying. Worth pulling forward.
- Budget rings, green → amber → red (P2-2).
- Month grid: `18/31 days logged`.

## 9. Monthly Wrapped

End-of-month, Spotify-style: five swipeable cards and one shareable image.
Highest single-shot engagement in the app — build it once real data exists.

---

## 10. Data model

```sql
achievements  (user_id, key, earned_at)         -- primary key (user_id, key)
no_spend_days (user_id, day)                    -- primary key (user_id, day)
profiles.celebrations_enabled boolean           -- user kill switch
```

Unlocks go through `claim_achievement(p_key)`: one round-trip, `insert … on
conflict do nothing`, returns `true` only for a genuinely new unlock. Atomic —
no read-then-write race, no double confetti across two tabs.

Achievement copy lives client-side in a registry (`components/rewards/
registry.ts`), keyed by the same string. The database stores keys, never text.

---

## 11. Build order

1. ✅ Tier 1 micro-feedback — no DB, biggest felt difference.
2. ✅ Toast primitive — blocks tiers 2 and 3.
3. ✅ Reward engine — `achievements` table, `claim_achievement`, registry,
   modal, one-modal-a-day cap.
4. ✅ Streak — `current_streak(p_today)` RPC, nav-bar flame, grace day,
   milestones at 7 / 30 / 100.
5. ✅ Zero-spend day button.
6. Calendar heatmap (pulled forward from PRD P2).
7. Weekly review card.
8. Monthly Wrapped.

## 12. Anti-annoyance rules

- Modals only for once-per-account unlocks. Never for repeatable events.
- One modal per day, hard cap; the rest degrade to toasts.
- Confetti never blocks the form — the user can keep typing behind it.
- Settings toggle writes `profiles.celebrations_enabled`.
- Funny once, never smug, never nagging.
