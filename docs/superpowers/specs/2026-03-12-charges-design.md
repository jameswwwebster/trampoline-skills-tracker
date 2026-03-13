# Charges — Design Spec

**Date:** 2026-03-12

## Overview

Add admin-issued charges to the booking system. A charge is a named debt a club admin creates against a member (e.g. "Private session 10 March — £15.00"). Charges are settled through the existing combined checkout alongside bookings and shop items. Credits offset the full cart total (sessions + shop + charges). Overdue unpaid charges block new bookings.

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

Mounted at `/api/booking/charges`.

- **`POST /`** — Admin/coach only. Body: `{ userId, amount, description, dueDate }`. Joi validation: `userId` string required, `amount` integer min 1 required, `description` string required, `dueDate` ISO date required. Creates `Charge` record with `clubId = req.user.clubId`. Audit logged (`charge.create`).
- **`GET /`** — Admin/coach only. Returns all charges for the club (paid and unpaid), ordered by `createdAt` desc, with `user { firstName, lastName, email }` included.
- **`DELETE /:id`** — Admin/coach only. Rejects with 400 if `paidAt` is set. Deletes the charge. Audit logged (`charge.delete`).
- **`GET /my`** — Authenticated parent. Returns all unpaid charges for `req.user.id` (where `paidAt IS NULL`), ordered by `dueDate` asc.

### Changes to `routes/booking/bookings.js` — combined checkout (`POST /combined`)

Current flow applies credits only against `sessionTotal`. New flow:

1. Fetch outstanding charges: `prisma.charge.findMany({ where: { userId: req.user.id, paidAt: null } })`
2. Compute `chargeTotal = sum of charge.amount`
3. Grand total: `grandTotal = sessionTotal + shopTotal + chargeTotal`
4. Credit offset against grand total: `creditAmount = Math.min(availableCredits, grandTotal)`
5. `chargeAmount = Math.max(0, grandTotal - creditAmount)`
6. **Stale cleanup**: before creating a PaymentIntent, clear `paidOnPaymentIntentId` on any of the user's charges that have a stale intent ID (same pattern as stale PENDING booking cleanup)
7. If `chargeAmount > 0`: set `paidOnPaymentIntentId` on each outstanding charge to the new PaymentIntent ID
8. If `chargeAmount = 0`: set `paidAt = now` on each outstanding charge immediately

The single booking (`POST /`) and batch booking (`POST /batch`) routes are **not** changed to settle charges — the combined checkout is the only settlement path.

### Overdue charge guard in booking routes

`POST /`, `POST /batch`, and `POST /combined` (sessions portion only — the combined route must still be able to settle) all check for overdue charges before processing:

```js
const overdueCharge = await prisma.charge.findFirst({
  where: { userId: req.user.id, paidAt: null, dueDate: { lt: new Date() } },
});
if (overdueCharge) {
  return res.status(400).json({ error: 'You have an overdue charge. Please pay it before making new bookings.' });
}
```

The combined checkout is exempt — it is the settlement path.

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

Add to `server.js` (or wherever booking routes are mounted):
```js
app.use('/api/booking/charges', require('./routes/booking/charges'));
```

## Frontend

### New page: `MyCharges.js` (`/booking/my-charges`)

Read-only list of the parent's outstanding unpaid charges. Columns: description, amount (£), due date. No payment button — payment via cart. Displays "No outstanding charges" when empty. Linked from the Bookings dropdown in the nav alongside "My Bookings".

### Cart (`Cart.js`)

On mount, fetch `GET /api/booking/charges/my` alongside existing credits fetch. Render a non-removable "Outstanding charges" section below bookings/shop items — no × button. Credits now offset the grand total (`sessionTotal + shopTotal + chargeTotal`). The existing credit display line updates to reflect the new total. The `chargeAmount` sent to the combined checkout includes charges.

If the cart has only charges (no bookings or shop items), checkout still works — the combined endpoint handles it.

### Nav banner (`BookingLayout.js`)

On layout mount (alongside the existing membership/noticeboard checks), fetch `GET /api/booking/charges/my`. If any returned charge has `dueDate < now`, show an overdue banner:

> ⚠ You have an overdue charge — pay now →

Linking to `/booking/cart`. Uses the same banner style as the existing payment banner.

### Booking Calendar / Session Detail

When the parent has an overdue charge (detectable from the charges fetch or the nav banner state), the session detail component shows a blocking message instead of the booking form: "You have an overdue charge. Please pay it before making new bookings." with a link to the cart. The backend also enforces this (400 response), so the frontend block is a UX improvement only.

### Admin page: `AdminCharges.js` (`/booking/admin/charges`)

- Fetches `GET /api/booking/charges` on mount
- Lists all club charges (paid and unpaid) with: member name, description, amount, due date, paid status
- Create charge form: member selector (dropdown of club members), amount (£, converted to pence), description, due date
- Delete button per row — disabled once paid
- Linked from the admin nav under Tools dropdown

## What is NOT changing

- Single booking (`POST /`) and batch (`POST /batch`) credit logic — they continue to apply credits against their own session totals only, unchanged
- `Credit` model — no changes
- Shop checkout — shop items remain unchanged; credits offsetting shop is a side-effect of the new grand-total credit calculation in combined checkout only
- `BookingLine` and `Booking` models — no changes

## Success criteria

- Admin can create a charge against a member with amount, description, and due date
- Parent can see outstanding charges on My Charges page
- Charges appear in the cart (non-removable) and are settled via combined checkout
- Credits offset the full cart total including charges
- Overdue charges block new bookings (backend 400 + frontend message)
- Nav banner appears when any charge is past its due date
- Webhook marks charges paid on `payment_intent.succeeded`
- Webhook clears `paidOnPaymentIntentId` on failure/cancellation
- Admin can delete unpaid charges; paid charges cannot be deleted
