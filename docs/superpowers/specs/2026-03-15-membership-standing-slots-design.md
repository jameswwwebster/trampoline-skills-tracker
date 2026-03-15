# Membership & Standing Slots Rework — Design Spec

**Date:** 2026-03-15

## Goal

Add a `startDate` to standing slots (commitments) so that slots assigned during membership scheduling only become active from the membership's start date. Consolidate the membership management and standing slots sections in the admin member detail view into a single flat section with no expandable subsections.

## Architecture

Two independent concerns addressed together:

1. **Commitment start date** — a new nullable `startDate` field on `Commitment`. When null, the slot is active immediately (backwards compatible). When set to a future date, the slot is visible in the UI with a "Starts [date]" badge but does not count against session capacity until that date arrives.

2. **Admin UI consolidation** — the gymnast row in `AdminMembers.js` is flattened: the hidden "Details" toggle (which contained membership management) is removed, and membership controls plus standing slots flow as a single always-visible section below the gymnast's personal info.

## Files Changed

### Backend

- **`backend/prisma/schema.prisma`** — add `startDate DateTime?` to `Commitment`
- **`backend/prisma/migrations/<timestamp>_add_commitment_start_date/migration.sql`** — `ALTER TABLE "Commitment" ADD COLUMN "startDate" TIMESTAMP(3);`
- **`backend/routes/booking/commitments.js`** — accept optional `startDate` in `POST /` Joi schema; pass through to `prisma.commitment.create`
- **`backend/routes/booking/memberships.js`** — when creating commitments atomically during membership creation, set `startDate: membership.startDate` on each commitment
- **`backend/routes/booking/sessions.js`** — extend the ACTIVE commitment capacity count to exclude future-dated entries

### Frontend

- **`frontend/src/pages/booking/admin/AdminMembers.js`** — rework `GymnastRow`: remove `detailsOpen` state and the "Details" toggle; add flat "Membership & slots" section; show "Starts [date]" badge for future-dated slots; auto-load commitments on render; add date picker to the "Add slot" form
- **`frontend/src/pages/booking/admin/SessionTemplates.js`** — show "Starts [date]" badge for ACTIVE commitments with a future `startDate` in the per-template commitments panel
- **`frontend/src/pages/booking/admin/BookingAdmin.js`** — show "Starts [date]" badge for future-dated ACTIVE commitments in the session detail standing slots list

No schema changes beyond the new column. No migration required for existing data (null = active immediately).

## Detailed Behaviour

### Commitment `startDate` semantics

`startDate` is nullable. A null value is functionally equivalent to a `startDate` in the past — the slot is active immediately. This preserves backwards compatibility for all existing commitments.

When `startDate` is set:
- The commitment is created with `status: 'ACTIVE'`
- It is visible in all admin UIs with a "Starts [date]" badge
- It cannot be paused (no Pause button shown) until the start date arrives
- It does not count against session capacity until `startDate <= today`
- Removing it works normally at any time

### `sessions.js` — capacity query

Replace the existing ACTIVE commitment count:

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

Add `startDate` to the Joi schema:

```js
startDate: Joi.date().iso().allow(null).optional(),
```

Pass through to the create call:

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

### `memberships.js` — atomic commitment creation

When creating commitments during membership creation, pass the membership's `startDate`:

```js
await prisma.commitment.createMany({
  data: value.templateIds.map(templateId => ({
    gymnastId: value.gymnastId,
    templateId,
    createdById: req.user.id,
    startDate: new Date(value.startDate),
  })),
});
```

### `GymnastRow` UI rework (`AdminMembers.js`)

The `GymnastRow` component is restructured as follows:

**Header** — gymnast name + membership status badge (unchanged). The "Details" toggle button is removed entirely.

**Card body** — always-visible, no collapsible subsections:

1. **Info list** (unchanged) — DOB, coaching photo consent, social media consent, BG insurance. Unchanged from current implementation.

2. **Divider**

3. **"Membership & slots" section** — a single label covering both membership management and standing slots. No horizontal divider between the two sub-areas.

   - **Membership row:** membership detail text (e.g. "Active since 1 Jan 2026 · £85/mo") on the left; action buttons (Pause, Edit amount, Cancel) right-aligned. For a scheduled membership: "Scheduled — starts [date] · £X/mo" with only a Cancel button. If no membership: "No membership" text and a "+ Add membership" button.

   - **Slots list** (only shown when a membership exists): one row per commitment, each showing template name, time, status badge, and action buttons. Status badges: `Active`, `Paused`, `Waitlisted`, or `Starts [date]` for future-dated ACTIVE commitments. The Pause button is omitted for future-dated slots. The section has no title label of its own.

   - **"+ Add slot" button** (only shown when a membership exists): opens an inline form with a template picker and a date input (defaults to today). The date input has no minimum — the admin can backdate if needed.

**Commitments load automatically** on render (no manual "Load" / "Refresh" button). The `detailsOpen` state and the entire `GymnastMembership` collapsible are removed; membership management is rendered inline.

### "Starts [date]" badge in other views

**`SessionTemplates.js`** — in the per-template commitments panel, ACTIVE commitments with a future `startDate` appear in the Active group with a "Starts [date]" badge. No structural change to the Active / Paused / Waitlist grouping.

**`BookingAdmin.js`** — the session detail standing slots list already filters out `WAITLISTED` commitments. Future-dated ACTIVE commitments are shown with a "Starts [date]" badge (not hidden), so admins can see upcoming slot holders.

## Testing

Backend (add to `backend/__tests__/booking.commitments.test.js`):

- Creating a commitment with a `startDate` stores it and returns it in the response
- A session whose only ACTIVE commitment has a future `startDate` reports full available capacity (slot not counted)
- A session whose ACTIVE commitment has `startDate` = today or in the past reduces available capacity correctly
- A session with a null `startDate` ACTIVE commitment reduces available capacity correctly (backwards compat)

Backend (add to `backend/__tests__/booking.memberships.test.js`):

- Creating a membership with `templateIds` and a future `startDate` creates commitments with `startDate` matching the membership's `startDate`

Frontend — manual verification:

- Gymnast with active membership: membership row visible with right-aligned buttons; slots list visible below without a section title; no horizontal divider between membership row and slots
- Gymnast with scheduled membership: "Scheduled — starts [date]" row; slots show "Starts [date]" badge; no Pause button on those slots
- Gymnast with no membership: "No membership" row with "+ Add membership"; no slots section shown
- "Add slot" form: date picker defaults to today; slot appears with correct badge after save
- Future-dated slot: "Starts [date]" badge shown; no Pause button; Remove button present
- Session capacity in `BookingAdmin.js` is unaffected by future-dated commitments
- "Starts [date]" badge appears correctly in `SessionTemplates.js` commitments panel and `BookingAdmin.js` session detail
