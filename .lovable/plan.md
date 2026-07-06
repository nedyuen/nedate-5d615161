## Undated Friend Requests — "Let Ned pick a time" (v1)

Allow a `friend_request` to be submitted without `start_time`. Ned proposes a time via the **existing** change-proposal workflow. Public/private hangouts and invitations are unchanged.

### 1. Scheduling state model

```
REQUESTED (request_status='pending', schedule_status='unscheduled')
  → Ned approves interest   → APPROVED BUT AWAITING TIME
                              (request_status='approved',
                               schedule_status='unscheduled')
  → Ned suggests a time     → pending proposal
  → Requester accepts       → SCHEDULED
  → Requester rejects       → back to AWAITING TIME (nothing else changes)
```

`schedule_status` documents only whether a date/time is confirmed. It does NOT represent approval, attendance, or existence.

### 2. Migration (`public.requests`) — safe rollout

Ordering inside the single migration file:

1. `ADD COLUMN schedule_status text NOT NULL DEFAULT 'scheduled'` + column comment.
2. `ALTER COLUMN start_time DROP NOT NULL`.
3. **Pre-constraint validation** (fail-fast): a `DO $$ ... $$` block that raises when either
   `EXISTS (SELECT 1 FROM public.requests WHERE schedule_status <> 'scheduled')` or
   `EXISTS (SELECT 1 FROM public.requests WHERE schedule_status='unscheduled' AND hangout_kind <> 'friend_request')`.
   This proves every existing row will satisfy the new rules before the constraints exist. If any historical row violates them, the migration aborts before mutating structure and the user can review.
4. `CHECK (schedule_status in ('scheduled','unscheduled'))`.
5. `CHECK (schedule_status='scheduled' OR hangout_kind='friend_request')` — only friend requests may be unscheduled.
6. Sanity trigger: `schedule_status='scheduled' ⇒ start_time is not null` (trigger, not CHECK, to allow future extensions).

Because default is `'scheduled'`, all existing rows are trivially valid — the validation block just guarantees no drift from earlier data edits.

### 3. Server — `src/lib/hangouts.functions.ts`

**`submitFriendRequest`**
- Adds `schedule_mode: 'have_time' | 'flexible'`; `start_time` nullable.
  - `have_time` → require `start_time`; insert `schedule_status='scheduled'`.
  - `flexible` → force `start_time=null`; insert `schedule_status='unscheduled'`.
- Venue required in both modes.
- Confirmation email: `sendRequestConfirmationEmail` with `when=null` in the flexible case → *"Ned will suggest a date/time soon."*

**`getRequestTracking`**: return `schedule_status`.

### 4. Server — `src/lib/hangout-changes.functions.ts`

**Initial-scheduling gate** in `proposeHangoutChange`, applied when parent `hangout_kind='friend_request'` AND `schedule_status='unscheduled'`:

1. Reject `not_approved_yet` if `request_status !== 'approved'`.
2. Reject `unscheduled_ned_only` if actor is not Ned.
3. Reject `unscheduled_time_only` if `changes` touches any non-time field (venue or otherwise).
4. Existing pending-check enforces "one pending suggestion at a time".

**Snapshot/diff behaviour (initial suggestion):**
- `old_snapshot.start_time = null` (parent value at time of proposal).
- `old_snapshot.end_time = null` when parent has none.
- `new_snapshot.start_time = <Ned's suggested ISO time>` (and `end_time` if provided).
- No venue keys in either snapshot for this path.
- The diff renderer in `HangoutAgreementPanel` must treat `old_snapshot.start_time === null` as **"Not decided yet"**, not "missing" — output reads `Not decided yet → Fri 7 Feb · 7:00pm`.

**First-suggestion email path:** send **only** `sendTimeSuggestedEmail`; do NOT also send the generic change-proposal email. All other emails unchanged.

**`respondToHangoutChange` (apply path)**:
- Approve with a non-null `start_time` in new snapshot on an unscheduled parent → set `schedule_status='scheduled'` in the same UPDATE.
- Reject on an unscheduled parent → nothing changes on the parent (no cancellation, no request_status change). Ned may suggest again.

### 5. Null-safety audit for `start_time`

Since `start_time` is now nullable, every reader/formatter must be null-safe. Scheduled rows keep exact current behaviour.

Adjustments:
- `src/lib/nedate.ts` — add `fmtRangeOrPending(start, end)` returning "Not decided yet" for null; undated-capable surfaces switch to it.
- `src/lib/hangouts.functions.ts` — server-side formatter tolerates null for the flexible confirmation email.
- Route/component readers audited: `src/routes/index.tsx`, `src/routes/admin.tsx` (RequestGrid, NedHangoutRow, RequestModal, People views), `src/routes/r.$slug.tsx`, `src/routes/i.$slug.tsx`, `src/routes/join.$slug.tsx`, `src/components/HangoutAgreementPanel.tsx`.
- Email helpers/templates: `sendRequestConfirmationEmail` accepts `when: string | null`; other templates guard formatters where reachable by undated rows.
- Sorting: DB `.order('start_time')` unchanged; UI grouping falls back to `created_at` for null (already the People-view convention).

### 6. Friend request form — `src/routes/request.tsx`

Step 3 gains a radio at the top:
- `( ) I have a date/time in mind` → shows `DateTimePicker`.
- `( ) I'm flexible — let Ned suggest a time` → hides picker; helper text.
- `canNext()` step 3: `mode==='have_time' ? !!start : true`.
- Submit sends `schedule_mode` + `start_time` (or null).

### 7. Requester tracking page — `src/routes/r.$slug.tsx`

- Unscheduled + no pending → date line "Not decided yet" + banner "Waiting for Ned to suggest a time."
- Copy uses "Awaiting time", never the raw `unscheduled` value.
- `HangoutAgreementPanel` provides accept/reject when Ned suggests.

### 8. `HangoutAgreementPanel` — `src/components/HangoutAgreementPanel.tsx`

Branch on `hangout.schedule_status`:
- `unscheduled`:
  - Ned/admin: propose button labelled **"Suggest a time"**; form restricted to time fields; venue hidden.
  - Requester: propose button hidden; accept/reject only. Rejection returns to empty state.
  - Diff view renders `old_snapshot.start_time === null` as **"Not decided yet"**.
- `scheduled`: existing **"Propose changes"** wording, full field set, unchanged.

### 9. Admin — `src/routes/admin.tsx`

- Extend `Hangout` type with `schedule_status`.
- `RequestGrid` friend-request cards: unscheduled → "Awaiting time" pill + "Not decided yet" in the date slot.
- `RequestModal` for friend requests: "When: Not decided yet" when unscheduled; mount `HangoutAgreementPanel` inside the modal (admin actor). "Suggest a time" surfaces only once the request is approved (server enforces).
- Approving a friend request while unscheduled is allowed.

### 10. Emails — `src/lib/email.server.ts`

- `sendRequestConfirmationEmail`: accepts `when: string | null`; renders placeholder when null.
- New `sendTimeSuggestedEmail`: subject *"Ned suggested a time for your hangout"*, includes proposed time, existing venue, Accept/Reject CTA.
- First-suggestion path sends this email **exclusively** — no generic proposal email.

### 11. Types

Auto-regenerated after migration approval — `schedule_status` present, `start_time` nullable.

### 12. Acceptance checks

- Flexible friend request submitted → `start_time=null`, `schedule_status='unscheduled'`, `request_status='pending'`; confirmation email says a time will be suggested.
- Ned tries to suggest before approval → server `not_approved_yet`; UI hides suggest button.
- Ned approves → `request_status='approved'`, `schedule_status='unscheduled'` (approved but awaiting time).
- Ned suggests a time → proposal snapshot: `old.start_time=null`, `new.start_time=<iso>`; diff renders "Not decided yet → …"; requester receives only `sendTimeSuggestedEmail`.
- Requester accepts → `start_time` set, `schedule_status='scheduled'`.
- Requester rejects → proposal `rejected`; parent unchanged; Ned can suggest again.
- Requester attempts to propose while unscheduled → server `unscheduled_ned_only`; UI hides.
- Ned includes venue in initial suggestion → server `unscheduled_time_only`; UI hides venue fields.
- Public/private and existing scheduled friend requests behave exactly as before.
- Non-friend-request rows cannot be `unscheduled` (DB CHECK).
- Migration aborts safely if any historical row would violate the new constraints (validation block).

### Files touched

- New migration: `schedule_status` + column comment, pre-check validation block, kind CHECK, `start_time` nullable, sanity trigger.
- `src/lib/hangouts.functions.ts` — `submitFriendRequest`, `getRequestTracking`.
- `src/lib/hangout-changes.functions.ts` — gates, exclusive first-suggestion email, apply-path flip, snapshot rules.
- `src/lib/email.server.ts` — nullable `when`, new `sendTimeSuggestedEmail`.
- `src/lib/nedate.ts` — `fmtRangeOrPending`.
- `src/routes/request.tsx` — mode radio + conditional picker.
- `src/routes/r.$slug.tsx` — "Awaiting time" banner + "Not decided" line.
- `src/routes/admin.tsx` — undated rendering + `HangoutAgreementPanel` in `RequestModal` + null-safe formatting.
- `src/components/HangoutAgreementPanel.tsx` — wording swap, hide propose for non-Ned, hide venue when unscheduled, null-safe diff rendering.
