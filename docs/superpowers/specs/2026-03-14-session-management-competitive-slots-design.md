# Session Management & Competitive Slots — Design Spec

## Goal

Rename "Session Templates" to "Session Management" and move it to a standalone page under the Sessions nav dropdown. Add a per-template competitive slots cap with a commitment waiting list, visible and manageable from that page.

## Architecture

Two independent concerns handled together:

1. **Competitive slots cap** — An optional `competitiveSlots Int?` field on `SessionTemplate` caps how many ACTIVE commitments a template can hold. A new `WAITLISTED` enum value on `CommitmentStatus` holds overflow entries. Enforcement is in the `POST /api/commitments` route. Promotion is manual, via the existing PATCH status endpoint extended to allow `WAITLISTED -> ACTIVE`.

2. **Session Management page** — `SessionTemplates.js` is extracted from `BookingAdmin.js` into its own route at `/booking/admin/session-management`. The Sessions nav dropdown gains a "Session Management" link. The page gains a per-template commitments panel showing Active, Paused, and Waitlist groups.

## Files Changed

### Backend

- **`backend/prisma/schema.prisma`** — add `competitiveSlots Int?` to `SessionTemplate`; add `WAITLISTED` to `CommitmentStatus`
- **`backend/prisma/migrations/<timestamp>_add_competitive_slots_and_waitlisted/migration.sql`** — `ALTER TABLE`, `ALTER TYPE ... ADD VALUE` (split into two migrations if needed — see migration notes)
- **`backend/routes/booking/commitments.js`** — enforce competitive slots cap on `POST /`; extend `PATCH /:id/status` to allow `WAITLISTED -> ACTIVE`
- **`backend/routes/booking/templates.js`** — add `competitiveSlots` to the Joi schema (optional integer, min 1)
- **`backend/__tests__/booking.commitments.test.js`** — new test file covering cap enforcement and waitlist promotion

### Frontend

- **`frontend/src/App.js`** (or wherever routes are defined) — add route `/booking/admin/session-management` pointing to `SessionTemplates`
- **`frontend/src/pages/booking/BookingLayout.js`** — add "Session Management" to Sessions dropdown; remove Sessions Templates collapsible from `BookingAdmin` (or just leave it — see note)
- **`frontend/src/pages/booking/admin/BookingAdmin.js`** — remove the embedded `SessionTemplates` collapsible section
- **`frontend/src/pages/booking/admin/SessionTemplates.js`** — rename heading to "Session Management"; add `competitiveSlots` field to template form; add per-template commitments panel
- **`frontend/src/utils/bookingApi.js`** — already has `getCommitmentsForTemplate`, `createCommitment`, `updateCommitmentStatus`, `deleteCommitment` — no new endpoints needed

## Detailed Behaviour

### Cap enforcement (`commitments.js POST /`)

When `POST /api/commitments` is called:

1. Fetch the template. If `template.competitiveSlots` is null, create as `ACTIVE` (existing behaviour).
2. If `competitiveSlots` is set, count commitments where `templateId = X AND status = 'ACTIVE'`.
3. If count < cap: create as `ACTIVE`.
4. If count >= cap: create as `WAITLISTED`.

The response body is the same shape either way. The caller can inspect `status` to know what happened. No 4xx is returned — being waitlisted is a valid outcome, not an error.

### Status transitions

Allowed transitions via `PATCH /:id/status`:

- `ACTIVE -> PAUSED`
- `PAUSED -> ACTIVE`
- `WAITLISTED -> ACTIVE` (promotion — admin manually promotes when a slot opens)

Disallowed: `ACTIVE -> WAITLISTED`, `PAUSED -> WAITLISTED`, `WAITLISTED -> PAUSED`. Return 422 for invalid transitions.

### Slot-available indicator

When the admin views the commitments panel for a template with a `competitiveSlots` cap:

- Show `{activeCount} / {competitiveSlots} competitive slots`
- If `activeCount < competitiveSlots` AND `waitlistedCount > 0`, show a highlighted indicator: "1 slot available — {waitlistedCount} on waitlist"
- The Promote button on each waitlist entry is enabled only when `activeCount < competitiveSlots`

Paused commitments are not counted against the cap and do not trigger slot-available indicators.

### Per-template commitments panel

Each template card on the Session Management page has an expandable commitments panel with three sections:

- **Active** — gymnast name, a Pause button, a Remove button
- **Paused** — gymnast name, an Activate button, a Remove button
- **Waitlist** — gymnast name, position number, a Promote button (greyed out if no slot available), a Remove button

If all three sections are empty, show "No commitments yet."

The panel is collapsed by default. Opening it triggers a fetch of `GET /api/commitments?templateId=X`.

Adding a gymnast to a template's commitments is done from `AdminMembers.js` (existing flow) — the Session Management page is read/manage only for existing commitments.

### Template form

The create/edit form gains an optional "Competitive slots" number input (integer, min 1). If left blank, no cap is enforced. This field can be edited at any time — reducing the cap below the current active count is allowed but the UI should warn: "There are currently {n} active commitments — reducing the cap will not remove anyone, but no new active commitments can be added until slots free up."

### Nav and routing

The Sessions dropdown in `BookingLayout.js` gains a third item: "Session Management" linking to `/booking/admin/session-management`. The embedded `SessionTemplates` collapsible inside `BookingAdmin.js` is removed.

## Migration Notes

`ALTER TYPE ... ADD VALUE` cannot run in the same transaction as any usage of the new enum value. This means two separate migration files are required:

1. Migration 1: `ALTER TABLE "session_templates" ADD COLUMN "competitiveSlots" INTEGER;` and `ALTER TYPE "CommitmentStatus" ADD VALUE 'WAITLISTED';`
2. Migration 2: Any index or constraint that references the new value (if needed — likely none required here)

In practice, Prisma's `migrate dev` will handle this correctly as long as the schema change is applied in one go and the migration file for the enum value addition does not reference `WAITLISTED` in the same file.

## Testing

- **`booking.commitments.test.js`** (new):
  - Creating a commitment when under cap creates as `ACTIVE`
  - Creating a commitment when at cap creates as `WAITLISTED`
  - Creating a commitment when no cap is set always creates as `ACTIVE`
  - `WAITLISTED -> ACTIVE` status transition succeeds
  - `ACTIVE -> WAITLISTED` status transition returns 422
  - `WAITLISTED -> PAUSED` status transition returns 422
- **`booking.templates.test.js`** — add a test that `competitiveSlots` is accepted and returned correctly
- **Frontend** — manual verification: competitive slots field in form, commitments panel groups, Promote button enabled/disabled state, slot-available indicator
