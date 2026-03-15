# Recurring Credits — Design Spec

**Date:** 2026-03-15

## Goal

Allow admins to set up a monthly recurring credit for any member. The credit is issued immediately on setup and then on the 1st of each subsequent month, expiring at the end of that month. An optional end date stops issuance automatically; admins can also cancel a rule at any time.

## Data Model

```prisma
model RecurringCredit {
  id            String    @id @default(cuid())
  club          Club      @relation(fields: [clubId], references: [id])
  clubId        String
  user          User      @relation(fields: [userId], references: [id])
  userId        String
  amountPence   Int
  endDate       DateTime?
  isActive      Boolean   @default(true)
  lastIssuedAt  DateTime?
  createdBy     User      @relation("RecurringCreditCreatedBy", fields: [createdById], references: [id])
  createdById   String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("recurring_credits")
}
```

Back-relations to add to existing models:

```prisma
// In model Club — add alongside other relation fields:
recurringCredits  RecurringCredit[]

// In model User — add alongside other relation fields:
recurringCredits         RecurringCredit[]
createdRecurringCredits  RecurringCredit[]  @relation("RecurringCreditCreatedBy")
```

**Credit issuance:** uses the existing `Credit` model unchanged — `prisma.credit.create({ data: { userId, amount, expiresAt } })`.

`expiresAt` is computed as UTC: last second of the calendar month in which the credit is issued — `new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))` where `month` is the 1-indexed next month (i.e. for March, `month = 4`, `day = 0` gives 31 Mar).

All date comparisons in the cron and route use UTC throughout.

**Duplicate rules:** Multiple active rules for the same user are permitted. This is intentional — a member could receive more than one type of recurring credit simultaneously.

## Backend Routes (`backend/routes/booking/recurringCredits.js`)

All routes require `CLUB_ADMIN` or `COACH` (403 on wrong role, 401 on no token). Club scoping via `req.user.clubId`.

### `GET /api/booking/recurring-credits`

Returns all active (`isActive: true`) recurring credit rules for the club, ordered by `createdAt` descending. Include `user: { select: { firstName: true, lastName: true } }`.

**Response:**
```json
[
  {
    "id": "...",
    "userId": "...",
    "userName": "Chris Owens",
    "amountPence": 1000,
    "endDate": null,
    "lastIssuedAt": "2026-03-15T09:00:00.000Z",
    "createdAt": "2026-03-15T09:00:00.000Z"
  }
]
```

`userName` is constructed server-side as `` `${user.firstName} ${user.lastName}` ``.

### `POST /api/booking/recurring-credits`

Create a rule and issue the first credit immediately.

**Body (Joi-validated):**
```js
{
  userId: Joi.string().required(),
  amountPence: Joi.number().integer().min(1).required(),
  endDate: Joi.string().isoDate().optional(),
}
```

Steps:
1. Validate `endDate`, if present, is today or in the future (400 if in the past).
2. Fetch target user: `prisma.user.findFirst({ where: { id: userId, clubId: req.user.clubId, isArchived: false }, include: { club: { select: { emailEnabled: true } } } })` — return 404 if not found.
3. Create the `RecurringCredit` record.
4. Issue a `Credit` record: `{ userId, amount: amountPence, expiresAt: <last second of current month UTC> }`.
5. Update `recurringCredit.lastIssuedAt = new Date()`.
6. Call `audit()` with `action: 'recurringCredit.create'`.
7. If `targetUser.club.emailEnabled`: call `sendCreditAssignedEmail(email, firstName, amountPence, expiresAt)`.

**Response:** `201` with the rule in the same shape as the GET list (construct `userName` from the fetched user).

### `DELETE /api/booking/recurring-credits/:id`

Cancel a rule. Sets `isActive = false`. Already-issued credits are unaffected.

Returns `404` if the rule is not found or `clubId` does not match `req.user.clubId` (404 is intentional — does not reveal whether the rule exists in another club).

Call `audit()` with `action: 'recurringCredit.cancel'`.

**Response:** `200 { "ok": true }`

### Mount in `backend/server.js`

After the existing credits route mount, add:
```js
app.use('/api/booking/recurring-credits', require('./routes/booking/recurringCredits'));
```

## Cron Job (`backend/server.js`)

```
Schedule: 0 9 1 * *   (09:00 UTC on the 1st of every month)
```

Query: all `RecurringCredit` where `isActive: true`, with `include: { user: { select: { email, firstName, club: { select: { emailEnabled } } } } }`.

Filter in-process (or in the `where` clause):
- `endDate` is null OR `endDate >= start of today UTC`
- `lastIssuedAt` is null OR `lastIssuedAt < start of current month UTC`
- `user.isArchived === false` (skip archived users)

For each matching rule, wrapped in its own `try/catch` so one failure does not abort the rest:
1. Create a `Credit`: `{ userId, amount: amountPence, expiresAt: <last second of current month UTC> }`.
2. Update `lastIssuedAt = new Date()`.
3. If `user.club.emailEnabled`: send `sendCreditAssignedEmail`.

Log `Issued N recurring credit(s)` on completion. Log individual errors per failed rule without rethrowing.

**Known limitation:** Cancelled rules are not surfaced in the admin UI — history is available only in the audit log.

## Frontend (`frontend/src/pages/booking/admin/AdminCredits.js`)

Add a **Recurring credits** section below the existing one-time credit assignment form.

### Add recurring credit form (always visible)

Fields:
- **Member** — `<select>` populated from the same members list already loaded on this page
- **Monthly amount (£)** — `<input type="number" min="0.01" step="0.01">`. Convert to pence before submitting: `Math.round(parseFloat(amount) * 100)`.
- **End date (optional)** — `<input type="date">`. Submit as ISO string if set, omit the field if empty.

On save: `POST /api/booking/recurring-credits`, refresh the rules list, clear the form.

### Active rules table (shown only if rules exist)

Columns: Member | Monthly amount | End date | Last issued | Actions

- **End date**: show `Indefinite` if null, otherwise formatted date.
- **Last issued**: formatted date.
- **Cancel** button: `window.confirm` prompt, then `DELETE /api/booking/recurring-credits/:id`, then refresh list.

### `bookingApi.js` additions

```js
getRecurringCredits: () =>
  axios.get(`${API_URL}/booking/recurring-credits`, { headers: getHeaders() }),

createRecurringCredit: (data) =>
  axios.post(`${API_URL}/booking/recurring-credits`, data, { headers: getHeaders() }),

deleteRecurringCredit: (id) =>
  axios.delete(`${API_URL}/booking/recurring-credits/${id}`, { headers: getHeaders() }),
```

## Files

| Action | Path |
|--------|------|
| Create | `backend/routes/booking/recurringCredits.js` |
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/<timestamp>_add_recurring_credits/migration.sql` |
| Modify | `backend/server.js` |
| Create | `backend/__tests__/booking.recurringCredits.test.js` |
| Modify | `frontend/src/pages/booking/admin/AdminCredits.js` |
| Modify | `frontend/src/utils/bookingApi.js` |

## Testing

Backend (`booking.recurringCredits.test.js`):
- `POST` creates rule and issues a Credit expiring end of current month (UTC)
- `POST` with past `endDate` returns 400
- `POST` for archived user returns 404
- `POST` for user in different club returns 404
- `GET` returns active rules for the club with `userName` field
- `GET` excludes cancelled (`isActive: false`) rules
- `GET` by admin from different club returns empty array (club scoping)
- `DELETE` sets `isActive = false`; the associated Credit record is unchanged
- `DELETE` for rule in different club returns 404
- Cron helper (exported pure function): issues credit for active rule where `lastIssuedAt` is in the previous month
- Cron helper: skips rule where `endDate` is in the past
- Cron helper: skips rule where `lastIssuedAt` is already in the current month (idempotent)
- Cron helper: skips rule where user is archived
- `401` / `403` auth checks on all three routes

Manual frontend verification:
- Recurring credits section visible on Credits & Charges admin page
- Add form submits pence correctly (£10.00 → 1000 in DB)
- Saving shows rule in table immediately
- Cancel prompts confirmation, removes rule from table; existing credits unaffected
- End date field: leaving blank results in `endDate: null` in DB
