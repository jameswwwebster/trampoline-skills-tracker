# Trampoline Session Type & DMT Visibility — Design Spec

## Goal

Rename the `STANDARD` session type to `TRAMPOLINE` throughout the codebase and database, add a "Trampoline" label to non-DMT sessions in the booking UI, and hide DMT sessions from parents who have no DMT-approved gymnasts.

## Architecture

Two independent concerns handled together:

1. **Enum rename** — A Prisma migration renames `SessionType.STANDARD` to `TRAMPOLINE` in the database. All backend routes, Joi schemas, and tests, plus all frontend references to the string `'STANDARD'`, are updated to `'TRAMPOLINE'`.

2. **DMT visibility** — The `GET /api/booking/sessions` route filters out DMT session instances when the requesting user is a `PARENT` with no DMT-approved gymnasts. Coaches and admins always receive all sessions.

No new models or fields are required.

## Files Changed

### Backend

- **`backend/prisma/schema.prisma`** — rename enum value `STANDARD` → `TRAMPOLINE` and update `@default(TRAMPOLINE)`
- **`backend/prisma/migrations/<timestamp>_rename_standard_to_trampoline/migration.sql`** — `ALTER TYPE "SessionType" RENAME VALUE 'STANDARD' TO 'TRAMPOLINE';`
- **`backend/routes/booking/templates.js`** — Joi schema: `valid('TRAMPOLINE', 'DMT').default('TRAMPOLINE')`
- **`backend/routes/booking/sessions.js`** — filter DMT instances for parents with no approved gymnasts
- **`backend/__tests__/booking.templates.test.js`** — update string literals and descriptions
- **`backend/__tests__/booking.bookings.test.js`** — update `type: 'STANDARD'` and test description

### Frontend

- **`frontend/src/pages/booking/BookingCalendar.js`** — add "Trampoline" badge for `type === 'TRAMPOLINE'` sessions (alongside existing "DMT" badge)
- **`frontend/src/pages/booking/admin/SessionTemplates.js`** — default form value `'TRAMPOLINE'`, option label "Trampoline", template list badge
- **`frontend/src/pages/booking/admin/AdminMemberships.js`** — session type label: show "Trampoline" for `TRAMPOLINE` type

## Detailed Behaviour

### DMT visibility filtering (`sessions.js`)

`GET /api/booking/sessions` currently returns all instances for a month. After this change:

- If `req.user.role` is `CLUB_ADMIN` or `COACH`: no change, all sessions returned.
- If `req.user.role` is `PARENT`:
  1. Find all gymnasts where `userId === req.user.id` OR `guardians.some(g => g.id === req.user.id)`.
  2. If **any** gymnast has `dmtApproved: true`, return all sessions as before.
  3. If **none** are DMT-approved, filter out instances where `instance.template.type === 'DMT'` before returning.

This means a parent with mixed approved/unapproved gymnasts sees DMT sessions (approved gymnast can book; unapproved gymnast shows existing "Not approved" message on the session detail page).

### "Trampoline" label in the calendar

`BookingCalendar.js` currently shows a small "DMT" badge for DMT sessions. A matching "Trampoline" badge is added for `type === 'TRAMPOLINE'` sessions, using the same inline style pattern.

### Admin form and list

`SessionTemplates.js`:
- Default form value: `type: 'TRAMPOLINE'`
- Select option: `<option value="TRAMPOLINE">Trampoline</option>`
- Template list: show "Trampoline" badge where `t.type === 'TRAMPOLINE'` (same style as existing DMT badge)

`AdminMemberships.js`:
- Session type label: `t.type === 'DMT' ? ' · DMT' : ' · Trampoline'`

## Migration Notes

`ALTER TYPE ... RENAME VALUE` runs outside a transaction block in Postgres. The migration file must contain only this single statement (no other DDL in the same file). Prisma handles this correctly when the migration is generated with `prisma migrate dev`.

## Testing

- Update existing template tests: string literals `'STANDARD'` → `'TRAMPOLINE'`
- Update existing bookings test: `type: 'STANDARD'` → `'TRAMPOLINE'`, update test description
- Add a test to `booking.sessions.test.js` (or create it) verifying that a parent with no DMT-approved gymnasts does not receive DMT sessions in `GET /api/booking/sessions`
- Manual: verify "Trampoline" badge appears on calendar, admin form defaults to Trampoline, DMT sessions hidden/shown correctly
