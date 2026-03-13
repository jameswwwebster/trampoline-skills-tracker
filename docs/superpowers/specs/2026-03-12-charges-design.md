# Charges — Design Spec

**Date:** 2026-03-12

## Overview

Add admin-issued charges to the booking system. A charge is a named debt a club admin creates against a member (e.g. "Private session 10 March — £15.00"). Charges are settled through the existing combined checkout alongside bookings and shop items. Credits offset the full grand total (sessions + shop + charges) — this is a deliberate change from the current behaviour where credits only offset sessions; after this feature, credits will also offset shop items and charges in the combined checkout. Overdue unpaid charges block new bookings.

## Database

Add a `Charge` model to `schema.prisma`:

```prisma
model Charge {
  id                    String    @id @default(cuid())
  userId                String
  clubId                String
  amount                Int                          // pence
  description           String
  dueDate               DateTime
  paidAt                DateTime?
  paidOnPaymentIntentId String?
  createdAt             DateTime  @default(now())

  user  User  @relation(fields: [userId], references: [id])
  club  Club  @relation(fields: [clubId], references: [id])

  @@map("charges")
}
```

Add the reverse relations to `User` and `Club`:
```prisma
// on User
charges  Charge[]

// on Club
charges  Charge[]
```

`paidAt` is null while unpaid. `paidOnPaymentIntentId` is set when included in a PaymentIntent (allows webhook to mark paid on success or clear on failure). If `chargeAmount = 0` (credits cover everything), charges are marked paid immediately with no PaymentIntent.

Migration: `npx prisma migrate dev --name add_charges`

## Backend

### New route file: `routes/booking/charges.js`

Mounted at `/api/booking/charges`. Use the same `auth` and `requireRole` middleware as `routes/booking/credits.js` — follow that file's pattern exactly for route-level auth.

**Route registration order matters:** Register `GET /my` before `DELETE /:id`. Otherwise Express will match the literal string `"my"` against the `:id` parameter on delete requests.

- **`GET /my`** — Authenticated (non-admin). Returns all unpaid charges for `req.user.id` (where `paidAt IS NULL`), ordered by `dueDate` asc.
- **`POST /`** — Admin/coach only. Body: `{ userId, amount, description, dueDate }`. Joi validation: `userId` string required, `amount` integer min 1 required, `description` string required, `dueDate` ISO date required. Creates `Charge` record with `clubId = req.user.clubId`. Audit logged (`charge.create`).
- **`GET /`** — Admin/coach only. Returns all charges for the club (paid and unpaid), ordered by `createdAt` desc, with `user { firstName, lastName, email }` included.
- **`DELETE /:id`** — Admin/coach only. Rejects with 400 if `paidAt` is set. Deletes the charge. Audit logged (`charge.delete`).

### Changes to `routes/booking/bookings.js` — combined checkout (`POST /combined`)

**Credit scoping change:** Credits currently apply only to `sessionTotal`; shop items are charged in full on top. This changes: credits now offset the full grand total. This is intentional — it affects any combined checkout that includes both credits and shop items, not just charges.

New flow for `POST /combined`:

1. Fetch outstanding charges: `const outstandingCharges = await prisma.charge.findMany({ where: { userId: req.user.id, paidAt: null } })`
2. Compute `chargeTotal = outstandingCharges.reduce((s, c) => s + c.amount, 0)`
3. **Empty-cart guard** (evaluated here, after step 2 once `chargeTotal` is known): if `sessions.length === 0 && shopItems.length === 0 && chargeTotal === 0`, return 400. This replaces the existing guard which only checked sessions and shop.
4. Grand total: `grandTotal = sessionTotal + shopTotal + chargeTotal`
5. Credit offset against grand total: `creditAmount = Math.min(availableCredits, grandTotal)`
6. `paymentAmount = Math.max(0, grandTotal - creditAmount)`
7. **Stale cleanup**: before creating a new PaymentIntent, clear `paidOnPaymentIntentId` on any of the user's charges that currently have one set but are still unpaid: `await prisma.charge.updateMany({ where: { userId: req.user.id, paidAt: null, paidOnPaymentIntentId: { not: null } }, data: { paidOnPaymentIntentId: null } })`. This handles abandoned prior checkouts.
8. If `paymentAmount > 0`: create PaymentIntent, then update each charge from the step-1 result set (using their IDs) to set `paidOnPaymentIntentId = paymentIntent.id`. Use the IDs collected in step 1 — do not re-fetch.
9. If `paymentAmount = 0`: set `paidAt = now` on each charge from the step-1 result set immediately. Mark bookings CONFIRMED as now.

The single booking (`POST /`) and batch booking (`POST /batch`) routes are **not** changed to settle charges — the combined checkout is the only settlement path.

### Overdue charge guard in booking routes

`POST /` and `POST /batch` check for overdue charges before processing. `POST /combined` is **exempt** — it is the settlement path and must always be accessible.

Guard for `POST /` and `POST /batch`:

```js
const overdueCharge = await prisma.charge.findFirst({
  where: { userId: req.user.id, paidAt: null, dueDate: { lt: new Date() } },
});
if (overdueCharge) {
  return res.status(400).json({ error: 'You have an overdue charge. Please pay it before making new bookings.' });
}
```

Note: `dueDate` values are stored as UTC midnight. The comparison `lt: new Date()` is UTC-based. This is acceptable for a UK-based system where any timezone skew is at most 1 hour.

### Changes to `routes/booking/webhook.js`

- **`payment_intent.succeeded`**: after confirming bookings, also mark matching charges paid:
  ```js
  await prisma.charge.updateMany({
    where: { paidOnPaymentIntentId: paymentIntent.id },
    data: { paidAt: new Date() },
  });
  ```
- **`payment_intent.payment_failed`** and **`payment_intent.canceled`**: clear `paidOnPaymentIntentId` on charges (returns them to outstanding):
  ```js
  await prisma.charge.updateMany({
    where: { paidOnPaymentIntentId: paymentIntent.id },
    data: { paidOnPaymentIntentId: null },
  });
  ```

### Mount the new route

Add to `server.js`:
```js
app.use('/api/booking/charges', require('./routes/booking/charges'));
```

## Frontend

### `bookingApi.js`

Add four new methods to the `bookingApi` client:
- `getMyCharges()` — `GET /api/booking/charges/my`
- `getAdminCharges()` — `GET /api/booking/charges`
- `createCharge(data)` — `POST /api/booking/charges`
- `deleteCharge(id)` — `DELETE /api/booking/charges/:id`

### New page: `MyCharges.js` (`/booking/my-charges`)

Read-only list of the parent's outstanding unpaid charges. Columns: description, amount (£), due date. No payment button — payment via cart. Displays "No outstanding charges" when empty. Only rendered for non-admin users. Linked from the Bookings dropdown in the nav alongside "My Bookings".

### Cart (`Cart.js`)

On mount, fetch `bookingApi.getMyCharges()` alongside existing credits fetch. Render a non-removable "Outstanding charges" section below bookings/shop items — no × button. Credits now offset the grand total (`sessionTotal + shopTotal + chargeTotal`). The existing credit display line updates to reflect the new total. The payload sent to the combined checkout endpoint does not need to include charge IDs — the backend fetches outstanding charges by `userId` at settlement time.

A charges-only cart (no bookings or shop items) is valid and will check out successfully once the empty-cart guard in `POST /combined` is relaxed.

**Confirmation page:** After a charges-only free checkout (credits fully cover, `paymentAmount = 0`), there are no booking IDs or shop order IDs to pass. Navigate to `/booking/my-charges` with a success query param (e.g. `?paid=true`) and display a "Charges settled" confirmation message there.

### Nav banner (`BookingLayout.js`)

On layout mount (alongside the existing membership/noticeboard checks), non-admin users fetch `bookingApi.getMyCharges()`. If any returned charge has `dueDate < now` (client-side comparison), show an overdue banner:

> ⚠ You have an overdue charge — pay now →

Linking to `/booking/cart`. Uses the same banner style as the existing payment banner.

### Booking Calendar / Session Detail

When the parent has an overdue charge (detectable from the charges state passed down or fetched in the nav), the session detail component shows a blocking message instead of the booking form: "You have an overdue charge. Please pay it before making new bookings." with a link to the cart. The backend enforces this with a 400 response; the frontend block is a UX improvement only.

### Admin page: `AdminCharges.js` (`/booking/admin/charges`)

- Fetches `bookingApi.getAdminCharges()` on mount
- Lists all club charges (paid and unpaid) with: member name, description, amount, due date, paid status
- Create charge form: member selector (dropdown of club members), amount (£, converted to pence on submit), description, due date
- Delete button per row — disabled once paid
- Linked from the admin nav under Tools dropdown

## What is NOT changing

- Single booking (`POST /`) and batch (`POST /batch`) credit logic — unchanged; credits apply to their own session totals only in those routes
- `Credit` model — no changes
- `BookingLine` and `Booking` models — no changes

## Success criteria

- Admin can create a charge against a member with amount, description, and due date
- Parent can see outstanding charges on My Charges page
- Charges appear in the cart (non-removable) and are settled via combined checkout
- Credits offset the full cart total (sessions + shop + charges)
- Overdue charges block `POST /` and `POST /batch` (backend 400 + frontend message); `POST /combined` remains accessible
- Nav banner appears when any charge is past its due date
- Webhook marks charges paid on `payment_intent.succeeded`
- Webhook clears `paidOnPaymentIntentId` on failure/cancellation
- Admin can delete unpaid charges; paid charges cannot be deleted
- Charges-only cart (no bookings or shop items) checks out successfully
