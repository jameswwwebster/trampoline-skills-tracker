# Commitments — Phase 2: Standing Slots for Competitive Gymnasts

**Date:** 2026-03-14

## Overview

Phase 2 introduces *commitments* — standing slot reservations that link a gymnast to a session template. A commitment covers **every future instance generated from that template** — it is a perpetual reservation, not a per-date booking. Commitments are admin-initiated, covered by the gymnast's monthly membership subscription, and are always considered booked unless the commitment is paused. Recreational gymnasts continue to book per-session as before. Both share the same capacity pool.

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
  gymnast      Gymnast          @relation(fields: [gymnastId], references: [id], onDelete: Cascade)
  gymnastId    String
  template     SessionTemplate  @relation(fields: [templateId], references: [id], onDelete: Restrict)
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

**Deletion behaviour:**
- `gymnast onDelete: Cascade` — when a gymnast is deleted, their commitments are automatically removed.
- `template onDelete: Restrict` — a session template with active commitments cannot be deleted. The admin must remove or reassign all commitments first; the UI should surface a clear error if a delete is attempted on a template with commitments.

Add reverse relations:
- `Gymnast`: `commitments Commitment[]`
- `SessionTemplate`: `commitments Commitment[]`
- `User`: `commitmentsCreated Commitment[] @relation("CommitmentCreatedBy")` and `commitmentsPaused Commitment[] @relation("CommitmentPausedBy")`

The unique constraint on `(gymnastId, templateId)` prevents duplicate commitments. A gymnast can commit to multiple templates (multiple rows). Pausing a commitment temporarily frees the slot; deleting it ends the commitment permanently.

Migration: `npx prisma migrate dev --name add_commitments`

## Backend

### New file: `routes/booking/commitments.js`

Mounted at `/api/commitments` in `server.js`.

**Admin/coach endpoints** — all require `requireRole(['CLUB_ADMIN', 'COACH'])`:

**`POST /`** — create a commitment.
- Body: `{ gymnastId, templateId }`
- Validate gymnast and template both belong to `req.user.clubId`
- Return 409 if commitment already exists (`@@unique` constraint)
- Audit log: `audit(req, 'commitment.create', { gymnastId, templateId }, 'Commitment', commitment.id)`
- Returns created commitment

**`DELETE /:id`** — remove a commitment.
- Validate commitment's gymnast belongs to caller's club
- Audit log: `audit(req, 'commitment.delete', { gymnastId, templateId }, 'Commitment', id)`
- Returns `{ success: true }`

**`PATCH /:id/status`** — pause or resume.
- Body: `{ status: 'ACTIVE' | 'PAUSED' }`
- When pausing: set `pausedAt = new Date()`, `pausedById = req.user.id`
- When resuming: set `pausedAt = null`, `pausedById = null`
- Audit log: `audit(req, 'commitment.status', { status, gymnastId, templateId }, 'Commitment', id)`
- Returns updated commitment

**`GET /?templateId=xxx`** — list commitments for a template.
- `templateId` is required; return 400 if absent
- Include `gymnast: { select: { id, firstName, lastName } }`
- Filter by `clubId` via gymnast relation

**`GET /gymnast/:gymnastId`** — list commitments for a gymnast.
- Include `template: { select: { id, dayOfWeek, startTime, endTime } }` (templates have no `name` field — display is derived from day + time)
- Validate gymnast belongs to caller's club

**Parent/gymnast endpoint** — requires `auth` only (no role restriction). **This route must be declared before `GET /:id` in the router file** to prevent Express matching `mine` as an `:id` parameter:

**`GET /mine?templateId=xxx`** — returns commitment status for the requesting user's own gymnasts for a given template.
- `templateId` is required; return 400 if absent
- Queries gymnasts where `userId === req.user.id`, then finds commitments for those gymnasts on the given template
- Returns array of `{ gymnastId, status }` — only gymnasts with an existing commitment are included
- Used by `SessionDetail.js` to show the standing-slot indicator to parents/gymnasts without exposing other families' data

### Capacity changes: `routes/booking/sessions.js`

Both `GET /` and `GET /:instanceId` currently compute booked count from bookings alone. Update to:

```js
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const bookedCount = bookings.length + activeCommitments;
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
```

Include `activeCommitments` count in the response object so the frontend can display the breakdown. Remove `committedGymnastIds` from the session response — the standing-slot indicator for parents is handled via `GET /mine` instead.

### Capacity and validation changes: `routes/booking/bookings.js`

In `POST /`, `POST /batch`, and `POST /combined` — update capacity check to account for active commitments:

```js
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
const available = capacity - existingBookings - activeCommitments;
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

`POST /admin-add` bypasses the commitment block check only. The existing capacity check behaviour in `admin-add` is unchanged.

### Membership creation: `routes/booking/memberships.js`

`POST /api/booking/memberships` gains an optional `templateIds` field:

```js
templateIds: Joi.array().items(Joi.string()).optional().default([]),
```

After the membership record is created, if `templateIds` is non-empty, create a `Commitment` for each template inside the same Prisma transaction:

```js
await prisma.$transaction(async (tx) => {
  const membership = await tx.membership.create({ ... });
  for (const templateId of value.templateIds) {
    await tx.commitment.create({
      data: { gymnastId: value.gymnastId, templateId, createdById: req.user.id },
    });
  }
  return membership;
});
```

Validate that each `templateId` belongs to `req.user.clubId` before entering the transaction — return 400 if any template is not found or belongs to a different club.

If a commitment already exists for any `(gymnastId, templateId)` pair, return 409 before creating the membership (fail fast, not mid-transaction).

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

getMyCommitmentsForTemplate: (templateId) =>
  axios.get(`/api/commitments/mine?templateId=${templateId}`, { headers: getHeaders() }),

createCommitment: (gymnastId, templateId) =>
  axios.post('/api/commitments', { gymnastId, templateId }, { headers: getHeaders() }),

updateCommitmentStatus: (commitmentId, status) =>
  axios.patch(`/api/commitments/${commitmentId}/status`, { status }, { headers: getHeaders() }),

deleteCommitment: (commitmentId) =>
  axios.delete(`/api/commitments/${commitmentId}`, { headers: getHeaders() }),
```

### Membership creation form (`AdminMemberships.js`)

Add a "Standing slots" multi-select below the start date field. Populated from the club's session templates (same source as the template dropdown in the gymnast commitments section). The admin must select at least one template — frontend validation blocks submission with zero templates selected.

On submit, `templateIds` is included in the `createMembership` request body alongside `gymnastId`, `monthlyAmount`, and `startDate`.

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

**Standing slot indicator:** When `SessionDetail.js` loads a session, it calls `bookingApi.getMyCommitmentsForTemplate(session.templateId)`. For each of the user's gymnasts:
- If the gymnast has status `ACTIVE` → show "Standing slot — you're already booked" and hide booking controls
- If the gymnast has status `PAUSED` → show normal booking controls (slot is free; they may book as a recreational gymnast)
- If the gymnast has no commitment → show normal booking controls

## What is NOT changing in this phase

- Payment model — membership covers committed sessions; no per-session charge logic changes
- Waitlist — not introduced here (Phase 3+)
- Register / attendance tracking — not introduced here (Phase 3+)
- Competitive/recreational gymnast distinction as a user-facing label — implicit in having a commitment, not a separate flag

## Success criteria

- Creating a membership requires selecting at least one session template; commitments are created atomically with the membership
- Admin/coach can create, pause, resume, and delete commitments for a gymnast
- A gymnast can hold commitments to multiple templates simultaneously
- Session capacity correctly accounts for active commitments; paused commitments do not count against capacity
- Recreational bookers cannot over-book a session that is full due to commitments
- A gymnast with an active commitment cannot double-book the same template
- A gymnast with a paused commitment sees normal booking controls and can book as a recreational gymnast
- Session admin view shows standing slots separately from per-instance bookings
- Gymnasts with a standing slot see a clear indicator in the booking calendar rather than a Book button
- A session template with active commitments cannot be deleted
