# Booking-Driven Coaching Session Design

## Goal

Replace the manual localStorage-based coaching session feature on the Gymnasts page with automatic population from today's booking data. Coaches select a session from a dropdown; the attendee list is fetched from the attendance API and drives the existing "session only" filter.

## Background

The existing coaching session feature lets coaches manually toggle gymnasts in/out of a temporary session set stored in localStorage. This was a workaround — the app now has a full booking system, so who's attending any given session is already known. The feature should reflect that reality rather than requiring manual data entry.

## Architecture

All changes are contained in `frontend/src/pages/Gymnasts.js`. No backend changes are needed — the required API methods (`bookingApi.getSessions`, `bookingApi.getAttendance`) already exist.

## State Changes

**Remove:**
- `sessionTimestamps` (Map) — only relevant for manually-added gymnasts; no longer needed
- All localStorage reads/writes for `coachingSession` and `sessionTimestamps`
- `toggleGymnastInSession` handler

**Add:**
- `todaySessions` (array) — today's sessions fetched on mount; empty array by default
- `selectedSessionId` (string | null) — which session the coach has selected
- `sessionLoading` (bool) — true while fetching the attendance list

**Keep:**
- `sessionGymnasts` (Set) — still the source of truth for the filter; now populated from the API instead of manual toggles
- `showSessionOnly` (bool) — unchanged; persisted to localStorage as before

## Data Flow

1. On mount (coaches and admins only), fetch `bookingApi.getSessions(year, month)`, filter results to today's date, store in `todaySessions`.
2. Coach selects a session from the dropdown → set `selectedSessionId`, set `sessionLoading = true`, call `bookingApi.getAttendance(instanceId)`.
3. Extract `attendees[].gymnastId` from the response → build a new Set → store in `sessionGymnasts`. Set `sessionLoading = false`.
4. "Session only" toggle filters the gymnast list to `sessionGymnasts` — no behaviour change.
5. Changing the selected session repeats step 2–3. Clearing the selection sets `selectedSessionId = null` and `sessionGymnasts = new Set()`.

## Filter Bar UI Changes

The session dropdown sits in the filter bar alongside the existing search input and role filter. It always renders (for coaches/admins); it is disabled with placeholder text "No sessions today" when `todaySessions` is empty.

When sessions are available, options are formatted as `HH:MM–HH:MM · Type` (e.g. `17:00–18:00 · Trampoline`). The first option is always "No session" (deselected state).

While `sessionLoading` is true, the dropdown is disabled.

The existing "Session (N)" / "Show All" toggle button is unchanged — it appears when `sessionGymnasts.size > 0`, showing the count from the selected session.

## Per-Gymnast UI Changes

**Remove:**
- The `+` / `✓` session toggle button in the desktop table's Session column
- The session toggle in the mobile card view
- The session timestamp sort order (sort-by-session-timestamp logic)

The Session column in the desktop table changes from an interactive toggle to a read-only indicator: a checkmark badge for gymnasts in the selected session's attendee list, blank for those who aren't. If no session is selected, the column is blank for all rows.

## Clear Filters Behaviour

The existing "Clear filters" action (which currently removes localStorage keys) should instead call:
```js
setSelectedSessionId(null);
setSessionGymnasts(new Set());
setShowSessionOnly(false);
```

## Error Handling

If `getAttendance` fails, clear `sessionLoading`, keep the previous `sessionGymnasts` set unchanged, and show the existing page-level error state with a descriptive message.

If `getSessions` fails on mount, `todaySessions` remains empty and the dropdown renders as disabled — no error surfaced for this secondary fetch.
