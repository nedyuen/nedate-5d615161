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

export const APP_TZ = "Europe/London";

function londonOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    parts.hour === "24" ? 0 : +parts.hour, +parts.minute, +parts.second,
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convert a `<input type="datetime-local">` value (interpreted as London time) → UTC ISO. */
export function londonLocalToIso(local: string): string {
  if (!local) return "";
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = londonOffsetMinutes(new Date(utcGuess));
  return new Date(utcGuess - offset * 60_000).toISOString();
}

/** Convert ISO → `YYYY-MM-DDTHH:mm` formatted in London time (for datetime-local inputs). */
export function isoToLondonLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(iso)).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const hh = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}`;
}

export function fmtRange(start: string | null | undefined, end?: string | null) {
  if (!start) return "Not decided yet";
  const s = new Date(start);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", timeZone: APP_TZ };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: APP_TZ };
  const startText = `${s.toLocaleDateString("en-GB", dateOpts)} · ${s.toLocaleTimeString("en-GB", timeOpts)}`;
  if (!end) return startText;
  const e = new Date(end);
  const sLondon = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(s);
  const eLondon = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(e);
  if (sLondon === eLondon) {
    return `${startText} – ${e.toLocaleTimeString("en-GB", timeOpts)}`;
  }
  return `${startText} → ${e.toLocaleDateString("en-GB", dateOpts)} ${e.toLocaleTimeString("en-GB", timeOpts)}`;
}

export type VenueDisplay = { name: string; location: string | null; imageUrl: string | null };

export function venueDisplay(h: {
  venue?: { name: string; location: string | null; image_url: string | null } | null;
  custom_venue_name?: string | null;
  custom_venue_location?: string | null;
  custom_venue_image_url?: string | null;
}): VenueDisplay {
  if (h.venue) {
    return { name: h.venue.name, location: h.venue.location, imageUrl: h.venue.image_url };
  }
  return {
    name: h.custom_venue_name ?? "TBD",
    location: h.custom_venue_location ?? null,
    imageUrl: h.custom_venue_image_url ?? null,
  };
}

/** Normalize an email address for identity matching. Returns null when empty/invalid. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const t = email.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

/** Display name for a person; falls back to email local-part, else "Unknown". */
export function displayNameFor(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (n) return n;
  const e = (email ?? "").trim();
  if (e && e.includes("@")) return e.split("@")[0];
  return e || "Unknown";
}
