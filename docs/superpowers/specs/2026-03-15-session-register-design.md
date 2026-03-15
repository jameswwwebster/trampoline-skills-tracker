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
  id                 String          @id @default(cuid())
  sessionInstance    SessionInstance @relation(fields: [sessionInstanceId], references: [id], onDelete: Cascade)
  sessionInstanceId  String
  gymnast            Gymnast         @relation(fields: [gymnastId], references: [id], onDelete: Cascade)
  gymnastId          String
  status             AttendanceStatus
  markedBy           User            @relation(fields: [markedById], references: [id])
  markedById         String
  markedAt           DateTime        @default(now())

  @@unique([sessionInstanceId, gymnastId])
}

enum AttendanceStatus {
  PRESENT
  ABSENT
}
```

## Backend Routes (`backend/routes/booking/attendance.js`)

### `GET /api/booking/attendance/:instanceId`

Returns the expected gymnast list for the session, each with their current status.

**Expected list:** union of:
- Gymnasts with a `BOOKED` booking for this session instance
- Gymnasts with an `ACTIVE` commitment for this session's template where `startDate` is null or ≤ today

Deduplicated by `gymnastId`. Sorted by gymnast first name.

**Response:**
```json
{
  "session": { "id": "...", "date": "2026-04-01", "templateName": "Mon Intermediate", "startTime": "17:00", "duration": 60 },
  "attendees": [
    { "gymnastId": "...", "firstName": "Emma", "lastName": "Johnson", "status": "PRESENT" },
    { "gymnastId": "...", "firstName": "Jake", "lastName": "Patel", "status": "UNMARKED" }
  ]
}
```

### `POST /api/booking/attendance/:instanceId`

Upsert a single attendance record.

**Body:** `{ "gymnastId": "...", "status": "PRESENT" | "ABSENT" }`

Validates that the gymnast is on the expected list for this session. Returns the updated attendee row.

**Auth:** admin or coach role required on both routes.

## Frontend

### `AdminRegister.js` — `/booking/admin/register/:instanceId`

Full-screen mobile-optimised page:

- **Header:** session name, date, formatted start time
- **Attendee list:** each row is a large tap target showing gymnast name and current status badge. Tapping cycles: UNMARKED → PRESENT → ABSENT → UNMARKED. Each tap fires `POST /attendance/:instanceId` immediately (auto-save, no submit button).
- **Status styling:** PRESENT = green, ABSENT = red/muted, UNMARKED = grey

### "Open register" button — `BookingAdmin.js`

In the session detail panel, add an "Open register" button that navigates to `/booking/admin/register/:instanceId`.

### "Register" nav link — admin nav

A "Register" link in the admin navigation. On load, fetches today's session instances for the club and determines active sessions (start time − 15 min ≤ now ≤ start time + duration).

- **One active session:** navigates directly to its register page
- **Multiple active sessions:** opens a simple inline picker listing the active sessions; coach taps to choose
- **No active sessions:** navigates to the admin calendar

The nav link is visually highlighted (e.g. accent colour) whenever at least one session is active.

## Testing

Backend:

- `GET /:instanceId` returns both booked and commitment gymnasts, deduped, with UNMARKED status when no record exists
- `GET /:instanceId` returns PRESENT/ABSENT for gymnasts with existing records
- `POST /:instanceId` with PRESENT creates an Attendance record
- `POST /:instanceId` re-called with ABSENT updates the existing record (upsert)
- `POST /:instanceId` with a gymnast not on the expected list returns 422
- `GET` / `POST` by non-admin/coach returns 401

Frontend — manual:

- Tapping a gymnast cycles through UNMARKED → PRESENT → ABSENT → UNMARKED
- Auto-save fires on each tap with no submit button
- Nav link highlights when a session is active
- Nav link with one active session navigates directly to register
- Nav link with two overlapping sessions shows a picker
