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

- Remove the entire auto-mark-on-load block (`Noticeboard.js` lines 167–169) — this includes both the `forEach` call to `markNoticeboardRead` and the subsequent `refreshUnreadCount` call.
- Unread posts get a visual indicator: a coloured left border accent.
- Each unread post displays a "Mark as read" button in its footer.
- Clicking the button calls the existing `POST /api/noticeboard/:id/read` endpoint, flips `isRead` to `true` in local state (updating the post in the `posts` array), and calls `refreshUnreadCount()` (from `useOutletContext`) to re-fetch the unread count for the nav badge.
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
- Filters to gymnasts whose month+day of `dateOfBirth` falls within the current calendar week, where the week runs Monday 00:00 through Sunday 23:59 (server local time). Compute `weekStart` as the most recent Monday (today if today is Monday), `weekEnd` as weekStart + 6 days. `dateOfBirth` is a `DateTime` field; compare only month and day, ignoring year and time-of-day. Past birthdays earlier in the current week are included.
- Returns an array of objects: `{ id, firstName, lastName, dateOfBirth, dayOfWeek, turnsAge }`.
  - `dayOfWeek`: full name, e.g. `"Thursday"`
  - `turnsAge`: integer — current year minus birth year
- Results ordered by day of week ascending (Monday first, Sunday last).

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

Both files already hold a `closures` state array and define `renderDayPanel` / `renderMonthCell` as arrow functions inside the component body. Those arrow functions close over the component's state, so they can access `closures` directly.

- Add a `getClosureForDate(date)` helper inside each component that returns the matching `ClosurePeriod` object (or `null`) by checking whether the date falls within `closure.startDate`–`closure.endDate`.
- In `renderDayPanel`: use `getClosureForDate(date)` to retrieve the closure object and show "Closed — [reason]" instead of just "Closed". Apply this consistently in both files.
- In `renderMonthCell`: show the reason on a second line below "Closed", truncated to one line with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.

No backend changes needed — the `reason` field is already returned by `GET /api/booking/closures`.

---

## Out of scope

- Bulk "mark all as read" on the noticeboard — users mark posts individually.
- Birthday notifications or emails.
- Showing closure reasons in the week dots area (the day panel is sufficient on click).
- Any admin UI changes to closure management.
