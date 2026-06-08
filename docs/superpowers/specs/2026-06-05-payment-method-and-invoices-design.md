# Member-facing payment method update + invoice history (with admin read view)

Date: 2026-06-05

## Problem

Today there's no in-app way for a parent to see what card we have on
file or update it (e.g. when their card expires). The only signal is
that subscription payments start failing and we send a "Membership at
risk" email. By then the gymnast's standing slot is already on a path
to cancellation.

Coaches and admins also can't see the card-on-file or invoice history
from a member's profile, so chasing a payment-method update means
asking the parent to find an old email or a Stripe receipt.

## Design

### Member UI — My Account

Two new sections on the existing My Account page, both gated on the
user having (or being able to create) a Stripe customer.

**Payment method**

- Card-on-file row: brand icon + `•••• 4242` + `Expires 03/28`. If no
  card on file: "No card saved — add one to keep your subscription
  active."
- Button: **Update payment method**. Opens an inline Stripe Elements
  card form below the row.
- On submit:
  1. POST `/api/booking/payment-method/setup-intent` returns a
     `client_secret`. Backend creates the Stripe customer first if the
     user doesn't already have a `stripeCustomerId`.
  2. Frontend confirms the SetupIntent via
     `stripe.confirmCardSetup(client_secret, { payment_method: { card } })`.
  3. POST `/api/booking/payment-method/confirm` with the
     `paymentMethodId` from the successful SetupIntent.
- After success the card row refreshes to show the new brand/last4.
- The old card stays attached on the customer (a refund could still
  need to land on it) but is no longer the default.

**Recent invoices**

- Table of the last **12 months** of Stripe invoices for the
  customer. Columns: date, description (joined `line.description`
  strings), amount, status pill (Paid / Open / Failed / Refunded /
  Draft), a link to the Stripe-hosted invoice page
  (`hosted_invoice_url`) that opens in a new tab.
- Source: live Stripe API call, no local mirror. We trim
  `stripe.invoices.list({ customer, limit: 24 })` to the 12-month
  window in code.
- If the user has no `stripeCustomerId` we skip the section entirely.

### Admin UI — member profile

In `AdminMembers.js`, the member-detail panel gains two read-only
sections that appear when the member has a `stripeCustomerId`:

- Same card-on-file row as the member view, **with no Update
  button**. Instead a small note: *"Card details can only be changed
  by the member from their own My Account."*
- Same invoice list, opening Stripe hosted-invoice links in a new
  tab.

Admins can look but not edit. We're avoiding PCI exposure on the
admin side, and the existing "Membership at risk" coach email already
exists for nudging.

### Backend endpoints

All take `req.user.id` for member-self calls and a `:userId` path
param for admin calls. Admin endpoints enforce both the
`CLUB_ADMIN | COACH` role AND that the target user shares the
admin's `clubId`.

**Member-self:**

- `GET /api/booking/payment-method`
  - Returns `{ brand, last4, expMonth, expYear, customerId }` for the
    user's default PM, or `null` if none / no Stripe customer.
- `POST /api/booking/payment-method/setup-intent`
  - If the user has no `stripeCustomerId`, create the Stripe customer
    (email/name from User), persist the id back, then create a
    SetupIntent for that customer. Returns `{ clientSecret }`.
- `POST /api/booking/payment-method/confirm` — body `{ paymentMethodId }`.
  - Attach the PM to the customer (idempotent — Stripe Elements may
    have already attached it as part of confirmCardSetup).
  - `stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } })`.
  - List the user's subscriptions with status in
    `{ active, past_due, trialing, incomplete }` and call
    `subscriptions.update(subId, { default_payment_method: pmId })` on each.
  - Audit `paymentMethod.update` with metadata `{ pmId, subsUpdated }`.
- `GET /api/booking/invoices`
  - Returns up to 24 invoices, trimmed in the route to created >= now-365d
    via `stripe.invoices.list({ customer, limit: 24, created: { gte } })`.
    Shape per row: `{ id, number, created, total, status, hostedInvoiceUrl, lines: [{ description, amount }] }`.

**Admin read-only:**

- `GET /api/booking/admin/users/:userId/payment-method`
- `GET /api/booking/admin/users/:userId/invoices`

Both staff-only, both enforce same-club. Same shapes as the
member-self endpoints.

### Frontend API helpers

In `bookingApi.js`:

- `getMyPaymentMethod()`, `createPaymentMethodSetupIntent()`,
  `confirmPaymentMethod(paymentMethodId)`, `getMyInvoices()`.
- `getMemberPaymentMethod(userId)`, `getMemberInvoices(userId)`.

### Tests

Backend Jest with Stripe SDK mocked:

1. `GET /payment-method` returns null for a user with no Stripe
   customer.
2. `GET /payment-method` returns brand/last4/exp when the customer
   has a default PM.
3. `POST /setup-intent` creates the customer if missing and persists
   `stripeCustomerId`; returns `{ clientSecret }`.
4. `POST /confirm` attaches the PM, sets customer default, calls
   `subscriptions.update` for each live sub.
5. `GET /invoices` returns the mapped, trimmed list.
6. Member-self endpoints 401 for unauthenticated.
7. Admin `GET /admin/users/:id/payment-method` works for same-club
   coach, 403 for different-club coach, 403 for parent.
8. Admin `GET /admin/users/:id/invoices` ditto.

No frontend Jest tests — UI covered by manual smoke.

## Out of scope

- Multiple cards / "add card alongside" UI.
- Showing booking + shop receipts in the invoice list (those are
  PaymentIntents, not Stripe Invoices — emailed receipts already).
- Admin "send card-update reminder" button.
- 3DS / SCA edge-case UI beyond what Stripe Elements does itself.
