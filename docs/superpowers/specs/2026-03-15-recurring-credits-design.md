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

  @@map("recurring_credits")
}
```

Back-relations on `Club` and `User`:
```prisma
// Club
recurringCredits  RecurringCredit[]

// User
recurringCredits         RecurringCredit[]
createdRecurringCredits  RecurringCredit[]  @relation("RecurringCreditCreatedBy")
```

**Credit issuance:** uses the existing `Credit` model unchanged — `prisma.credit.create({ data: { userId, amount, expiresAt } })`. `expiresAt` is set to 23:59:59 on the last day of the month in which the credit is issued.

## Backend Routes (`backend/routes/booking/recurringCredits.js`)

All routes require `CLUB_ADMIN` or `COACH`. All validate that the target user belongs to `req.user.clubId`.

### `GET /api/booking/recurring-credits`

Returns all active (`isActive: true`) recurring credit rules for the club, ordered by `createdAt` descending.

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

### `POST /api/booking/recurring-credits`

Create a rule and issue the first credit immediately.

**Body (Joi-validated):**
```json
{ "userId": "string (required)", "amountPence": "integer min 1 (required)", "endDate": "ISO date string (optional)" }
```

1. Validate `endDate`, if present, is today or in the future (400 if past).
2. Create the `RecurringCredit` record.
3. Issue a `Credit` record: `amount = amountPence`, `expiresAt = last second of current month`.
4. Update `recurringCredit.lastIssuedAt = now()`.
5. Call `audit()` with `action: 'recurringCredit.create'`.
6. Send `sendCreditAssignedEmail` if club `emailEnabled`.

**Response:** `201` with the created rule (same shape as GET list item).

### `DELETE /api/booking/recurring-credits/:id`

Cancel a rule. Sets `isActive = false`. Already-issued credits are unaffected.

- Returns `404` if rule not found or belongs to different club.
- Call `audit()` with `action: 'recurringCredit.cancel'`.

**Response:** `200 { "ok": true }`

## Cron Job (`backend/server.js`)

```
Schedule: 0 9 1 * *   (09:00 on the 1st of every month)
```

Finds all `RecurringCredit` where:
- `isActive: true`
- `clubId` matches (iterate all clubs)
- `endDate` is null OR `endDate >= start of today`
- `lastIssuedAt` is null OR `lastIssuedAt < start of current month`

For each matching rule:
1. Create a `Credit`: `amount = amountPence`, `expiresAt = last second of current month`.
2. Update `lastIssuedAt = now()`.
3. Send `sendCreditAssignedEmail` if club `emailEnabled`.

Log `Issued N recurring credit(s)` on completion.

## Frontend

### `AdminCreditsCharges.js` (existing credits & charges page)

Add a **Recurring credits** section below the existing one-time credit assignment form.

**Recurring credits section contains:**

1. **Active rules table** (shown if any rules exist):

| Member | Monthly amount | End date | Last issued | Actions |
|--------|---------------|----------|-------------|---------|
| Chris Owens | £10.00 | Indefinite | 15 Mar 2026 | Cancel |

   The Cancel button prompts a `window.confirm` before calling `DELETE`.

2. **Add recurring credit form** (inline, always visible):
   - Member picker: same `<select>` of club members used in the existing credit form
   - Monthly amount (£): number input, min 0.01, step 0.01
   - End date (optional): date input
   - Save button

On save: calls `POST /api/booking/recurring-credits`, refreshes the rules list, and clears the form.

### `bookingApi.js`

Add three methods:
```js
getRecurringCredits: ()
createRecurringCredit: (data)
deleteRecurringCredit: (id)
```

## Testing

Backend:
- `POST` creates rule and issues a Credit expiring end of current month
- `POST` with `endDate` in the past returns 400
- `GET` returns active rules for the club; excludes cancelled rules
- `GET` by user from a different club returns no results (club scoping)
- `DELETE` sets `isActive = false`; Credit records are unchanged
- Cron logic: issues credit for active rule where `lastIssuedAt` is previous month
- Cron logic: skips rule where `endDate` is in the past
- Cron logic: skips rule where `lastIssuedAt` is already in the current month (idempotent)
- `401` / `403` auth checks on all routes

Manual frontend verification:
- Recurring credits section visible on Credits & Charges admin page
- Add form issues credit immediately and shows rule in table
- Cancel removes rule from table; existing credits unaffected
- End date field optional; leaving blank results in `endDate: null`
