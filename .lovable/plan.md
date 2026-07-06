## Person History (Relationship Timeline) — v1

Read-only admin feature showing every hangout tied to one person, identified by normalized email. No new tables. No changes to existing flows, writes, or permissions.

### 1. Identity helper

Add a shared helper in `src/lib/nedate.ts`:

```
normalizeEmail(email): string | null   // trim + lowercase, returns null if empty
displayNameFor(name, email): string    // name if non-empty, else email local-part
```

All matching/display logic uses these — no duplicated trim/lowercase.

### 2. Server — `src/lib/hangouts.functions.ts`

Both new functions are admin-only (`assertAdmin`), use `supabaseAdmin`, and never mutate.

**`listPeople({ adminPassword })`**
- Read `hangout_participants` where `email is not null and email <> ''`.
- Group in JS by `normalizeEmail(email)`; ignore null results.
- Per group:
  - `display_name`: most recent non-empty `display_name` by `updated_at`, else `null`. UI applies `displayNameFor`.
  - Distinct `hangout_id` set.
- Join `requests` for those hangout ids and compute:
  - `total`, `completed`, `cancelled`, `upcoming` (`hangout_status='active' AND start_time >= now()`).
  - `latest_hangout_record`: newest by `start_time` (fallback `created_at`) regardless of status → `{ id, title, venue_name, start_time, hangout_status, category }`.
  - `last_completed_hangout`: newest `hangout_status='completed'` or `null`.
- Sort people by `latest_hangout_record` time desc.

**`getPersonHistory({ email, adminPassword })`**
- Normalize input email.
- Fetch matching `hangout_participants` (active + inactive).
- Collapse to one entry per `hangout_id`:
  - Prefer `is_active=true` row.
  - Else most recent by `updated_at`.
  - Keep that row's `type` (role: requester/invitee/attendee) and `role_source` (friend_request/invite/join_request).
- Fetch parent `requests` joined with `venues` for that id set.
- Fetch `hangout_change_requests` for that id set; group in JS:
  - `changes: { pending, approved, rejected, total, latest_resolved: { status, responded_at } | null }`.
- Return `{ person: { email, display_name }, hangouts: [...] }`.
- Sort hangouts by `start_time` desc, fallback `created_at` desc when `start_time` null.
- Each item: `{ id, title, hangout_kind, visibility, category, start_time, end_time, venue: { name, location, image_url }, hangout_status, cancelled_at, cancellation_comment, role, source, created_at, changes }`.

### 3. Admin UI — `src/routes/admin.tsx`

Add a **"People"** tab alongside existing admin tabs.

**People list**
- Loads `listPeople` on tab open.
- Client-side substring search over name + email.
- Card per person:
  ```
  Alice Smith
  alice@example.com
  5 hangouts · 3 completed · 1 cancelled · 1 upcoming
  Latest: 🎢 Thorpe Park — 12 Feb 2026 (Upcoming)
  Last completed: ☕ Coffee — 3 Jan 2026
  [View history]
  ```
- Sorted by latest activity desc.

**Person History modal**
- Header: display name + email.
- Summary cards: Total · Completed · Upcoming · Cancelled · Latest hangout · Last completed.
- Timeline grouped by month (newest first). Per item:
  - Category emoji + title, status pill.
  - Role + source badges (e.g. "Invitee · via invite").
  - Venue + formatted date range.
  - Change summary when `changes.total > 0`: `2 pending · 3 resolved · latest approved 12 Feb`. No full diff/history in v1.
  - Cancellation note if cancelled.
  - Click → switch to Hangouts tab, `location.hash = 'hangout-<id>'`, scroll to `#hangout-<id>`.

**Hangout rows in Hangouts tab**
- Add stable `id="hangout-<id>"` attribute on each existing hangout row (no visual changes).

### 4. Rules

- Match key everywhere: `normalizeEmail(email)`. Never name.
- Null/empty emails excluded from People list.
- One timeline entry per `hangout_id`, even with multiple participant rows.
- Display name is derived at render (`displayNameFor`); no writes back.
- Read-only end-to-end.

### 5. Out of scope

- No new tables (`contacts` untouched — invite address book).
- No participant/permission changes, no email sends, no writes.
- No relationship notes/preferences/favourites — future work.

### Files touched
- `src/lib/nedate.ts` — add `normalizeEmail`, `displayNameFor`.
- `src/lib/hangouts.functions.ts` — add `listPeople`, `getPersonHistory`.
- `src/routes/admin.tsx` — add People tab, list, Person History modal, `id="hangout-<id>"` anchors.
