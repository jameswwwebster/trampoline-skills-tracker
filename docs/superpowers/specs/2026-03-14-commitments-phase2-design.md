# Commitments — Phase 2: Standing Slots for Competitive Gymnasts

**Date:** 2026-03-14

## Overview

Phase 2 introduces *commitments* — standing slot reservations that link a gymnast to a session template. Commitments are admin-initiated, covered by the gymnast's monthly membership subscription, and are always considered booked unless the commitment is paused. Recreational gymnasts continue to book per-session as before. Both share the same capacity pool.

## Database

### New enum

```prisma
enum CommitmentStatus {
  ACTIVE
  PAUSED
}
```

### New model: `Commitment`

```prisma
model Commitment {
  id           String           @id @default(cuid())
  gymnast      Gymnast          @relation(fields: [gymnastId], references: [id])
  gymnastId    String
  template     SessionTemplate  @relation(fields: [templateId], references: [id])
  templateId   String
  status       CommitmentStatus @default(ACTIVE)
  pausedAt     DateTime?
  pausedById   String?
  pausedBy     User?            @relation("CommitmentPausedBy", fields: [pausedById], references: [id])
  createdById  String
  createdBy    User             @relation("CommitmentCreatedBy", fields: [createdById], references: [id])
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@unique([gymnastId, templateId])
}
```

Add reverse relations:
- `Gymnast`: `commitments Commitment[]`
- `SessionTemplate`: `commitments Commitment[]`
- `User`: `commitmentsCreated Commitment[] @relation("CommitmentCreatedBy")` and `commitmentsPaused Commitment[] @relation("CommitmentPausedBy")`

The unique constraint on `(gymnastId, templateId)` prevents duplicate commitments. A gymnast can commit to multiple templates (multiple rows). Pausing a commitment temporarily frees the slot; deleting it ends the commitment permanently.

Migration: `npx prisma migrate dev --name add_commitments`

## Backend

### New file: `routes/booking/commitments.js`

Mounted at `/api/commitments` in `server.js`. All endpoints require `requireRole(['CLUB_ADMIN', 'COACH'])`.

**`POST /`** — create a commitment.
- Body: `{ gymnastId, templateId }`
- Validate gymnast and template both belong to `req.user.clubId`
- Return 409 if commitment already exists (`@@unique` constraint)
- Audit log: action `commitment.create`, metadata `{ gymnastId, templateId }`
- Returns created commitment

**`DELETE /:id`** — remove a commitment.
- Validate commitment's gymnast belongs to caller's club
- Audit log: action `commitment.delete`, metadata `{ gymnastId, templateId }`

**`PATCH /:id/status`** — pause or resume.
- Body: `{ status: 'ACTIVE' | 'PAUSED' }`
- When pausing: set `pausedAt = new Date()`, `pausedById = req.user.id`
- When resuming: set `pausedAt = null`, `pausedById = null`
- Audit log: action `commitment.status`, metadata `{ status, gymnastId, templateId }`
- Returns updated commitment

**`GET /?templateId=xxx`** — list commitments for a template.
- Include `gymnast: { select: { id, firstName, lastName } }`
- Filter by `clubId` via gymnast relation

**`GET /gymnast/:gymnastId`** — list commitments for a gymnast.
- Include `template: { select: { id, name, dayOfWeek, startTime, endTime } }`
- Validate gymnast belongs to caller's club

### Capacity changes: `routes/booking/sessions.js`

Both `GET /` and `GET /:instanceId` currently compute booked count from bookings alone. Update to:

```js
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const bookedCount = bookings.length + activeCommitments;
```

Include `activeCommitments` count in the response object so the frontend can display the breakdown.

### Capacity and validation changes: `routes/booking/bookings.js`

In `POST /`, `POST /batch`, and `POST /combined` — update capacity check to account for active commitments:

```js
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const available = instance.template.capacity - existingBookings - activeCommitments;
```

Also add a pre-booking check: if a gymnast already has an `ACTIVE` commitment to the session's template, block the booking:

```js
const hasCommitment = await prisma.commitment.findFirst({
  where: { gymnastId, templateId: instance.templateId, status: 'ACTIVE' },
});
if (hasCommitment) {
  return res.status(400).json({
    error: `${gymnast.firstName} already has a standing slot for this session.`,
  });
}
```

`POST /admin-add` is excluded from the commitment block check (staff can override).

### `server.js`

Mount the new router:
```js
app.use('/api/commitments', require('./routes/booking/commitments'));
```

## Frontend

### `bookingApi.js`

```js
getCommitmentsForTemplate: (templateId) =>
  axios.get(`/api/commitments?templateId=${templateId}`, { headers: getHeaders() }),

getCommitmentsForGymnast: (gymnastId) =>
  axios.get(`/api/commitments/gymnast/${gymnastId}`, { headers: getHeaders() }),

createCommitment: (gymnastId, templateId) =>
  axios.post('/api/commitments', { gymnastId, templateId }, { headers: getHeaders() }),

updateCommitmentStatus: (commitmentId, status) =>
  axios.patch(`/api/commitments/${commitmentId}/status`, { status }, { headers: getHeaders() }),

deleteCommitment: (commitmentId) =>
  axios.delete(`/api/commitments/${commitmentId}`, { headers: getHeaders() }),
```

### Gymnast admin view (`AdminMembers.js`)

Add a "Commitments" section to the gymnast detail/edit panel, below the DMT approval section. Shows:
- List of current commitments: template name, day, time, status badge (Active/Paused)
- Per-commitment actions: Pause/Resume button, Delete button
- "Add commitment" control: a `<select>` populated from the club's session templates, with an Add button

Only visible to admins and coaches.

### Session admin view

When an admin views a session instance, show committed gymnasts in a "Standing slots" section above the regular bookings list. Each row shows name and inline Pause/Delete actions. The capacity header reads:

```
8/12 filled (5 bookings · 3 standing slots)
```

The `activeCommitments` count returned by `sessions.js` drives this display.

### `BookingCalendar.js` and `SessionDetail.js`

**Available slots** displayed to recreational bookers uses the corrected available count from the API (capacity minus bookings minus active commitments) — no frontend change needed if the API returns the correct number.

**Standing slot indicator:** When the viewing user has a gymnast with an `ACTIVE` commitment to a session's template, `SessionDetail.js` shows a "Standing slot — you're already booked" message instead of the booking controls for that gymnast.

To support this, `GET /api/sessions/:instanceId` should include a `committedGymnastIds` array in its response (the IDs of gymnasts with active commitments to that template). `SessionDetail.js` cross-references this against the user's gymnasts returned by `bookable-for-me`.

## What is NOT changing in this phase

- Payment model — membership covers committed sessions; no per-session charge logic changes
- Waitlist — not introduced here (Phase 3+)
- Register / attendance tracking — not introduced here (Phase 3+)
- Competitive/recreational gymnast distinction as a user-facing label — implicit in having a commitment, not a separate flag

## Success criteria

- Admin/coach can create, pause, resume, and delete commitments for a gymnast
- A gymnast can hold commitments to multiple templates simultaneously
- Session capacity correctly accounts for active commitments
- Recreational bookers cannot over-book a session that is full due to commitments
- A gymnast with an active commitment cannot double-book the same template
- Session admin view shows standing slots separately from per-instance bookings
- Gymnasts with a standing slot see a clear indicator in the booking calendar rather than a Book button
