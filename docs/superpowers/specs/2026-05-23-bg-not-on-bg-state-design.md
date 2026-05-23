# BG-number "Not on BG" state for unverifiable but valid-looking numbers

Date: 2026-05-23

## Problem

When a parent enters their British Gymnastics membership number but hasn't
added Trampoline Life as a club on the BG portal, we can't see their
membership from our end. Today the only admin actions on a PENDING row
are Verify, Valid-but-expired, and Invalidate. None of these match the
intent "the number is probably real, but you need to share access with
us before we can confirm it." Admins end up either invalidating the
number (wrong) or leaving it pending while the grace runs out.

## Design

### State

Add a new `BgNumberStatus` enum value: `NOT_ON_BG`.

Semantics: the gymnast's BG number is on file and looks plausible, but
the club can't see the membership because the parent hasn't added
Trampoline Life on the BG portal. Booking behaviour mirrors the
existing `EXPIRED` state — soft-block during a 14-day grace, hard-block
afterwards — so the parent has time to fix it before bookings are
paused.

### Schema

```prisma
enum BgNumberStatus {
  PENDING
  VERIFIED
  INVALID
  EXPIRED
  NOT_ON_BG
}

model Gymnast {
  // ...existing fields...
  bgNumberLastNudgedAt DateTime?
}
```

`bgNumberLastNudgedAt` records the last time the admin sent the "please
share with us" email so the BG-numbers list can show "Nudged 3 days
ago". No dedupe block — the admin can re-send anytime.

Two-part migration per the project convention (`ALTER TYPE … ADD VALUE`
can't be used in the same transaction as the using code):

1. `20260523000001_bg_status_not_on_bg_enum/migration.sql` — adds enum
   value.
2. `20260523000002_bg_number_last_nudged_at/migration.sql` — adds the
   column.

### Backend

`PATCH /api/gymnasts/:id/bg-number/verify` accepts two new `action`
values:

- `not-on-bg` — transitions any row with a BG number set to
  `NOT_ON_BG`. Sets `bgNumberExpiredAt = null`, `bgNumberGraceDays = 14`
  (mirrors EXPIRED grace), `bgNumberLastNudgedAt = now`. Sends the new
  "please share with us" email to every guardian with an email.
- `not-on-bg-renudge` — only valid on rows already in `NOT_ON_BG`. Sets
  `bgNumberLastNudgedAt = now` and re-sends the same email. Doesn't
  change status. Doesn't reset the grace clock.

Booking gate (`checkBgNumbers` in `routes/booking/bookings.js`):

- `NOT_ON_BG` is treated identically to `EXPIRED`: allowed during the
  14-day grace (computed from `bgNumberLastNudgedAt` rather than
  `bgNumberExpiredAt` — see below), blocked once grace expires.
- Defensive fallback: if `bgNumberLastNudgedAt` is null on a NOT_ON_BG
  row (shouldn't happen — the transition always sets it), hard-block.

> **Note on grace clock for NOT_ON_BG**: we read `bgNumberLastNudgedAt`
> as the grace anchor rather than `bgNumberExpiredAt`. This means a
> re-nudge resets the booking grace, which is the right behaviour —
> if a coach re-engages a parent on day 13, the parent gets another
> 14-day window to act.

Admin BG-numbers list endpoint (`/api/gymnasts/admin/bg-numbers`):

- Include `NOT_ON_BG` rows alongside the existing PENDING / INVALID /
  EXPIRED / MISSING.
- New row state values: `NOT_ON_BG_IN_GRACE`, `NOT_ON_BG_PAST_GRACE`.
- Return `bgNumberLastNudgedAt` so the UI can show "Nudged Xd ago".

### Frontend

`AdminBgNumbers.js`:

- New badge: "Not on BG" — orange while in grace (with `Xd left`
  subscript), red past grace.
- On a PENDING row, add a fourth action button: "Not on BG".
- On a NOT_ON_BG row, single action button: "Re-send nudge".
- Each NOT_ON_BG row shows "Last nudged: Xd ago" between the badge
  and actions.
- Filter chip "Action required" now also includes
  `NOT_ON_BG_PAST_GRACE`.

`MyChildren.js`:

- When the gymnast's `bgNumberStatus === 'NOT_ON_BG'`, show a clear
  warning card:
  > "We can see you've entered a BG number for {firstName}, but we
  > can't confirm it from the club end. To fix this, log in to the
  > British Gymnastics portal and add Trampoline Life as a club.
  > Once you have, let your coach know so they can re-check."
- Include the link `https://mybg.british-gymnastics.org`.
- No "I've fixed it" button here — there's nothing for us to change
  on our side. The parent fixes it on the BG portal, then asks their
  coach to re-check. (The coach then hits Verify in admin.)

### Email

New helper in `emailService.js`:

```js
sendBgNumberClubNotSharedEmail(
  guardianEmail,
  guardianFirstName,
  gymnastFirstName,
  graceDays = 14,
)
```

Subject: `Action needed — confirm BG membership for ${firstName}`.

Body explains: "You've entered ${firstName}'s BG number, but we can't
see their membership from the club end. To fix it, log in to the
British Gymnastics portal and add Trampoline Life as a club. Once
you've done it, let your coach know so we can re-check it. You have
${graceDays} days before bookings are paused." CTA button:
"Open British Gymnastics portal" → `https://mybg.british-gymnastics.org`.
Plain-text variant.

### Audit

- `bgNumber.notOnBg` on the first transition.
- `bgNumber.notOnBgRenudge` on subsequent re-nudges.
- Metadata: `{ gymnastId, graceDays, nudgedAt }`.

## Tests

Backend Jest, extending `gymnast.bg-number.test.js`:

1. PATCH with `action: 'not-on-bg'` transitions state, sets
   `bgNumberLastNudgedAt`, `bgNumberGraceDays = 14`, sends email.
2. PATCH with `action: 'not-on-bg-renudge'` on a NOT_ON_BG row only
   updates `bgNumberLastNudgedAt`, doesn't touch status.
3. `not-on-bg-renudge` on a non-NOT_ON_BG row returns 400.
4. Booking gate allows a NOT_ON_BG gymnast in their 14-day grace.
5. Booking gate blocks a NOT_ON_BG gymnast whose grace expired.
6. Admin BG-numbers list returns the new row states.

## Out of scope

- Querying the BG portal directly (no API; the verification step is
  still manual).
- Auto-reminder cron when grace is about to expire (could add later).
- Mass-nudging multiple parents in one click.
