# Credits & Charges Redesign — Design Spec

**Date:** 2026-03-15

## Goal

Surface charges alongside credits in the member detail card in `AdminMembers.js`, consolidate the club-wide admin view into a single "Credits & Charges" page, and send notification emails to parents when a charge or credit is created or deleted.

## Architecture

Four independent concerns addressed together:

1. **Member card charges row** — a new collapsible row below the existing credits row in `AdminMembers.js`, showing outstanding (unpaid) charges for that member with inline create and delete actions.
2. **Club-wide overview** — `AdminCharges.js` gains a credits section above the existing charges section; the create-charge form is removed (creation moves to the member card). Nav link renamed to "Credits & Charges".
3. **Notification emails** — four new email functions in `emailService.js` triggered from `charges.js` and `credits.js` routes, gated behind `club.emailEnabled`.
4. **My Account page** — `MyChildren.js` gains an outstanding charges card directly below the existing credits card, so parents see both in one place.

## Files Changed

### Backend

- **`backend/routes/booking/charges.js`** — add optional `userId` query param to `GET /`; fetch user with club on `POST /` and send `sendChargeCreatedEmail`; fetch charge with user and club on `DELETE /:id` and send `sendChargeDeletedEmail`
- **`backend/routes/booking/credits.js`** — extend user fetch on `POST /assign` to include club; send `sendCreditAssignedEmail`; extend credit fetch on `DELETE /:id` to include user email and club; send `sendCreditDeletedEmail`
- **`backend/services/emailService.js`** — add four new methods: `sendChargeCreatedEmail`, `sendChargeDeletedEmail`, `sendCreditAssignedEmail`, `sendCreditDeletedEmail`

### Frontend

- **`frontend/src/utils/bookingApi.js`** — add `getChargesForUser(userId)` method calling `GET /api/booking/charges?userId=xxx`
- **`frontend/src/pages/booking/admin/AdminMembers.js`** — add charges collapsible row below the credits row in the member detail panel
- **`frontend/src/pages/booking/admin/AdminCharges.js`** — add credits section above charges section; remove create-charge form
- **`frontend/src/pages/booking/BookingLayout.js`** — rename "Admin Charges" nav link to "Credits & Charges"
- **`frontend/src/pages/booking/MyChildren.js`** — add outstanding charges card below the credits card

No schema changes. No migration required.

## Detailed Behaviour

### `GET /api/booking/charges` — userId filter

Add an optional `userId` query param. When present, filter results to that user only (still scoped to `req.user.clubId`):

```js
where: {
  clubId: req.user.clubId,
  ...(req.query.userId ? { userId: req.query.userId } : {}),
}
```

The response shape is unchanged. This endpoint remains admin/coach only.

### Charge notification emails

**`POST /api/booking/charges`** — after creating the charge, fetch the target user (already fetched for club validation) with `include: { club: { select: { emailEnabled: true } } }`. If `targetUser.club.emailEnabled`, call:

```js
await emailService.sendChargeCreatedEmail(
  targetUser.email,
  targetUser.firstName,
  value.description,
  value.amount,
  value.dueDate,
);
```

**`DELETE /api/booking/charges/:id`** — extend the existing charge fetch to include user email and club:

```js
const charge = await prisma.charge.findUnique({
  where: { id: req.params.id },
  include: {
    user: {
      select: { clubId: true, email: true, firstName: true, club: { select: { emailEnabled: true } } },
    },
  },
});
```

After deleting, if `charge.user.club.emailEnabled`:

```js
await emailService.sendChargeDeletedEmail(
  charge.user.email,
  charge.user.firstName,
  charge.description,
  charge.amount,
);
```

### Credit notification emails

**`POST /api/booking/credits/assign`** — `targetUser` is already fetched. Extend the query with `include: { club: { select: { emailEnabled: true } } }` (currently uses `findFirst` with no select, returning all scalar fields including `email` and `firstName`). After creating the credit, if `targetUser.club.emailEnabled`:

```js
await emailService.sendCreditAssignedEmail(
  targetUser.email,
  targetUser.firstName,
  value.amount,
  credit.expiresAt,
);
```

**`DELETE /api/booking/credits/:id`** — extend the existing credit fetch:

```js
include: {
  user: {
    select: { clubId: true, email: true, firstName: true, club: { select: { emailEnabled: true } } },
  },
}
```

After deleting, if `credit.user.club.emailEnabled`:

```js
await emailService.sendCreditDeletedEmail(
  credit.user.email,
  credit.user.firstName,
  credit.amount,
);
```

### Email content

All four functions follow the existing `_send` / `brandedHtml` pattern in `emailService.js`.

**`sendChargeCreatedEmail(email, firstName, description, amountPence, dueDate)`**
- Subject: `A charge has been added to your account`
- Body: "Hi [firstName], a charge of **£X.XX** has been added to your account. Description: [description]. Due by: [due date formatted en-GB]. You can pay this via the cart when you next book."

**`sendChargeDeletedEmail(email, firstName, description, amountPence)`**
- Subject: `A charge on your account has been cancelled`
- Body: "Hi [firstName], a charge of **£X.XX** ([description]) has been cancelled. No payment is required."

**`sendCreditAssignedEmail(email, firstName, amountPence, expiresAt)`**
- Subject: `A credit has been added to your account`
- Body: "Hi [firstName], a credit of **£X.XX** has been added to your account. It expires on [expiresAt formatted en-GB]. Credits are applied automatically at checkout."

**`sendCreditDeletedEmail(email, firstName, amountPence)`**
- Subject: `A credit has been removed from your account`
- Body: "Hi [firstName], a credit of **£X.XX** has been removed from your account. If you have any questions, please contact the club."

### Member card — charges row

In `AdminMembers.js`, directly below the existing credits collapsible row, add a charges row with the same visual pattern:

- **Collapsed:** label "Charges", value shows total outstanding amount in red (`var(--booking-danger)`) if any exist (e.g. "£25.00 outstanding"), or "No outstanding charges" in muted text if none.
- **Expanded:** a list of outstanding charges, each showing description, amount, due date, and a Delete button. Below the list, an inline "Add charge" form with three fields:
  - Description (text input, required)
  - Amount (£, number input, converted to pence on submit)
  - Due date (date input, defaults to today + 7 days)
  - Submit button: "Add charge"

On mount, the charges section does not pre-fetch. Charges are fetched via `bookingApi.getChargesForUser(userId)` when the section is first expanded — this is a lazy fetch on first open, triggered by the toggle handler. After any create or delete action, the section re-fetches. Note: this differs from the credits row, where credits arrive with the member list payload; the charges fetch is on-demand.

The member's `userId` (the parent account, not the gymnast) is already available in the member detail panel.

### Club-wide overview (`AdminCharges.js`)

**Credits section (new, on top):** Fetches `bookingApi.getAllCredits()` on mount. Renders a table of members with active credits: columns are Name, Email, Total credits (formatted as £X.XX in accent colour). The `getAllCredits()` endpoint returns a `totalCredits` value per user; the frontend filters to `totalCredits > 0` before rendering. Read-only — no actions.

**Charges section (existing, below):** The existing all-charges table is unchanged (member name, description, amount, due date, paid/unpaid status, delete button). The create-charge form is removed from this page.

The page heading updates to "Credits & Charges".

### Nav link rename

In `BookingLayout.js`, the existing NavLink with text "Admin Charges" is renamed to "Credits & Charges". The route (`/booking/admin/charges`) and component are unchanged.

### My Account page (`MyChildren.js`)

Fetch `bookingApi.getMyCharges()` in the existing `useEffect` alongside the credits and memberships fetches. Store in a `charges` state variable.

Render a charges card directly below the credits card. Unlike the credits card (which is hidden when there are no credits), the charges card is always shown when there are outstanding charges and hidden when there are none — mirroring the credits card's conditional render.

```jsx
{charges.length > 0 && (
  <div className="bk-card" style={{ marginBottom: '1.5rem' }}>
    <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>Outstanding charges</p>
    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>
      Settled automatically at checkout — go to your cart to pay.
    </p>
    <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--booking-danger)' }}>
      £{(charges.reduce((s, c) => s + c.amount, 0) / 100).toFixed(2)} outstanding
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {charges.map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <span>{c.description}</span>
          <span className="bk-muted">Due {new Date(c.dueDate).toLocaleDateString('en-GB')}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

Read-only — no payment button here. The existing "My Charges" page and cart handle payment. `bookingApi.getMyCharges()` already returns only unpaid charges, so no client-side filter is needed.

## Testing

Backend:
- `GET /api/booking/charges?userId=xxx` returns only charges for that user, scoped to the club
- `POST /api/booking/charges` triggers `sendChargeCreatedEmail` when `emailEnabled` is true; does not trigger when false
- `DELETE /api/booking/charges/:id` triggers `sendChargeDeletedEmail` when `emailEnabled` is true
- `POST /api/booking/credits/assign` triggers `sendCreditAssignedEmail` when `emailEnabled` is true
- `DELETE /api/booking/credits/:id` triggers `sendCreditDeletedEmail` when `emailEnabled` is true

Frontend (manual):
- Charges row expands/collapses correctly in member card
- Outstanding total reflects current charges
- Add charge defaults due date to today + 7 days
- Delete removes the row and updates the total
- `AdminCharges.js` shows credits section above charges, no create form
- Nav link reads "Credits & Charges"
- `MyChildren.js` shows outstanding charges card when charges exist, hidden when none
- Charges card on My Account shows description and due date per row, total in red
