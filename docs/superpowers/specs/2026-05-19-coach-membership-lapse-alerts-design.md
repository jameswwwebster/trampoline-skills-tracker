# Coach email alerts when a membership lapses

Date: 2026-05-19

## Problem

When a monthly subscription starts failing or gets cancelled (by Stripe or
by an admin), the parent gets emailed but no one on the coaching side is
told. Two club memberships were silently auto-cancelled by Stripe in one
night recently and no one noticed until a coach asked "where's Tristan's
membership gone?" days later.

## Design

### Triggers

Both triggers live in the existing Stripe webhook handler
(`backend/routes/booking/webhook.js`):

1. **Lapsing** — on `invoice.payment_failed` for a subscription that maps
   to a known Membership. Fire a "Membership at risk" email per failure
   (no dedupe — see Noise note below).
2. **Lapsed** — on `customer.subscription.deleted`. Fire a "Membership
   lapsed" email regardless of who initiated the cancellation. The email
   body distinguishes the trigger.

### Cancellation trigger classification

When `customer.subscription.deleted` arrives, look up the local Membership
row by `stripeSubscriptionId`. Before the webhook updates the row, check
its current local status:

- If `Membership.status === 'CANCELLED'` already, the admin DELETE
  endpoint cancelled it (it sets status to CANCELLED then calls
  `stripe.subscriptions.cancel`, so the webhook arrives after). The
  email body reads "Cancelled by `<admin name>` on `<date>`". Admin name
  is taken from the most recent `audit_logs` row matching
  `action='membership.cancel'` and `entityId=<membership.id>`.
- Otherwise it's Stripe-initiated (retries exhausted or otherwise).
  Body reads "Cancelled by Stripe — payment failed and retries exhausted."

### Recipients

For both emails, resolve recipients via:

```js
prisma.user.findMany({
  where: {
    clubId: membership.clubId,
    role: { in: ['CLUB_ADMIN', 'COACH'] },
    isArchived: false,
    email: { not: null },
    coachLapseAlerts: true,
  },
  select: { email: true, firstName: true },
})
```

Gated by `Club.emailEnabled` (existing flag). Send is non-blocking — log
on failure but don't fail the webhook (mirrors existing email patterns
in the webhook).

### Schema

Add to `User`:

```prisma
coachLapseAlerts Boolean @default(true)
```

One Prisma migration; default `true` so existing coaches/admins opt in.
Surfaced as a checkbox in My Account next to the other notification
preferences (e.g. `weeklySessionReminder`).

### Email service

Two new helpers in `backend/services/emailService.js`:

```js
sendMembershipLapsingEmail({
  coachEmail, coachName,
  gymnast, parentName, monthlyAmount,
  attemptCount, nextRetryDate,
  membershipsUrl,
})

sendMembershipLapsedEmail({
  coachEmail, coachName,
  gymnast, parentName,
  cancellationTrigger, // 'admin' | 'stripe'
  cancelledByName,     // optional, for admin trigger
  cancelledAt,
  membershipsUrl,
})
```

Branded HTML + plain-text variants, following the existing pattern.

### My Account UI

`MyAccount` page already has `weeklySessionReminder` toggle. Add a
`coachLapseAlerts` toggle in the same block, only shown to users whose
role is `CLUB_ADMIN` or `COACH`.

## Tests

Backend Jest (`__tests__/webhook.membership-alerts.test.js`):

1. `invoice.payment_failed` for a known sub → CLUB_ADMIN + COACH in the
   club each receive one email; user with `coachLapseAlerts=false`
   receives none; user in a different club receives none.
2. Two consecutive `invoice.payment_failed` events → coach receives two
   emails (no dedupe per design).
3. `customer.subscription.deleted` with the local row already at
   CANCELLED status → email body includes "Cancelled by `<admin>`".
4. `customer.subscription.deleted` with the local row still at ACTIVE
   → email body includes "Cancelled by Stripe".

## Out of scope

- Daily digest mode for lapsing emails.
- In-app notification / push.
- Per-Stripe `cancellation_details.reason` granularity — just admin vs
  Stripe is enough today.
- Retro-firing alerts for the three subs that lapsed before this ships.

## Known noise risk

Stripe's default Smart Retries fire 3 attempts per invoice. Each failure
will produce one email per coach + admin per attempt — for a club with
4 staff, that's 12 emails for a single failing invoice. If this turns
out to be too noisy in practice the cleanest fix is to add
`Membership.lastLapseEmailAt` and skip if within 24 hours, but that's
not part of this iteration.
