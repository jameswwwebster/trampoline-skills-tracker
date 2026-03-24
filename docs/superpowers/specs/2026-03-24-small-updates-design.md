# Design: Small UX Updates — Noticeboard Read, Birthdays, Closures

Date: 2026-03-24

## Overview

Three small, independent improvements to the booking system:

1. Noticeboard notices can be manually marked as read
2. Coaches and admins see a "birthdays this week" widget on their home page
3. Closure periods are visually explicit on the booking calendar

---

## Feature 1: Noticeboard — manual mark as read

### Problem

Currently, visiting the noticeboard page auto-marks every unread post as read in a single batch. This means the notification badge disappears the moment you open the page, even if you haven't actually read any posts. Users have no way to intentionally dismiss individual notices.

### Behaviour change

- Remove the auto-mark-all-read-on-load logic (`Noticeboard.js` lines 167–169).
- Unread posts get a visual indicator: a coloured left border accent.
- Each unread post displays a "Mark as read" button in its footer.
- Clicking the button calls the existing `POST /api/noticeboard/:id/read` endpoint, flips `isRead` to `true` in local state, and calls `refreshUnreadCount()` to update the nav badge.
- Read posts do not show the button.

### Scope

- Frontend only — backend endpoint and `NoticeboardRead` model already exist.
- Files changed: `frontend/src/pages/booking/Noticeboard.js`, `frontend/src/pages/booking/Noticeboard.css`.

---

## Feature 2: Birthdays this week (coach / admin dashboard)

### Problem

Coaches and admins have no way to see upcoming gymnast birthdays from the dashboard.

### Backend

New endpoint: `GET /api/dashboard/birthdays-this-week`

- Auth: requires `COACH` or `CLUB_ADMIN` role.
- Queries non-archived gymnasts in `req.user.clubId` where `dateOfBirth` is not null.
- Filters to gymnasts whose month+day of `dateOfBirth` falls within Monday–Sunday of the current calendar week (server local time).
- Returns an array of objects: `{ id, firstName, lastName, dateOfBirth, dayOfWeek, turnsAge }`.
  - `dayOfWeek`: e.g. `"Thursday"`
  - `turnsAge`: integer (computed from year of birth vs. current year)
- Results ordered by day of week ascending (Monday first).

### Frontend

- New widget in `Dashboard.js`, rendered inside the coach/admin branch, between the today widget and the admin tiles.
- Fetches `GET /api/dashboard/birthdays-this-week` on mount alongside other coach data.
- If the response is empty, the widget is not rendered.
- Each row: "[Name] turns [age] — [day]", e.g. "Jamie Smith turns 10 — Thursday".
- Widget title: "Birthdays this week".

### Scope

- Backend: `backend/routes/dashboard.js` (or equivalent dashboard route file).
- Frontend: `frontend/src/pages/Dashboard.js`.

---

## Feature 3: Closures explicit on booking calendar

### Problem

In the week strip at the top of the booking calendar, closed days look identical to days with no sessions — no dots and no styling. Users cannot distinguish a closed day from an empty one without clicking it. The closure reason is also never shown.

### Changes

#### CalendarNav (shared component)

- In the week strip day loop, add `booking-calendar__week-day--closed` to the day button's class list when `isClosed` is true.
- Add CSS for this class: greyed-out text colour, matching the existing past-day treatment, so closed days are visually distinct.

File: `frontend/src/pages/booking/CalendarNav.js`, `frontend/src/pages/booking/BookingCalendar.css`.

#### BookingCalendar.js and BookingAdmin.js (consumers)

- Add a `getClosureForDate(date)` helper inside each file that finds the matching closure from the already-fetched `closures` array (matching on date range).
- In `renderDayPanel`: pass the closure reason to the "Closed" message — "Closed — [reason]" instead of just "Closed".
- In `renderMonthCell`: show the reason as a second line below "Closed" (truncated with CSS `text-overflow: ellipsis` if needed).

No backend changes needed — the `reason` field is already returned by `GET /api/booking/closures`.

---

## Out of scope

- Bulk "mark all as read" on the noticeboard — users mark posts individually.
- Birthday notifications or emails.
- Showing closure reasons in the week dots area (the day panel is sufficient on click).
- Any admin UI changes to closure management.
