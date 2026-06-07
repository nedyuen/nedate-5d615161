# Unified Hangout System (v3 — final)

Incorporates v2 plus the 4 final refinements: explicit `visibility` column, `hangouts.slug`, admin comments surfaced to requesters, and a clear service-role boundary.

## Data model

### `hangouts` (extends existing `requests` table)

Columns added:

- `hangout_kind` text NOT NULL — `'friend_request' | 'public_hangout' | 'private_hangout' | 'join_request'`. Default `'friend_request'`.
- `initiator` text NOT NULL — `'friend' | 'ned'`. Default `'friend'`.
- `visibility` text NOT NULL — `'public' | 'private'`. **Explicit column** (not inferred from kind). Default `'private'`. Used for homepage / discovery filters.
- `hangout_status` text NOT NULL — `'draft' | 'active' | 'cancelled' | 'completed'`. Default `'active'`.
- `request_status` text NULL — `'pending' | 'approved' | 'rejected'`. Set only for request-style rows (`friend_request`, `join_request`); NULL for hangout-style rows.
- `title` text NULL — Ned-set title for Ned-initiated hangouts.
- `parent_hangout_id` uuid NULL REFERENCES requests(id) ON DELETE CASCADE — set on `join_request`.
- `request_message` text NULL — optional message from a join requester.
- `custom_venue_name` text NULL, `custom_venue_location` text NULL, `custom_venue_image_url` text NULL.

Existing `slug` column already exists (10-char default) and is reused as `hangouts.slug` — usable for `/join/<slug>`, share links, tracking. We'll widen to 16-char default on new rows for the join URL space; existing slugs remain valid.

Existing `admin_comment` column is **kept and surfaced to the requester** (see §3 below). Not internal-only.

Existing `status` and `custom_venue` columns are backfilled then dropped (status → `hangout_status`/`request_status`; custom_venue → `custom_venue_name`).

### Constraints (DB-enforced)

- `chk_visibility_consistency`: `(hangout_kind = 'public_hangout' AND visibility = 'public') OR (hangout_kind <> 'public_hangout' AND visibility = 'private')` — keeps `visibility` and `kind` aligned but keeps `visibility` as the canonical query field.
- `chk_request_status_presence`: `request_status IS NOT NULL` iff `hangout_kind IN ('friend_request','join_request')`.
- `chk_parent_hangout`: `parent_hangout_id IS NOT NULL` iff `hangout_kind = 'join_request'`.
- `chk_requester_fields`: requester_name/email NOT NULL iff request-style row.
- `chk_venue_exclusive`: `(venue_id IS NOT NULL)::int + (custom_venue_name IS NOT NULL)::int = 1`.
- `chk_initiator_kind`: `initiator='ned'` ⇔ `hangout_kind IN ('public_hangout','private_hangout')`.

### `hangout_invitees` (new)

`id`, `hangout_id` FK CASCADE, `name`, `email`, `slug` UNIQUE (16-char), `response_status` (`pending|accepted|declined|maybe`, default pending), `comment`, `responded_at`, `created_at`. RLS enabled, NO public policies — accessed only via server fns using service role.

## Service-role boundary (explicit confirmation)

- `SUPABASE_SERVICE_ROLE_KEY` is read **only** inside `.handler()` bodies of server fns via `supabaseAdmin` from `@/integrations/supabase/client.server`.
- `client.server.ts` is **never** imported by any file under `src/routes/` or `src/components/`. In `.functions.ts` files reachable from the client, we use `await import('@/integrations/supabase/client.server')` inside the handler.
- The browser bundle continues to use the publishable-key `supabase` client only. No service-role string appears in any `VITE_*` env, asset, or shipped JS.
- All privileged operations — invitee CRUD, admin reads/writes for hangouts, invite responses, join-request inserts that need to bypass RLS — happen inside server fns.
- `hangout_invitees` has RLS enabled with **no** anon/authenticated policies, so even if the key leaked, the table is unreachable from the client.

## Server functions (`src/lib/hangouts.functions.ts`)

- `listUpcomingPublicHangouts()` → public read for homepage (filter `visibility='public'` AND `hangout_status='active'` AND `start_time >= now()`).
- `getPublicHangoutBySlug({ slug })` → join-form prefill; reads parent live (no data copying).
- `submitJoinRequest({ slug, name, email, message })` → inserts `join_request` row with `parent_hangout_id`, `request_status='pending'`, `visibility='private'`; sends confirmation email + admin notification.
- `getInviteByToken({ slug })` → returns invitee + hangout details.
- `respondToInvite({ slug, response, comment })` → updates invitee row, emails Ned.
- `createHangout({ visibility, category, title, pitch, start_time, venue, invitees })` (admin) → inserts hangout, inserts invitees, fires invitation emails. Sets `hangout_kind` from `visibility` (`public`→`public_hangout`, `private`→`private_hangout`) and `initiator='ned'`.
- `respondAdminRequest({ id, decision, comment })` (admin) → sets `request_status`, writes `admin_comment`, sends update email (includes comment).
- `adminListHangouts()` → unified admin feed.

Admin server fns gated by an `X-Admin-Token` header derived from `ADMIN_PASSWORD`, validated server-side against `process.env.ADMIN_PASSWORD`.

## Admin comments surfaced to requesters

`admin_comment` is **not internal**. It flows through to:

1. **Email** — `sendRequestUpdate` already templates the comment as "A note from Ned" and is sent on every approve/reject. Confirmed kept.
2. **Tracking page** — `src/routes/r.$slug.tsx` (existing) displays the comment when present, shown to the requester on their tracking link. We'll verify the comment renders for both `friend_request` and `join_request` rows.

## Emails

Extend `src/lib/email.functions.ts`:
- `sendInvitation` — to invitee, BCC nedyuen@.
- `sendInviteeResponseToNed` — to Ned with invitee name/email/status/comment.
- Reuse `sendRequestConfirmation` / `sendRequestUpdate` for both friend_request and join_request.

## Routes

- `src/routes/index.tsx` — add "Upcoming Hangouts" section under "Things I'd Like To Do" using `listUpcomingPublicHangouts`. Cards link to `/join/<hangouts.slug>`.
- `src/routes/join.$slug.tsx` (new) — public join request form.
- `src/routes/i.$slug.tsx` (new) — invitee landing page with Accept / Maybe / Decline + comment.
- `src/routes/r.$slug.tsx` — verify admin comment is shown.
- `src/routes/request.tsx` — unchanged friend-request flow.
- `src/routes/admin.tsx` — unified Hangouts tab with grouped sections + "Create hangout" modal (single-page form, 15-min datetime, venue picker or custom fields, invitee repeater, ≥1 invitee required if Private).

## Out of scope

- Full admin auth migration (still password-gated; admin server fns gated by shared token).
- Draft/completed lifecycle UI (column exists; future).
- Custom venues never inserted into `venues`.

## Technical details

- Migration: ALTER + backfill in one migration; add constraints AFTER backfill. Set `visibility='private'` for all backfilled rows (existing data is friend requests). Drop legacy `status` and `custom_venue` columns at end.
- Constraint pairing: app-level `createHangout` always sets `visibility` and `hangout_kind` consistently; `chk_visibility_consistency` enforces this so a mistaken UI write fails fast.
- `hangouts.slug` reuses existing column; clients link via `<Link to="/join/$slug" params={{ slug }}>`.
- `client.server.ts` imports remain inside `.handler()` bodies; verified no route/component import path reaches it.
- `attachSupabaseAuth` middleware already wired; admin token sent via `useServerFn` request header (passed through serverFn input or via a thin fetch wrapper — TanStack serverFn supports custom request headers via middleware; we'll use a small request-side middleware that reads admin token from `sessionStorage`).
- After migration, `src/integrations/supabase/types.ts` regenerates; downstream code updates.

Ready to build on approval.
