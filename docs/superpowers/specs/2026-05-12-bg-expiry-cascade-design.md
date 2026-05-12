# BG-membership expiry cascade and UX overhaul

Date: 2026-05-12

## Problem

The BG-number EXPIRED state exists, but the surrounding flow has gaps:

- When a gymnast's BG lapses, an admin can mark them EXPIRED and the parent
  gets a "you have 14 days" email, but the matching monthly subscription keeps
  charging. Parent ends up paying for a child who can no longer book.
- Admins must verify a number before they can expire it, so "real BG number,
  membership lapsed" requires a two-step PENDING → VERIFIED → EXPIRED dance.
- Parents who renew their BG offsite have no clear way to tell us. They have
  to re-enter the same number to flip status back to PENDING.
- The admin BG-numbers page only surfaces gymnasts with ≥ 2 past sessions, so
  active-paying gymnasts without a number are invisible.
- There's no list of "lapsed members" anywhere.
- Re-verifying a renewed BG doesn't reactivate the previously-scheduled-
  cancellation subscription, and there's no admin path to do it manually.

## Design

### State model & cascades

`BgNumberStatus` enum unchanged: `PENDING | VERIFIED | INVALID | EXPIRED`.

`PATCH /api/gymnasts/:id/bg-number/verify` gains a fourth `action`:
`expire-pending` ("valid but expired"). It is identical to `expire` except it
runs from `bgNumberStatus = PENDING`, skipping the verify step. Sets:

- `bgNumberStatus = EXPIRED`
- `bgNumberExpiredAt = now`
- `bgNumberGraceDays = 14`

When any path puts a gymnast into EXPIRED, cascade to memberships at the same
club:

- For every Membership with `gymnastId = g.id`, `clubId = g.clubId`, and
  `status ∈ { ACTIVE, PAUSED, PENDING_PAYMENT, SCHEDULED }` and a non-null
  `stripeSubscriptionId`:
  - Call Stripe `subscriptions.update(id, { cancel_at_period_end: true })`.
  - Record `Membership.scheduledCancelAt = sub.current_period_end` (new column,
    `DateTime?`).
- Local `Membership.status` is NOT changed at this point. When Stripe
  eventually emits `customer.subscription.deleted` at period-end, the existing
  webhook flips status to CANCELLED and removes commitments — no change
  needed there.
- Commitments stay live until the sub actually cancels. The 14-day BG grace
  already lets booking continue during that window; the sub end-of-period
  matches that "you have until X" promise.

When admin re-verifies a previously-EXPIRED BG (`action = verify`):

- Status goes to VERIFIED as today.
- The membership cascade is **not** auto-reversed. The admin must click
  "Resume subscription" in the new BG-expired section (see UI below). This
  matches the user request "a coach should have a way to reactivate".

Admin "Resume subscription" backend:

- New endpoint `POST /api/booking/memberships/:id/resume` — staff only.
- Loads the Membership; rejects if `scheduledCancelAt = null` (nothing to
  resume) or `scheduledCancelAt <= now` (Stripe sub already ended — admin
  must use the membership-setup flow instead).
- Calls Stripe `subscriptions.update(id, { cancel_at_period_end: false })`.
- Clears `scheduledCancelAt` and audits `membership.resume`.

Parent self-service renewal:

- New endpoint `PATCH /api/gymnasts/:id/bg-number/resubmit` — guardian-only,
  requires `bgNumberStatus = EXPIRED`. Sets:
  - `bgNumberStatus = PENDING`
  - `bgNumberEnteredAt = now`
  - `bgNumberGraceDays = 3` (shortened grace, same as INVALID → PENDING)
  - Does not touch the BG number itself, does not touch the membership.

### Database

One new column:

- `Membership.scheduledCancelAt DateTime?` — populated when BG-expiry schedules
  the Stripe `cancel_at_period_end`. Cleared on resume.

Migration: add nullable column, no backfill.

### Admin UI

`AdminMemberships.js` (Memberships tab):

- New section above the main table titled **"BG-expired members"** when any
  rows match. Shown for gymnasts where `bgNumberStatus = EXPIRED` AND there
  is a Membership at this club with `status != CANCELLED`. Columns: name,
  monthly amount, scheduled cancel date, "Resume subscription" button.
- "Resume subscription" is enabled only while `scheduledCancelAt > now`
  (sub not yet ended). Calls Stripe `subscriptions.update(id, { cancel_at_period_end: false })`,
  clears `scheduledCancelAt`. After the sub has actually cancelled the row
  drops out of this list — to come back the admin uses the existing
  "Set up membership" flow.
- Status filter dropdown gains a synthetic value `BG_EXPIRED` which filters
  the main table to rows where `gymnast.bgNumberStatus = EXPIRED`.

`AdminBgNumbers.js` (BG Numbers tab) — rewritten:

- One combined table showing every non-archived gymnast in the club whose
  BG status is not currently `VERIFIED`. That includes:
  - PENDING numbers awaiting verification.
  - INVALID — admin rejected.
  - EXPIRED — in grace window.
  - EXPIRED — past grace.
  - MISSING — no number at all (no minimum past-session threshold).
- Columns: gymnast, adult/guardian, status badge, "days in state", actions.
- Status badges:
  - PENDING (yellow)
  - INVALID (red)
  - EXPIRED-IN-GRACE (orange, with `N days left` text)
  - EXPIRED-PAST-GRACE (red)
  - MISSING (grey)
- Action buttons by status:
  - PENDING: `Verify`, `Valid but expired`, `Invalidate`.
  - VERIFIED: not in this list.
  - INVALID: no action here (parent re-enters via My Children).
  - EXPIRED: no action here (parent re-submits via My Children, or admin
    can hit "Restore to VERIFIED" — out of scope this iteration).
  - MISSING: no action here.
- Filter chips above the table: `All` / `Action required` (PENDING + EXPIRED-PAST-GRACE) / `Just FYI` (everything else).
- Sortable by status group then days-in-state descending.

### Parent UX

In `MyChildren.js`, the BG card for a gymnast where `bgNumberStatus = EXPIRED`
gets a primary CTA `I've renewed it with British Gymnastics` alongside the
existing edit-number affordance. Click → POSTs to the new resubmit endpoint.
Success toast: *"Thanks — a coach will re-check it."*

Existing inline copy under the BG number stays; the renewed-it CTA is the
new, more obvious path.

### Email copy

`sendBgNumberExpiredEmail` gains an extra paragraph when the gymnast has any
non-CANCELLED Membership at this club:

> Your monthly subscription will end at the close of your current billing
> period (DD Month). To keep your standing slot, please renew your BG
> membership with British Gymnastics and click "I've renewed it" in My
> Account so we can re-check it before then.

Pure text variant in the plain-text body.

## Out of scope

- Restoring an already-CANCELLED subscription (admin recreates via existing
  membership-setup flow).
- Restoring an EXPIRED BG to VERIFIED without re-going through PENDING (not
  needed for the user-reported flows).
- Notifying parents automatically when their sub does actually cancel
  end-of-period — relies on the existing Stripe webhook + email path.

## Tests

Backend (Jest):

1. `expire-pending` action transitions PENDING → EXPIRED with grace window
   and email.
2. `expire` action schedules cancel_at_period_end on every live membership
   for that gymnast at the same club and records `scheduledCancelAt`.
3. Webhook `customer.subscription.deleted` still cascades to remove
   commitments (regression coverage for the earlier fix).
4. Admin re-verify after expiry does NOT change `scheduledCancelAt` or call
   Stripe.
5. New `POST /memberships/:id/resume` endpoint: flips
   `cancel_at_period_end=false` and clears `scheduledCancelAt`; rejects if
   sub already ended.
6. Parent resubmit endpoint: requires `EXPIRED` status, flips to PENDING
   with 3-day grace.
7. Admin BG-numbers GET returns gymnasts of every non-VERIFIED state,
   correctly grouped/badged.
