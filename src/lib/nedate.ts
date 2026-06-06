export const CATEGORIES = [
  { id: "breakfast", label: "Breakfast", emoji: "🥞", blurb: "Pancakes, coffee, slow mornings" },
  { id: "lunch", label: "Lunch", emoji: "🥗", blurb: "Quick bite between adventures" },
  { id: "dinner", label: "Dinner", emoji: "🍝", blurb: "A proper sit-down meal" },
  { id: "drink", label: "Drinks", emoji: "🍸", blurb: "Cocktails, wine, or a pint" },
  { id: "walk", label: "Walk", emoji: "🚶", blurb: "Wander somewhere green" },
  { id: "chat", label: "Chat", emoji: "💬", blurb: "Coffee and a real conversation" },
  { id: "day trip", label: "Day Trip", emoji: "🗺️", blurb: "Pack a bag, get out of town" },
  { id: "other activity", label: "Other Activity", emoji: "✨", blurb: "Something unusual together" },
  { id: "ned's bucket list item", label: "Ned's Bucket List", emoji: "🎢", blurb: "Help me cross one off" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const ADMIN_PASSWORD = "nedate2026";
export const ADMIN_STORAGE_KEY = "nedate_admin_ok";

export function categoryMeta(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? { id, label: id, emoji: "✨", blurb: "" };
}

export function fmtRange(start: string, end?: string | null) {
  const s = new Date(start);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startText = `${s.toLocaleDateString(undefined, dateOpts)} · ${s.toLocaleTimeString(undefined, timeOpts)}`;
  if (!end) return startText;
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${startText} – ${e.toLocaleTimeString(undefined, timeOpts)}`;
  }
  return `${startText} → ${e.toLocaleDateString(undefined, dateOpts)} ${e.toLocaleTimeString(undefined, timeOpts)}`;
}
