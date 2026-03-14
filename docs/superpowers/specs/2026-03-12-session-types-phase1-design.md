# Session Types — Phase 1: Session Type + DMT Approval

**Date:** 2026-03-12

## Overview

Phase 1 of a multi-phase overhaul to support competitive and recreational gymnasts sharing session capacity. This phase introduces two foundational concepts:

1. **Session type** — templates are either `STANDARD` (trampoline) or `DMT` (separate equipment). This is about equipment, not about whether gymnasts are competitive or recreational.
2. **DMT approval** — a coach-gated permission on each gymnast. DMT sessions can only be booked for gymnasts who have been approved.

Sessions remain a single capacity pool. The competitive/recreational distinction (standing slots, commitments, waitlists) is Phase 2.

## Database

### New enum

```prisma
enum SessionType {
  STANDARD
  DMT
}
```

### `SessionTemplate` — add after `pricePerGymnast`

```prisma
type  SessionType  @default(STANDARD)
```

All existing templates default to `STANDARD`. No data migration needed.

### `Gymnast` — add near `bgNumber` fields

```prisma
dmtApproved      Boolean   @default(false)
dmtApprovedAt    DateTime?
dmtApprovedById  String?
```

`dmtApprovedById` is a FK to `User` (the coach who approved). Add the reverse relation to `User`:

```prisma
// on User
dmtApprovals  Gymnast[]  @relation("DmtApprovedBy")
```

And on `Gymnast`:
```prisma
dmtApprovedBy  User?  @relation("DmtApprovedBy", fields: [dmtApprovedById], references: [id])
```

All existing gymnasts default to `dmtApproved = false`.

Migration: `npx prisma migrate dev --name add_session_type_and_dmt_approval`

## Backend

### `routes/booking/templates.js`

Add `type` to the Joi schema:
```js
type: Joi.string().valid('STANDARD', 'DMT').optional().default('STANDARD'),
```

Include `type` in the `data` object for both `POST /` (create) and `PUT /:id` (update).

### `routes/gymnasts.js`

**New endpoint:** `PATCH /api/gymnasts/:id/dmt-approval`

- Auth: `requireRole(['CLUB_ADMIN', 'COACH'])`
- Body: `{ approved: boolean }`
- If `approved = true`: set `dmtApproved = true`, `dmtApprovedAt = new Date()`, `dmtApprovedById = req.user.id`
- If `approved = false`: set `dmtApproved = false`, `dmtApprovedAt = null`, `dmtApprovedById = null`
- Audit logged: action `gymnast.dmt_approval`, metadata `{ approved, gymnastId }`
- Returns updated gymnast

This follows the same sub-path pattern as existing endpoints (`/:id/bg-number`, `/:id/consents`, etc.) — no special route ordering needed.

**Update `GET /bookable-for-me`:** Add `dmtApproved` to the `select` clause on both the self-gymnast query and the linked-children query. `SessionDetail.js` reads gymnasts from this endpoint to populate the selection list, so `dmtApproved` must be present for the frontend eligibility check to work.

### `routes/booking/bookings.js`

In `POST /`, `POST /batch`, and `POST /combined` — after fetching the session instance, add a DMT approval check when `instance.template.type === 'DMT'`. `POST /admin-add` is intentionally excluded — staff adding gymnasts to sessions directly do not need the DMT gate.

```js
if (instance.template.type === 'DMT') {
  const gymnasts = await prisma.gymnast.findMany({
    where: { id: { in: gymnastIds } },
    select: { id: true, firstName: true, dmtApproved: true },
  });
  const blocked = gymnasts.filter(g => !g.dmtApproved);
  if (blocked.length > 0) {
    return res.status(400).json({
      error: `The following gymnasts are not approved for DMT: ${blocked.map(g => g.firstName).join(', ')}`,
    });
  }
}
```

This check should be placed alongside the existing age and BG number validation. In `POST /batch` and `POST /combined`, the check runs inside the validation loop (same scope as the `instance` variable), so `pricePerGymnast` storage on `validatedItems`/`validatedSessions` is unaffected.

### `routes/booking/sessions.js`

Both endpoints manually construct response objects and do not pass through the full template — `type` must be added explicitly:

- `GET /` (list): add `type: instance.template.type` to the mapped object
- `GET /:instanceId` (detail): add `type: instance.template.type` to the response object

### `server.js`

No change needed — the gymnasts route is already mounted.

## Frontend

### `bookingApi.js`

Add one new method:
```js
approveDmt: (gymnastId, approved) =>
  axios.patch(`/api/gymnasts/${gymnastId}/dmt-approval`, { approved }, { headers: getHeaders() }),
```

### `SessionTemplates.js`

**`EMPTY_FORM`**: add `type: 'STANDARD'`

**`openEdit(t)`**: add `type: t.type`

**`buildPayload()`**: add `type: form.type`

**Form JSX**: add a select input for type, placed after the capacity/price fields:
```jsx
<label className="auth-label">Session type
  <select name="type" value={form.type} onChange={handleChange} className="auth-input">
    <option value="STANDARD">Standard</option>
    <option value="DMT">DMT</option>
  </select>
</label>
```

**Template list row**: show type alongside slots and price, e.g. `12 slots · £6.00 · DMT` (only show type label if DMT, since Standard is the default and doesn't need labelling).

### Gymnast admin view

The gymnast detail/edit view used by admins (identify the correct component from the codebase — likely in `frontend/src/pages/booking/admin/`) should include a DMT approval section:

- Shows current status: "DMT approved" (with approved-by name and date) or "Not approved"
- A toggle button: "Approve for DMT" / "Revoke DMT approval"
- Calls `bookingApi.approveDmt(gymnast.id, !gymnast.dmtApproved)`
- Only visible to admins/coaches

### `SessionDetail.js`

When the session's `type === 'DMT'`, check each gymnast the parent is selecting. If any gymnast does not have `dmtApproved = true` (available on the gymnast object returned by the session detail endpoint), show a message alongside that gymnast: "Not approved for DMT — speak to a coach." Disable selection for unapproved gymnasts.

The backend enforces this independently; the frontend message is UX only.

### `BookingCalendar.js`

DMT sessions get a visible "DMT" label in the day panel session list so parents can distinguish them from standard sessions. The label sits alongside the time display.

## What is NOT changing in this phase

- Session capacity model — still a single pool, no committed/reserved slots (Phase 2)
- Booking rules for `STANDARD` sessions — no change
- Competitive/recreational distinction — does not exist yet; all trampoline sessions are `STANDARD`
- Waitlist, commitments, register, attendance — all Phase 3+

## Success criteria

- Admin can set a session template to Standard or DMT
- Existing templates remain Standard by default
- Coach can approve or revoke DMT access for a gymnast
- Booking a DMT session for a non-approved gymnast returns a clear 400 error
- Frontend shows which gymnasts are ineligible for DMT before attempting to book
- DMT sessions are visually distinguishable in the booking calendar
