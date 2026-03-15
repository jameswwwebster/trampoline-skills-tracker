# Membership & Standing Slots Rework — Design Spec

**Date:** 2026-03-15

## Goal

Add a `startDate` to standing slots (commitments) so that slots assigned during membership scheduling only become active from the membership's start date. Consolidate the membership management and standing slots sections in the admin member detail view into a single flat section with no expandable subsections.

## Architecture

Two independent concerns addressed together:

1. **Commitment start date** — a new nullable `startDate` field on `Commitment`. When null, the slot is active immediately (backwards compatible). When set to a future date, the slot is visible in the UI with a "Starts [date]" badge but does not count against session capacity until that date arrives.

2. **Admin UI consolidation** — the gymnast row in `AdminMembers.js` is flattened: the hidden "Details" toggle (which contained membership management, emergency contacts, health notes, and a Remove gymnast button) is removed entirely. All content moves into the always-visible card body.

## Files Changed

### Backend

- **`backend/prisma/schema.prisma`** — add `startDate DateTime?` to `Commitment`
- **`backend/prisma/migrations/<timestamp>_add_commitment_start_date/migration.sql`** — `ALTER TABLE "Commitment" ADD COLUMN "startDate" TIMESTAMP(3);`
- **`backend/routes/booking/commitments.js`** — accept optional `startDate` in `POST /` Joi schema; pass through to `prisma.commitment.create`; extend the `SCHEDULED` membership guard to also allow `SCHEDULED` status; update the competitive-slots cap count to exclude future-dated ACTIVE commitments in both `POST /` and `PATCH /:id/status`
- **`backend/routes/booking/memberships.js`** — when creating commitments atomically inside `prisma.$transaction`, set `startDate: new Date(value.startDate)` on each `tx.commitment.create` call
- **`backend/routes/booking/sessions.js`** — extend both ACTIVE commitment capacity counts (in `GET /` and `GET /:instanceId`) to exclude future-dated entries

### Frontend

- **`frontend/src/utils/bookingApi.js`** — update `createCommitment` signature to accept a data object `{ gymnastId, templateId, startDate }` instead of two positional parameters
- **`frontend/src/pages/booking/admin/AdminMembers.js`** — rework `GymnastRow`: remove `detailsOpen` state and "Details" toggle; move emergency contacts, health notes, and Remove gymnast button into the always-visible card body; add flat "Membership & slots" section; show "Starts [date]" badge for future-dated slots; auto-load commitments on render; add date picker to the "Add slot" form; date defaults to today when membership is active, or to the membership's `startDate` when the membership is `SCHEDULED`
- **`frontend/src/pages/booking/admin/SessionTemplates.js`** — show "Starts [date]" badge for ACTIVE commitments with a future `startDate` in the per-template commitments panel
- **`frontend/src/pages/booking/admin/BookingAdmin.js`** — show "Starts [date]" badge for future-dated ACTIVE commitments in the session detail standing slots list

No schema changes beyond the new column. No migration required for existing data (null = active immediately).

## Detailed Behaviour

### Commitment `startDate` semantics

`startDate` is nullable. A null value is functionally equivalent to a `startDate` in the past — the slot is active immediately. This preserves backwards compatibility for all existing commitments.

When `startDate` is set to a future date:
- The commitment is created with `status: 'ACTIVE'`
- It is visible in all admin UIs with a "Starts [date]" badge, formatted as `d MMM YYYY` using `toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })` (e.g. "Starts 1 Apr 2026")
- The Pause button is hidden in the UI — this is a UI-only guard; the API does not enforce it
- It does not count against session capacity or competitive slot caps until `startDate <= today`
- Removing it works normally at any time

### `sessions.js` — capacity queries

Both the `GET /` (month view) and `GET /:instanceId` (single session) handlers contain an identical `prisma.commitment.count` call. Both must be updated:

```js
const today = new Date();
const activeCommitments = await prisma.commitment.count({
  where: {
    templateId: instance.templateId,
    status: 'ACTIVE',
    OR: [{ startDate: null }, { startDate: { lte: today } }],
  },
});
```

### `commitments.js` — POST /

**Membership guard:** The existing guard rejects requests unless the gymnast has an `ACTIVE` membership. Extend it to also allow `SCHEDULED`:

```js
const membership = await prisma.membership.findFirst({
  where: { gymnastId: value.gymnastId, status: { in: ['ACTIVE', 'SCHEDULED'] } },
});
if (!membership) {
  return res.status(422).json({ error: 'Gymnast does not have an active or scheduled membership' });
}
```

**`startDate` in Joi schema:**

```js
startDate: Joi.date().iso().allow(null).optional(),
```

**`startDate` in create call:**

```js
await prisma.commitment.create({
  data: {
    gymnastId: value.gymnastId,
    templateId: value.templateId,
    createdById: req.user.id,
    ...(value.startDate ? { startDate: new Date(value.startDate) } : {}),
  },
});
```

**Competitive slots cap count:** The existing `activeCount` query used for cap enforcement in `POST /` must exclude future-dated entries:

```js
const today = new Date();
const activeCount = await prisma.commitment.count({
  where: {
    templateId: value.templateId,
    status: 'ACTIVE',
    OR: [{ startDate: null }, { startDate: { lte: today } }],
  },
});
```

Apply the same filter to the equivalent `activeCount` query in `PATCH /:id/status` (used when checking whether a slot promotion or re-activation is possible).

### `memberships.js` — atomic commitment creation

Commitments are created inside a `prisma.$transaction` using `tx.commitment.create`. Add `startDate` to each create call inside the existing `for...of` loop, using the transaction variable `tx`:

```js
await tx.commitment.create({
  data: {
    gymnastId: value.gymnastId,
    templateId,
    createdById: req.user.id,
    startDate: new Date(value.startDate),
  },
});
```

### `bookingApi.js` — createCommitment

Change the existing two-argument signature to accept a data object:

```js
// Before:
createCommitment: (gymnastId, templateId) =>
  axios.post(`${API_URL}/commitments`, { gymnastId, templateId }, { headers: getHeaders() }),

// After:
createCommitment: (data) =>
  axios.post(`${API_URL}/commitments`, data, { headers: getHeaders() }),
```

Update all call sites in `AdminMembers.js` accordingly.

### `GymnastRow` UI rework (`AdminMembers.js`)

The `GymnastRow` component is restructured as follows. The `detailsOpen` state and its associated toggle button are removed entirely.

**Header** — gymnast name + membership status badge (unchanged).

**Card body** — always-visible, no collapsible subsections:

1. **Info list** — DOB, coaching photo consent, social media consent, BG insurance (unchanged), then:
   - **Health notes** — previously in the hidden section; moved into the info list as a read-only row. Display "None" (muted) if `healthNotes === 'none'`, the note text if present, or "Not recorded" (italic, muted) if absent.
   - **Emergency contact** (for `isSelf` gymnasts only) — name, relationship, and phone; previously in the hidden section; moved into the info list as a read-only row.

2. **Divider**

3. **"Membership & slots" section** — a single section label covering both membership management and standing slots.

   - **Membership row:** membership detail text left-aligned (e.g. "Active since 1 Jan 2026 · £85/mo"); action buttons (Pause, Edit amount, Cancel) right-aligned. For a scheduled membership: "Scheduled — starts [date] · £X/mo" with only a Cancel button. If no membership: "No membership" text with a "+ Add membership" button.

   - **Slots list** (only shown when a membership exists — `ACTIVE` or `SCHEDULED`): one row per commitment showing template name, time, status badge, and action buttons. Status badges: `Active`, `Paused`, `Waitlisted`, or `Starts [date]` for future-dated ACTIVE commitments. The Pause button is omitted for future-dated slots. No section title of its own. No horizontal divider between the membership row and the slots list.

   - **"+ Add slot" button** (only shown when a membership exists): opens an inline form with a template picker and a date input. Default date: today if the membership is `ACTIVE`; the membership's `startDate` if the membership is `SCHEDULED`. The date input has no minimum.

4. **Remove gymnast button** — previously in the hidden section; moved below the membership & slots section as a standalone destructive button (visible only when the gymnast is not `isSelf`).

**Commitments load automatically** on render. The existing "Load / Refresh" button is removed.

### "Starts [date]" badge in other views

**`SessionTemplates.js`** — ACTIVE commitments with a future `startDate` appear in the Active group with a "Starts [date]" badge. No structural change to the Active / Paused / Waitlist grouping.

**`BookingAdmin.js`** — the session detail standing slots list already filters out `WAITLISTED` commitments. Future-dated ACTIVE commitments are shown with a "Starts [date]" badge appended inline to the gymnast name row. They are not hidden.

## Testing

Backend (add to `backend/__tests__/booking.commitments.test.js`):

- Creating a commitment with a `startDate` stores it and returns it in the response
- A session whose only ACTIVE commitment has a future `startDate` reports full available capacity (slot not counted) — test both `GET /` and `GET /:instanceId`
- A session whose ACTIVE commitment has `startDate` = today or in the past reduces available capacity correctly
- A session with a null `startDate` ACTIVE commitment reduces available capacity correctly (backwards compat)
- `POST /` with a `SCHEDULED` membership succeeds (returns 201); with no membership returns 422
- Future-dated ACTIVE commitments do not count towards the competitive slots cap in `POST /`

Backend (add to `backend/__tests__/booking.memberships.test.js`):

- Creating a membership with `templateIds` and a future `startDate` creates commitments with `startDate` matching the membership's `startDate`

Frontend — manual verification:

- Gymnast with active membership: membership row visible with right-aligned buttons; slots list below without a section title; no horizontal divider between them
- Gymnast with scheduled membership: "Scheduled — starts [date]" row; slots show "Starts [date]" badge; no Pause button
- Gymnast with no membership: "No membership" row with "+ Add membership"; no slots section shown
- Health notes and emergency contact visible in the info list (no expand needed)
- Remove gymnast button visible below the membership & slots section
- "Add slot" form: date defaults to today for active membership, to membership start date for scheduled membership
- Future-dated slot: "Starts [date]" badge shown; no Pause button; Remove button present
- Session capacity unaffected by future-dated commitments
- "Starts [date]" badge appears in `SessionTemplates.js` commitments panel and `BookingAdmin.js` session detail
