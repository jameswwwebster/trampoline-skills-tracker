# CalendarNav Shared Component Design

**Date:** 2026-03-10

## Goal

Extract calendar navigation into a shared `CalendarNav` component so that `BookingCalendar` (member view) and `BookingAdmin` (admin view) share the same week-first navigation shell. Admin currently defaults to a month grid; after this change it defaults to week view, matching the member experience.

## Shared Component: `CalendarNav`

**File:** `frontend/src/pages/booking/CalendarNav.js`

**Owns internally:**
- `selectedDate` (Date) — initially today
- `viewMode`: `'week' | 'month'`
- `showMonthPicker` (boolean)
- `pickerYear` (number)
- Navigation functions: `prevWeek`, `nextWeek`, `prevMonth`, `nextMonth`, `jumpToMonth`
- `weekStart`, `buildWeekDays`, `sessionsForDate`, `isInClosure`

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `sessions` | `SessionInstance[]` | yes | All loaded sessions |
| `onNavigate` | `(date: Date) => void` | yes | Called on every `selectedDate` change; parent re-fetches |
| `loading` | `boolean` | no | Shows loading indicator |
| `closures` | `Closure[]` | no | Defaults to `[]` |
| `renderDayDots` | `(date, daySessions, isPast) => ReactNode` | yes | Dots in week strip cells |
| `renderDayPanel` | `(date, daySessions, isPast) => ReactNode` | yes | Content below week strip |
| `renderMonthCell` | `(date, daySessions, isToday, isPast) => ReactNode` | yes | Content inside month grid cells |

**CSS:** Imports `BookingCalendar.css` directly — existing class names unchanged.

## BookingCalendar Refactor

- Removes all navigation/layout code (week strip, month grid, month picker)
- Wraps `<CalendarNav>` and provides three render props with identical logic to today
- Keeps: cart state, session fetching (week-aware, cross-month), `sessionClass`/`sessionLabel`, `SessionDetail`
- `onNavigate(date)` triggers the existing cross-month fetch logic

## BookingAdmin Refactor

- Removes hand-rolled month grid calendar
- Uses `<CalendarNav>` with admin-specific render props
- `renderDayDots`: dots based on session capacity (full / available)
- `renderDayPanel`: session tiles showing time + capacity; clicking a tile loads and opens the existing detail modal
- `renderMonthCell`: clicking a date switches to week view (matching member behaviour); session tiles not directly clickable in month view
- `onNavigate(date)` triggers session fetch for the month (plus adjacent month if week spans boundary)
- Keeps: session detail modal, `ManualAddForm`, session templates collapsible

## Behaviour Notes

- Month view: clicking a date navigates to week view for that day (both views)
- Admin week view: clicking a session in the day panel opens the existing detail modal overlay
- Closures: passed to `CalendarNav` by `BookingCalendar`; not passed by `BookingAdmin` (no closure display needed there)
