# Hangout Change Proposal System (v5 — locked)

Generic propose → approve/reject for any mutable hangout field. Snapshot-based, atomic, one pending proposal per hangout. All identity + permissions flow through `hangout_participants`.

## Architectural invariants (hard rules)

1. **`hangout_participants.slug` is the only authoritative identity.** No server-side permission/identity logic ever reads `requests.slug` or `hangout_invitees.slug`. URL slugs from `/r/<slug>` and `/i/<slug>` are mapped to a participant row at the boundary; the original slug is discarded.
2. **Permissions derive only from `hangout_participants`.** No inference from email matching, request type, invitee tables, or join_request tables.
3. **Participants are created in exactly three places** — `createHangout`, `submitFriendRequest`, `adminUpdateRequestStatus` (on join approval). Nowhere else.
4. **Participants are never hard-deleted.** Only mechanism for removal is `is_active = false`. Every permission check requires `is_active = true`.
5. **Pending/rejected join_request rows never become participants** and are never resolvable via `resolveActor`. Only approved join_requests produce an `attendee` participant.
6. **Reconfirmation triggers only on `start_time` or `end_time` changes.** Venue, title, pitch, category changes apply silently with no reconfirmation.
7. **Admin is not a separate identity** — admin auth always resolves to the hangout's `ned` participant row.

## 1. Database

### `hangout_participants`
- `id` uuid PK
- `hangout_id` uuid → `requests(id)` on delete cascade
- `type` text: `ned` | `requester` | `invitee` | `attendee`
- `slug` text NULL — the only authoritative access key
- `email` text NULL
- `display_name` text NULL
- `role_source` text: `friend_request` | `invite` | `join_request` | `ned`
- `source_row_id` uuid NULL — backref to originating request/invitee row
- `is_active` boolean NOT NULL default true
- `needs_reconfirmation` boolean NOT NULL default false
- `created_at`, `updated_at`

Constraints:
- `UNIQUE (hangout_id, type) WHERE type = 'ned'` — exactly one Ned per hangout
- Partial unique on `slug` where slug IS NOT NULL

### `hangout_change_requests`
- `id` uuid PK
- `hangout_id` uuid → `requests(id)` on delete cascade
- `proposed_by_participant_id` uuid → `hangout_participants(id)`
- `status` text: `pending` | `approved` | `rejected`
- `old_snapshot` jsonb, `new_snapshot` jsonb (subset of: `start_time`, `end_time`, `venue_id`, `custom_venue_name`, `custom_venue_location`, `custom_venue_image_url`, `title`, `pitch`, `category`)
- `proposer_comment` text
- `responder_participant_id` uuid NULL, `responder_comment` text
- `created_at`, `responded_at`
- Partial unique: one `pending` row per `hangout_id`

### Backfill (same migration)
- Each existing hangout (`requests.initiator='ned'`): insert a `ned` participant
- Each `friend_request` row: insert a `requester` participant (slug = request slug) + a `ned` participant
- Each `join_request` row with `request_status='approved'`: insert an `attendee` participant (slug = request slug). Pending/rejected → nothing.
- Each `hangout_invitees` row: insert an `invitee` participant (slug = invitee slug)

Grants: service-role only on both new tables; RLS enabled, no public policies. All access via server functions.

## 2. Layer separation

**Auth layer** (only place slugs/admin tokens are touched):
- `resolveActor(input)` returns an active `hangout_participants` row:
  - `{ slug }` → participant whose `slug` matches AND `is_active = true`
  - `{ adminPassword, hangoutId }` → the `ned` participant for that hangout
- Returns Unauthorized otherwise.

**Domain layer** (no slugs, no emails, no request-kind branching):
- `canProposeChange(participant, hangout)` → participant active AND hangout not terminal AND no pending proposal
- `canRespondToChange(participant, proposal)` → participant active AND not the proposer
- `applyApprovedProposal(hangout, proposal)` → atomic write of `new_snapshot`. Only if `start_time` or `end_time` is among changed keys → set `needs_reconfirmation = true` on all active participants where `type IN ('invitee','attendee')`.

Routes (`/r/<slug>`, `/i/<slug>`) are presentation only.

## 3. Server functions (`src/lib/hangouts.functions.ts`)

- `getParticipantContext({ actor })` — returns `{ hangout, viewer, pendingProposal, history, otherParticipants }`. Powers `/r`, `/i`, and admin's per-hangout view.
- `proposeHangoutChange({ actor, changes, comment })` — resolveActor → permission check → snapshot insert → email other active participants
- `respondToHangoutChange({ actor, decision, comment })` — resolveActor → permission check → atomic apply (time-only triggers reconfirmation) or rejection → notification email
- `respondToInvite` + attendee reconfirm path: clear `needs_reconfirmation` on the responding participant after successful reply

### Participant lifecycle hooks (the only three creation sites)
- **`createHangout`** — Ned-initiated hangout creation: insert `ned` participant + one `invitee` participant per invitee
- **`submitFriendRequest`** — *hangout creation trigger*: creates a new hangout owned by Ned, then inserts one `ned` participant AND one `requester` participant
- **`adminUpdateRequestStatus`** on a `join_request`: on `approved` insert an `attendee` participant (slug = the request's slug). On `rejected` do nothing.

Atomicity: a proposal is approved or rejected as a whole.

Emails (`email.server.ts`):
- `sendChangeProposedEmail` — to each other active participant, diff + link to their page
- `sendChangeDecisionEmail` — to proposer
- `sendReconfirmAttendanceEmail` — to invitee/attendee participants only when time changed

All actions on-site; emails carry links only.

## 4. UI — unified Participant Hangout Page

Shared `<HangoutAgreementPanel />` used on `/r/<slug>`, `/i/<slug>`, and admin's per-hangout view. Capabilities driven entirely by server-returned `{ viewer, pendingProposal }`:

- Current details card
- Pending proposal banner (old → new diff, proposer name, comment)
  - Proposer side: "Waiting for response"
  - Otherwise: **Accept Changes** / **Reject Changes** + optional comment
- **Propose Changes** dialog (hidden while a proposal is pending): field picker → atomic snapshot submit
- **Reconfirm attendance** prompt when `viewer.needs_reconfirmation` is true (Yes / Maybe / No)
- Collapsible **Change history**

## 5. Public hangouts

Visitors of `/join/<slug>` are NOT participants unless they have an approved `join_request` that created an `attendee` participant row. Anonymous visitors and pending/rejected requesters see read-only details with no propose/respond UI.

## 6. Out of scope
- Withdrawing pending proposals
- In-email action buttons
- Multiple concurrent proposals
- Partial-field acceptance
- Reconfirmation for non-time changes

---

Ship order: migration (tables + constraints + backfill) → auth/domain helpers → server fns + email helpers → `<HangoutAgreementPanel />` + Propose dialog → wire into `/r`, `/i`, admin → reconfirmation prompt on `/r` + `/i` → hook participant creation into `createHangout`, `submitFriendRequest`, `adminUpdateRequestStatus`.
