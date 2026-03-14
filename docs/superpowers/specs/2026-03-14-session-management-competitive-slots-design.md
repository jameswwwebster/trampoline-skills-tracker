# Session Management & Competitive Slots — Design Spec

## Goal

Rename "Session Templates" to "Session Management" and move it to a standalone page under the Sessions nav dropdown. Add a per-template competitive slots cap with a commitment waiting list, visible and manageable from that page.

## Architecture

Two independent concerns handled together:

1. **Competitive slots cap** — An optional `competitiveSlots Int?` field on `SessionTemplate` caps how many ACTIVE commitments a template can hold. A new `WAITLISTED` enum value on `CommitmentStatus` holds overflow entries. Enforcement is in the `POST /api/commitments` route. Promotion is manual, via the existing PATCH status endpoint extended to allow `WAITLISTED -> ACTIVE`.

2. **Session Management page** — `SessionTemplates.js` is promoted from an embedded collapsible in `BookingAdmin.js` to its own route at `/booking/admin/session-management`. The Sessions nav dropdown gains a "Session Management" link. The page gains a per-template commitments panel showing Active, Paused, and Waitlist groups.

## Files Changed

### Backend

- **`backend/prisma/schema.prisma`** — add `competitiveSlots Int?` to `SessionTemplate`; add `WAITLISTED` to `CommitmentStatus`
- **`backend/prisma/migrations/<timestamp>_add_competitive_slots_and_waitlisted/migration.sql`** — single migration file containing both the `ALTER TABLE` and `ALTER TYPE ... ADD VALUE` statements (no split needed — see migration notes)
- **`backend/routes/booking/commitments.js`** — enforce competitive slots cap on `POST /`; extend `PATCH /:id/status` to allow `WAITLISTED -> ACTIVE`; check cap on `PAUSED -> ACTIVE` re-activation
- **`backend/routes/booking/templates.js`** — add `competitiveSlots` to the Joi schema (optional integer, min 1)
- **`backend/__tests__/booking.commitments.test.js`** — existing file; add new `describe` blocks for cap enforcement, waitlist creation, and promotion

### Frontend

- **`frontend/src/App.js`** (or wherever routes are defined) — add route `/booking/admin/session-management` pointing to `SessionTemplates`
- **`frontend/src/pages/booking/BookingLayout.js`** — add "Session Management" to Sessions dropdown
- **`frontend/src/pages/booking/admin/BookingAdmin.js`** — remove the embedded `SessionTemplates` collapsible section; update the session detail standing slots panel to filter out `WAITLISTED` commitments
- **`frontend/src/pages/booking/admin/SessionTemplates.js`** — rename heading to "Session Management"; add `competitiveSlots` field to template form; add per-template commitments panel
- **`frontend/src/utils/bookingApi.js`** — already has `getCommitmentsForTemplate`, `createCommitment`, `updateCommitmentStatus`, `deleteCommitment` — no new endpoints needed

## Detailed Behaviour

### Cap enforcement (`commitments.js POST /`)

When `POST /api/commitments` is called:

1. Fetch the template. If `template.competitiveSlots` is null, create as `ACTIVE` (existing behaviour, audit action `commitment.create`).
2. If `competitiveSlots` is set, count commitments where `templateId = X AND status = 'ACTIVE'`.
3. If count < cap: create as `ACTIVE` (audit action `commitment.create`).
4. If count >= cap: create as `WAITLISTED` (audit action `commitment.waitlisted`).

The response body is the same shape either way. The caller can inspect `status` to know what happened. No 4xx is returned — being waitlisted is a valid outcome, not an error.

Note: the count-then-create sequence has a theoretical read-modify-write race condition. Given the single-club, low-concurrency context of this application, this is accepted as a known limitation and no locking mechanism is required.

### Status transitions

The `PATCH /:id/status` request body `status` field is validated at the input layer: only `ACTIVE` or `PAUSED` are accepted. `WAITLISTED` is never a valid requested target value. The input validation check remains `if (!['ACTIVE', 'PAUSED'].includes(status))` — unchanged.

The promotion path (`WAITLISTED -> ACTIVE`) does not require `WAITLISTED` as a request body value. A promotion request sends `{ status: 'ACTIVE' }`, which passes input validation. The transition logic then reads the commitment's current status from the database. If `commitment.status === 'WAITLISTED'` and the requested target is `ACTIVE`, that is the promotion path. If `commitment.status === 'WAITLISTED'` and the requested target is `PAUSED`, return 422: "Invalid status transition."

Allowed transitions (determined after input validation passes):

- `ACTIVE -> PAUSED` — always allowed
- `PAUSED -> ACTIVE` — allowed only if the template has no cap OR `activeCount < competitiveSlots`. If the cap is reached, return 422: "Competitive slots are full — promote a waitlisted gymnast first or increase the cap."
- `WAITLISTED -> ACTIVE` (promotion) — allowed only if the template has no cap OR `activeCount < competitiveSlots`. If the cap is already full, return 422: "No competitive slot available."

Audit action for `WAITLISTED -> ACTIVE`: `commitment.promoted` with metadata `{ gymnastId, templateId }`. All other transitions use the existing `commitment.status` action with the same metadata shape. `commitment.waitlisted` also uses `{ gymnastId, templateId }`.

Disallowed transitions (`ACTIVE -> WAITLISTED`, `PAUSED -> WAITLISTED`, `WAITLISTED -> PAUSED`) return 422: "Invalid status transition."

### Waitlist position

Waitlist position is derived on the frontend by ordering `WAITLISTED` commitments by `createdAt` ascending, with `id` ascending as a tiebreaker for entries created at the same millisecond. No new database field is required. If a gymnast is removed from the waitlist and re-added, they go to the back of the queue (new `createdAt`).

### Slot-available indicator

When the admin views the commitments panel for a template with a `competitiveSlots` cap:

- Show `{activeCount} / {competitiveSlots} competitive slots`
- If `activeCount < competitiveSlots` AND `waitlistedCount > 0`, show a highlighted indicator: "{slots available} slot(s) available — {waitlistedCount} on waitlist"
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

### Existing consumers of commitment endpoints

After this change, commitment endpoints return entries with `status: 'WAITLISTED'`. Three consumers must be addressed:

- **`BookingAdmin.js` session detail panel** uses `GET /api/commitments?templateId=X`. The standing slots list and remaining-slot arithmetic must filter to `status === 'ACTIVE'` only, so waitlisted gymnasts are not shown as holding a slot.
- **`AdminMembers.js` gymnast commitment list** uses `GET /api/commitments/gymnast/:gymnastId`. `WAITLISTED` entries should display a "Waitlisted" badge (no position number — the exact queue position is not meaningful in this per-gymnast view). No other change needed.
- **`GET /api/commitments/mine`** is used by parents viewing their own gymnasts' commitments. No change needed — the endpoint returns the status field already and parents do not see a commitment management UI. If a gymnast has a `WAITLISTED` commitment, it will simply appear in the response with `status: 'WAITLISTED'`. No frontend change is required for the parent-facing view at this time.

All mutation actions in the commitments panel (promote, pause, activate, remove) trigger a full re-fetch of `GET /api/commitments?templateId=X` after completion, so slot counts and button states are always consistent with server state.

### Template form

The create/edit form gains an optional "Competitive slots" number input (integer, min 1). `competitiveSlots` is stored and transmitted as a plain integer with no unit scaling (unlike `pricePerGymnast` which is stored in pence). If left blank, the field is sent as `null` and no cap is enforced. The Joi schema is `Joi.number().integer().min(1).allow(null).optional()`, matching the pattern used by `minAge`.

This field can be edited at any time. Reducing the cap below the current active count is allowed by the server (no 422). The frontend performs a client-side check before saving: if the entered value is less than the current active commitment count, show an inline warning: "There are currently {n} active commitments. Reducing the cap will not remove anyone, but no new active slots can be added until some free up." The save is not blocked.

### Nav and routing

The Sessions dropdown in `BookingLayout.js` gains a third item: "Session Management" linking to `/booking/admin/session-management`. The embedded `SessionTemplates` collapsible inside `BookingAdmin.js` is removed.

## Migration Notes

The project convention is to split `ALTER TYPE ... ADD VALUE` away from any migration file that also contains DML referencing the new enum value, because PostgreSQL cannot use a newly-added enum value in the same transaction that added it. This migration contains no DML at all — only two DDL statements — so a single migration file is safe. No split is required.

The single migration file contains:

```sql
ALTER TABLE "session_templates" ADD COLUMN "competitiveSlots" INTEGER;
ALTER TYPE "CommitmentStatus" ADD VALUE 'WAITLISTED';
```

Note: the `Commitment` model in `schema.prisma` is missing a `@@map` directive (unlike all other models in the schema). This is a pre-existing issue and is out of scope for this feature.

## Testing

Add the following `describe` blocks to the existing `backend/__tests__/booking.commitments.test.js`:

- Creating a commitment when under cap creates as `ACTIVE`
- Creating a commitment when at cap creates as `WAITLISTED` (audit action `commitment.waitlisted`)
- Creating a commitment when no cap is set always creates as `ACTIVE`
- `WAITLISTED -> ACTIVE` promotion succeeds when a slot is available (audit action `commitment.promoted`)
- `WAITLISTED -> ACTIVE` promotion returns 422 when slots are full
- `PAUSED -> ACTIVE` returns 422 when slots are full
- `ACTIVE -> WAITLISTED` via PATCH returns 422
- `WAITLISTED -> PAUSED` via PATCH returns 422

Add to `booking.templates.test.js`:

- `competitiveSlots` is accepted and returned correctly (create with a value, read it back)

Frontend — manual verification:

- Competitive slots field in template form: saves, loads, clears correctly
- Client-side warning appears when reducing below active count
- Commitments panel shows correct groups and position numbers
- Promote button enabled/disabled state matches slot availability
- Slot-available indicator appears and disappears correctly
- `AdminMembers.js` shows "Waitlisted" badge for WAITLISTED commitments
- `BookingAdmin.js` session detail excludes WAITLISTED gymnasts from standing slots list
