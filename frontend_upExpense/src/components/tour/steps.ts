import { todayISO } from "@/lib/format";

export type TourStep = {
  id: string;
  /** Route the step lives on. Omitted = stay wherever the user already is. */
  path?: () => string;
  /** `data-tour` value of the element to spotlight. Omitted = centered card. */
  target?: string;
  title: string;
  body: string;
};

/**
 * The first-run walkthrough: categories → log an expense → read the stats.
 * Each page switch is introduced by highlighting its nav item first, so the
 * jump never feels like the app moved on its own.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to upExpense 👋",
    body: "A quick tour: set up a category, log an expense, then read your stats. It takes about a minute — skip any time.",
  },

  /* ---------------------------------------------------------------- */
  /* 1. Categories                                                     */
  /* ---------------------------------------------------------------- */
  {
    id: "nav-categories",
    path: () => "/categories",
    target: "nav-categories",
    title: "Start with categories",
    body: "Every expense and every income belongs to a category. A starter set is already here for you.",
  },
  {
    id: "category-kind",
    path: () => "/categories",
    target: "category-kind",
    title: "Two sides, one list",
    body: "Expense categories and income sources are managed separately. Switch sides with these tabs.",
  },
  {
    id: "category-form",
    path: () => "/categories",
    target: "category-form",
    title: "Add a category",
    body: "Type a name, pick an icon and a colour, then hit Add. The colour is what you'll see in the charts later.",
  },
  {
    id: "category-list",
    path: () => "/categories",
    target: "category-list",
    title: "Edit or remove",
    body: "Rename and recolour with the pencil. Deleting a category moves its entries to \"Other\" — nothing is ever lost.",
  },

  /* ---------------------------------------------------------------- */
  /* 2. Logging an expense                                             */
  /* ---------------------------------------------------------------- */
  {
    id: "nav-today",
    path: () => `/day/${todayISO()}`,
    target: "nav-today",
    title: "Today is your log book",
    body: "This is the day view — one page per date, with arrows and a date picker to move around.",
  },
  {
    id: "expense-amount",
    path: () => `/day/${todayISO()}`,
    target: "expense-amount",
    title: "Enter the amount",
    body: "Start here. Amounts are in rupees and must be greater than zero.",
  },
  {
    id: "expense-categories",
    path: () => `/day/${todayISO()}`,
    target: "expense-categories",
    title: "Tap a category",
    body: "One tap picks where the money went. Categories you create on the Categories page show up right here.",
  },
  {
    id: "expense-submit",
    path: () => `/day/${todayISO()}`,
    target: "expense-submit",
    title: "Save it",
    body: "Add an optional note, mark it cash or card, then save. The Expense/Income tabs above switch what you're logging.",
  },

  /* ---------------------------------------------------------------- */
  /* 3. Stats                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: "nav-stats",
    path: () => "/reports",
    target: "nav-stats",
    title: "Now the payoff",
    body: "Stats turns those daily entries into a picture of your month and your year.",
  },
  {
    id: "stats-body",
    path: () => "/reports",
    target: "stats-body",
    title: "Read your spending",
    body: "Income against spending, a per-category breakdown, and the days that cost you most. Switch between Month and Year at the top.",
  },
  {
    id: "done",
    path: () => "/reports",
    title: "That's the whole app 🎉",
    body: "Log as you spend, and the stats take care of themselves. You can replay this tour any time from Settings.",
  },
];
