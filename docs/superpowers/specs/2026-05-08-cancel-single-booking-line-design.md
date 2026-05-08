# Cancel a Single Gymnast from a Multi-Gymnast Booking

**Date:** 2026-05-08

## Goal

A `Booking` covers one session × one user × N gymnasts (one `BookingLine`
per gymnast). Today the only cancel path is "cancel the whole booking",
which kicks every gymnast off. Users want to drop a single gymnast from
a multi-gymnast booking without affecting the others.

The same gap exists on the admin side: `BookingAdmin.SessionDetailPanel`'s
per-attendee "Remove" button silently cancels the whole booking, removing
gymnasts the admin didn't intend to touch.

## Decisions captured from brainstorm

- Per-line cancellation only — multi-session carts already create
  separate `Booking` rows, each with its own cancel button.
- Soft-delete via `BookingLine.cancelledAt` so audit trail is preserved.
- Same-day rule applies per line (no credit if cancelled on the day).
- If the last active line on a `Booking` is cancelled, the `Booking`
  itself transitions to `CANCELLED` in the same transaction.
- Capacity counts (booking flow, waitlist join, available slots) filter
  out cancelled lines — ~4 call sites.
- The existing `/cancel` endpoint stays as the "cancel everything" path
  (one-click). The new endpoint handles a single line.

## Schema

```prisma
model BookingLine {
  id          String   @id @default(cuid())
  bookingId   String
  gymnastId   String
  amount      Int
  cancelledAt DateTime?
  createdAt   DateTime @default(now())
  ...
}
```

One migration adds the column. No backfill needed — NULL means active
(matches existing rows).

## Backend

### New route

```
POST /api/booking/bookings/:bookingId/lines/:lineId/cancel
```

Body: optional `{ issueCredit: boolean }` (admin override only;
ignored for non-admin callers).

Steps inside a Prisma transaction:

1. Resolve booking + line, enforce ownership / admin auth.
2. Reject if line already cancelled or booking already cancelled.
3. Decide credit issuance:
   - Admin caller may pass `issueCredit` explicitly.
   - Otherwise: `false` if session is today, `true` otherwise.
4. `bookingLine.update({ cancelledAt: now })`.
5. If `issueCredit`: create one `credit` row tied to this booking with
   `amount = line.amount`, `expiresAt = now + 1 month`.
6. Count remaining non-cancelled lines on the booking. If zero, set
   `booking.status = 'CANCELLED'`.
7. Audit log: `booking.line.cancel` with metadata `{ bookingId,
   lineId, gymnastId, gymnastName, issueCredit, lastLine: bool }`.
8. Return `{ creditsIssued, bookingCancelled, message }`.

Outside the transaction (non-critical): `processWaitlist(sessionInstanceId)`
to offer the freed slot.

### Capacity counts updated to ignore cancelled lines

Call sites:

1. `routes/booking/bookings.js` — `getAvailableSlots()` plus the
   inline counts in POST `/bookings`, batch checkout, etc.
2. `routes/booking/sessions.js` — same per-instance count used by the
   calendar.
3. `routes/booking/waitlist.js` — `bookedCount` in the join check.
4. `services/waitlistService.js` — `processWaitlist()` "still full"
   check.

All filter `lines.length` to `lines.filter(l => !l.cancelledAt).length`,
or use a Prisma `lines: { where: { cancelledAt: null } }` include.

### Existing `/cancel` endpoint

Unchanged. Sets `Booking.status = 'CANCELLED'` and creates one credit
per active line in one transaction. Cancelled lines are not credited
again on a subsequent whole-booking cancel.

## Frontend

### My Bookings (parent-facing)

Booking card with **one active line** keeps the current "Cancel booking"
button.

Booking card with **two or more active lines** lists each gymnast on
its own row with a per-row "Cancel" button. Confirm dialog says
"Cancel <Gymnast> from this session?"; same-day no-credit warning
appears in the dialog when relevant. After cancelling the last
remaining gymnast, the card disappears (booking is now CANCELLED).

### Admin (`BookingAdmin.SessionDetailPanel`)

Replace the existing `bookingApi.cancelBooking(bookingId, { issueCredit })`
in `handleRemove` with `bookingApi.cancelBookingLine(bookingId, lineId,
{ issueCredit })`. The "Remove" button now removes that gymnast only;
other gymnasts on the same booking stay confirmed. UI copy unchanged.

### `bookingApi.js`

Add `cancelBookingLine(bookingId, lineId, options = {})` matching the
existing `cancelBooking` shape.

## Tests

Extend `backend/__tests__/booking.cancel.test.js` (or add a new file
if cleaner) with:

1. Cancelling one of two lines: line gets `cancelledAt`; booking
   stays `CONFIRMED`; other line untouched; one credit issued at the
   correct amount.
2. Cancelling the last remaining active line: line gets `cancelledAt`;
   booking transitions to `CANCELLED`; credit issued.
3. Cancelling on the day of the session: no credit issued; line
   marked cancelled.
4. Capacity reflects the freed slot — `getAvailableSlots()` returns
   the right number after one line is cancelled on a full session.
5. Cancelling a line on an already-cancelled booking returns 400.
6. Cancelling an already-cancelled line returns 400.
7. Non-owner non-admin returns 403.
8. Subsequent whole-booking cancel only credits the remaining
   non-cancelled lines (no double-credit on the previously-cancelled
   line).

## Out of scope

- Refunding to the original payment method. Existing flow uses club
  credits; this PR doesn't change that.
- Allowing admins to "uncancel" a single line. Existing flow has no
  uncancel either; matches.
- Per-session cancellation in a multi-session cart — already supported
  (each session is its own `Booking`).
