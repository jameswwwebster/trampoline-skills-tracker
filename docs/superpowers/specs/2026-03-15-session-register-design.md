# Session Attendance Register — Design Spec

**Date:** 2026-03-15

## Goal

Allow coaches to mark attendance on their phone during a session. The register shows every gymnast expected at a session (booked or standing slot), lets coaches tap to mark each one present or absent, and stores the result as a permanent record.

## Architecture

A new `Attendance` model stores deliberate marks (PRESENT or ABSENT only). Gymnasts on the expected list with no record are considered UNMARKED — no row is written until a coach taps. This avoids false data from incomplete registers.

Two backend routes serve the register. The frontend has a dedicated full-screen page optimised for mobile, accessible via a smart nav shortcut and a button on the session detail panel.

## Data Model

```prisma
model Attendance {
  id                 String           @id @default(cuid())
  sessionInstance    SessionInstance  @relation(fields: [sessionInstanceId], references: [id], onDelete: Cascade)
  sessionInstanceId  String
  gymnast            Gymnast          @relation(fields: [gymnastId], references: [id], onDelete: Cascade)
  gymnastId          String
  status             AttendanceStatus
  markedBy           User             @relation(fields: [markedById], references: [id])
  markedById         String
  markedAt           DateTime         @default(now())

  @@unique([sessionInstanceId, gymnastId])
  @@map("attendances")
}

enum AttendanceStatus {
  PRESENT
  ABSENT
}
```

Back-relations must also be added to `SessionInstance`, `Gymnast`, and `User` models:
```prisma
// on SessionInstance
attendances  Attendance[]

// on Gymnast
attendances  Attendance[]

// on User
attendances  Attendance[]
```

## Backend Routes (`backend/routes/booking/attendance.js`)

Both routes require `CLUB_ADMIN` or `COACH` role (returns **403** if role check fails, 401 if no token). Both validate that the `SessionInstance` belongs to `req.user.clubId` — return 404 if not found or wrong club.

### `GET /api/booking/attendance/:instanceId`

Returns the expected gymnast list for the session, each with their current status.

**Expected list:** union of:
- Gymnasts from `BookingLine` records where the `Booking` has `status: 'CONFIRMED'` and `sessionInstanceId` matches (gymnasts are on `BookingLine.gymnastId`, not directly on `Booking`)
- Gymnasts with an `ACTIVE` commitment for this session's template where `startDate` is null or ≤ start of today UTC (i.e. `startDate <= new Date(today.setHours(0,0,0,0))`). PAUSED and WAITLISTED commitments are excluded — gymnasts with a paused slot do not appear on the register.

Deduplicated by `gymnastId`. Sorted by gymnast first name.

If the session instance has `cancelledAt` set, the register is still readable — the session occurred in the system and the attendance record is valid.

`duration` does not exist as a field — compute it from the template's `startTime` and `endTime` strings (parse both as `HH:MM`, take the difference in minutes).

**Response:**
```json
{
  "session": { "id": "...", "date": "2026-04-01", "templateName": "Mon Intermediate", "startTime": "17:00", "endTime": "18:00" },
  "attendees": [
    { "gymnastId": "...", "firstName": "Emma", "lastName": "Johnson", "status": "PRESENT" },
    { "gymnastId": "...", "firstName": "Jake", "lastName": "Patel", "status": "UNMARKED" }
  ]
}
```

### `POST /api/booking/attendance/:instanceId`

Upsert a single attendance record.

**Body (Joi-validated):** `{ "gymnastId": string (required), "status": "PRESENT" | "ABSENT" (required) }` — invalid values return 400.

Validates that the gymnast is on the expected list for this session (same query as GET); returns 422 if not.

Calls `audit()` with `action: 'attendance.mark'`.

**Response:** the updated attendee row in the same shape as the GET attendees array:
```json
{ "gymnastId": "...", "firstName": "Emma", "lastName": "Johnson", "status": "PRESENT" }
```

## Frontend

### `AdminRegister.js` — `/booking/admin/register/:instanceId`

Full-screen mobile-optimised page:

- **Header:** session name, date, formatted start time
- **Attendee list:** each row is a large tap target showing gymnast name and current status badge. Tapping cycles: UNMARKED → PRESENT → ABSENT → UNMARKED. Each tap fires `POST /attendance/:instanceId` immediately (auto-save, no submit button).
- **Status styling:** PRESENT = green, ABSENT = red/muted, UNMARKED = grey

### "Open register" button — `BookingAdmin.js`

In the session detail panel, add an "Open register" button that navigates to `/booking/admin/register/:instanceId`.

### "Register" nav link — admin nav

A "Register" link in the admin navigation. On load, fetches today's session instances for the club and determines active sessions client-side using the device clock:

**Active window:** `startTime − 15 min ≤ now ≤ endTime` (parse `startTime`/`endTime` as `HH:MM`, combine with today's date). Device clock accuracy is an acceptable limitation.

- **One active session:** navigates directly to its register page
- **Multiple active sessions:** opens a simple inline picker listing the active sessions; coach taps to choose
- **No active sessions:** navigates to the admin calendar

The nav link is visually highlighted (accent colour) whenever at least one session is active.

## Testing

Backend:

- `GET /:instanceId` returns both CONFIRMED-booked and ACTIVE-commitment gymnasts, deduped, with UNMARKED status when no Attendance record exists
- `GET /:instanceId` returns PRESENT/ABSENT for gymnasts with existing records
- `GET /:instanceId` excludes gymnasts with PAUSED or WAITLISTED commitments
- `GET /:instanceId` by a user from a different club returns 404
- `POST /:instanceId` with status PRESENT creates an Attendance record
- `POST /:instanceId` re-called with status ABSENT updates the existing record (upsert)
- `POST /:instanceId` with a gymnast not on the expected list returns 422
- `POST /:instanceId` with an invalid status returns 400
- `GET` / `POST` with no token returns 401; with wrong role returns 403

Frontend — manual:

- Tapping a gymnast cycles through UNMARKED → PRESENT → ABSENT → UNMARKED
- Auto-save fires on each tap with no submit button
- Nav link highlights when a session is active
- Nav link with one active session navigates directly to register
- Nav link with two overlapping sessions shows a picker
