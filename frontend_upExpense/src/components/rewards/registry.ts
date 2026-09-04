/**
 * Copy for every one-time milestone, keyed by the string stored in
 * public.achievements. The database never holds text — rewording a reward is a
 * change here, not a migration.
 *
 * Adding a reward: add the key here, then call `claim(key)` from wherever the
 * condition becomes true. The engine handles the once-per-account guarantee.
 */
export type RewardKey =
  | "first_expense"
  | "first_income"
  | "first_no_spend"
  | "first_loan"
  | "loan_cleared"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "entries_100"
  | "full_deck"
  | "first_green_month"
  | "budget_survived";

export type Reward = {
  emoji: string;
  title: string;
  line: string;
  cta: string;
  /** One-liner used when the day's modal budget is already spent. */
  toast: string;
};

export const REWARDS: Record<RewardKey, Reward> = {
  first_expense: {
    emoji: "🥳",
    title: "Look at you, adulting!",
    line: "One expense down, a lifetime of receipts to go. Future you is already saying thanks.",
    cta: "Let's go",
    toast: "First expense logged. Adulting achieved.",
  },
  first_income: {
    emoji: "🤑",
    title: "Money came IN? Bold move.",
    line: "Tracking what arrives is half the picture. Now the numbers can actually argue with each other.",
    cta: "Nice",
    toast: "First income logged. Bold move.",
  },
  first_no_spend: {
    emoji: "🧘",
    title: "A whole day, wallet untouched",
    line: "Zero rupees out. Somewhere, a shopping cart weeps quietly.",
    cta: "Zen achieved",
    toast: "First no-spend day. Zen master.",
  },
  first_loan: {
    emoji: "🏦",
    title: "Debt, but make it visible",
    line: "A loan you can actually see shrinking beats one you avoid thinking about. Every installment counts down.",
    cta: "Let's shrink it",
    toast: "First loan tracked. Now watch it shrink.",
  },
  loan_cleared: {
    emoji: "🎉",
    title: "Loan cleared!",
    line: "Paid off, down to zero, done. That's one fewer thing quietly owning a piece of your month.",
    cta: "Free at last",
    toast: "Loan cleared. Free at last.",
  },
  streak_7: {
    emoji: "🔥",
    title: "One week straight",
    line: "Seven days logged in a row. Habit forming — resistance is futile.",
    cta: "Keep it burning",
    toast: "7-day streak. Habit forming.",
  },
  streak_30: {
    emoji: "🏆",
    title: "Thirty days. Thirty!",
    line: "You're not tracking expenses any more, you're just… like this now. It's a personality trait.",
    cta: "Certified consistent",
    toast: "30-day streak. Certified consistent.",
  },
  streak_100: {
    emoji: "🐐",
    title: "One hundred days",
    line: "A hundred days in a row. At this point the app works for you, not the other way round.",
    cta: "Legend status",
    toast: "100-day streak. Legend status.",
  },
  entries_100: {
    emoji: "💯",
    title: "100 entries logged",
    line: "Your spreadsheet-loving ancestors are proud. Somewhere, an accountant sheds a single tear.",
    cta: "On to 200",
    toast: "100 entries logged. Ancestors proud.",
  },
  full_deck: {
    emoji: "🃏",
    title: "Full deck unlocked",
    line: "Every single category used at least once. Completionist detected.",
    cta: "Collect them all",
    toast: "Every category used. Completionist.",
  },
  first_green_month: {
    emoji: "🌱",
    title: "Ended the month in the green",
    line: "More came in than went out. Cue the smug face — you've earned it.",
    cta: "Smug face on",
    toast: "Month ended in the green.",
  },
  budget_survived: {
    emoji: "🛡️",
    title: "Budget: survived",
    line: "A whole month inside the limit. Barely counts as a miracle, but we're counting it.",
    cta: "Do it again",
    toast: "Stayed under budget all month.",
  },
};
