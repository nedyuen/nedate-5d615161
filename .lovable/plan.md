
## Hangout Cancellation Feature (revised)

Reuses `requests.hangout_status` (setting it to `cancelled`) and adds audit fields. Cancellation is instant, admin-only, and final for now (schema does not preclude a future reopen).

### 1. Database migration

Add to `public.requests`:
- `cancelled_at timestamptz`
- `cancelled_by text` (stores `"ned"`)
- `cancellation_comment text`

No new tables. No data deletes anywhere in this feature.

### 2. Server: `adminCancelHangout` in `src/lib/hangouts.functions.ts`

Inputs: `hangoutId`, `adminPassword`, optional `comment`.

Behaviour:
- `assertAdmin(pw)`.
- Load hangout + venue. Reject if not found, or if `hangout_status` is already terminal (`cancelled` or `completed`) — completed hangouts cannot later become cancelled.
- Update parent: `hangout_status='cancelled'`, `cancelled_at=now()`, `cancelled_by='ned'`, `cancellation_comment`.
- Invalidate open change proposals: `hangout_change_requests` rows with `status='pending'` for this hangout → `status='rejected'`, `responder_comment='Hangout cancelled'`, `responded_at=now()`. (This is proposal state, not join-request state.)
- Public hangout only: cascade to child join-request rows (`parent_hangout_id = id`) — set their `hangout_status='cancelled'`. Leave `request_status` unchanged (pending stays pending, approved stays approved). Tracking pages will treat `hangout_status='cancelled'` as the primary state.
- Collect recipients:
  - `friend_request`: `requester_email` on the row.
  - `public_hangout`: all invitees on the parent + all join-request child rows regardless of `request_status` (pending and approved both get notified; only excluded state is a pre-existing `hangout_status='cancelled'` child, which shouldn't exist here).
  - `private_hangout`: all invitees, any response status.
- Send new `sendHangoutCancelledEmail` per recipient with the right tracking URL (`/r/<slug>` for requester/joiners, `/i/<slug>` for invitees).
- Return `{ ok: true, notified }`.

### 3. Server-side read-only guardrails

Rule enforced everywhere: **only `hangout_status='active'` hangouts participate in active workflows.** Any non-active status (including `cancelled` and `completed`) must reject writes and be excluded from active listings.

Concretely:
- `submitJoinRequest`: parent lookup already filters `hangout_status='active'` — keep.
- `respondToInvite`: fetch parent; reject with `hangout_not_active` if not `active`.
- `adminAddInvitees`, `adminRemoveInvitee`, `adminRemoveJoiner`, `adminApproveJoiner`/reject-join, `sendBulkMessage`, any admin edit fn: load parent; reject if not `active`.
- `src/lib/hangout-changes.functions.ts` (`proposeChange`, `respondToChange`, reconfirm-attendance write paths): reject if parent hangout is not `active`.
- Any listing that represents "active/upcoming work" (`listUpcomingPublicHangouts` — already correct; admin's active-hangout groupings; any future reminder/background job) must filter `hangout_status='active'`. This is documented in a short comment at the top of `hangouts.functions.ts` so future jobs follow the same rule.

Cancelled/completed hangouts remain fully readable — only writes are blocked.

### 4. Email template

Add `sendHangoutCancelledEmail` in `src/lib/email.server.ts`:
- Subject: `Cancelled: <title>`.
- Body: clear "This hangout has been cancelled" headline, scheduled date/time, venue, optional Ned comment in the highlighted note card, button to the recipient's tracking URL.
- Uses existing `wrap` / `btn` helpers.

### 5. Admin UI (`src/routes/admin.tsx`)

On every hangout row where `hangout_status='active'` (Ned-created and friend-request):
- Add a red `Cancel` button next to existing actions.
- On click, open a confirm modal:
  - Copy: **"This will cancel the hangout and notify all affected participants."**
  - Optional comment textarea (max 2000 chars).
  - Confirm / Cancel buttons.
- On confirm: call `adminCancelHangout`, toast notified count, refresh list.

For rows where `hangout_status='cancelled'`:
- Show a `Cancelled` badge and dim the row.
- Hide Approve/Reject-request, Edit, Message, Add-invitees, Remove-participant, Propose-change, and the Cancel button itself.
- Keep participant list, change-proposal history, and cancellation comment visible for audit.

Rows where `hangout_status='completed'`: also hide the Cancel button (guard mirrors server rejection).

### 6. Participant pages (`/r/<slug>` and `/i/<slug>`)

When the loaded hangout has `hangout_status='cancelled'`:
- Prominent red "Cancelled" banner at the top.
- Show `cancellation_comment` in a highlighted note card if present.
- Show final hangout details (venue, when) for reference.
- **Keep history visible in read-only mode**: existing change-proposal / decision history, attendance history, invite response history, join-request status — all still rendered, just no interactive controls.
- Hide/disable interactive controls: invite response buttons, join-request submit form, attendance reconfirm buttons, `HangoutAgreementPanel` propose/approve/reject actions.
- `hangout_status='cancelled'` is treated as the primary state on these pages regardless of `request_status` — a joiner whose `request_status='approved'` still sees "cancelled" as the headline.

### 7. Homepage

`listUpcomingPublicHangouts` already filters `hangout_status='active'` — cancelled hangouts disappear automatically. No change needed; verify only.

### 8. Types

After the migration is approved, `src/integrations/supabase/types.ts` regenerates automatically to expose the new columns. No manual edit.

### Acceptance mapping

- Ned-only cancel from admin → step 5 + `assertAdmin` in step 2.
- All participants notified → step 2 + step 4.
- Removed from public discovery → step 7.
- Cancelled state on participant pages, history kept → step 6.
- Read-only everywhere; only active participates in workflows → step 3.
- No cancelling completed/cancelled hangouts → step 2 terminal-state guard.
- Join-request rows keep their `request_status` → step 2 cascade rule.
- Audit preserved → step 1 columns, no deletes.
- Existing change proposals invalidated → step 2.
