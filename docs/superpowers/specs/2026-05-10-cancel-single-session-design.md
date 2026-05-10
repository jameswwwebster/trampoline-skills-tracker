# Cancel a single session instance

Date: 2026-05-10

## Problem

Today there's no UI to cancel a single session instance. The closest options are
a closure period (range-based) or deactivating the whole template. Coaches can't
say "this Thursday is off but next week is fine."

## Design

### Backend

Wire up the existing-but-unused `PATCH /api/booking/sessions/:instanceId/cancel`
to mirror the closure cascade for the one instance:

- Accept `{ reason: string }`, required, max 500 chars.
- Set `instance.cancelledAt = now()`, `cancellationReason = reason`.
- For every CONFIRMED booking on that instance: set status CANCELLED, set
  `cancelledAt` on each active line, issue one credit per active line at
  `line.amount` (1-month expiry), delete `Attendance` rows for those gymnasts.
- For every `OFFERED` or `WAITING` waitlist entry: mark `EXPIRED`.
- Email each affected parent (one per booking) and each waitlist entrant,
  behind `club.emailEnabled`, with the reason and credit info.
- Audit `session.cancel` with `{ reason, affectedBookings, totalCreditsIssued, waitlistAffected }`.
- Restrict to `CLUB_ADMIN` and `COACH` (already enforced).

### Frontend

`SessionDetailPanel` (admin booking page):

- New red "Cancel session" button shown only when `!sessionDetail.cancelledAt`.
- Click opens a small inline form (or modal) with a reason textarea and
  Confirm/Cancel buttons. Confirm submits and refreshes the panel.
- New `bookingApi.cancelSession(instanceId, reason)` helper.

### Schema

`SessionInstance.cancellationReason` already exists (closures use it). No
migration required.

## Tests

Backend Jest tests:

1. Cancels a session, sets cancelledAt + reason, returns 200.
2. Cascades: bookings → CANCELLED, lines → cancelledAt, credits issued at
   line.amount, attendance rows removed, waitlist entries → EXPIRED.
3. 422/400 on missing reason; 403 for non-admin/coach; 404 on bad id; 400
   on already-cancelled instance.

## Out of scope

- Restore/uncancel.
- Scheduling cancellation in advance.
- Per-line cancellation from this flow (already exists separately).
