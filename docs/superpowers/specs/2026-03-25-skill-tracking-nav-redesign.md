# Skill Tracking Nav Redesign

**Date:** 2026-03-25

## Overview

Three related changes to improve the skill tracking workflow for coaches:

1. Simplify the nav by collapsing the "Tracking" dropdown to a direct "Skill Tracking" link for staff, and moving tracking admin items into the Admin dropdown.
2. Rename the "Gymnasts" nav entry to "Skill Tracking".
3. Add a "Track these gymnasts" button on the coach session detail page that deep-links into the gymnasts page pre-filtered to that session's attendees.

## 1. Nav Restructure

### Desktop nav (AppLayout.js)

**For coaches/admins (`canManageGymnasts`):**
- Replace the "Tracking ▾" dropdown with a direct nav link labelled **"Skill Tracking"** pointing to `/gymnasts`.
- Non-staff users (`!canManageGymnasts && !isAdult`) keep the existing "Tracking ▾" dropdown with My Progress and My Certificates unchanged.

**Admin dropdown — additions (with a divider before this group):**
- Certificates → `/certificates` (visible to all `canManageGymnasts`)
- Levels & Skills → `/levels` (isClubAdmin only)
- Competition Categories → `/competitions` (isClubAdmin only)
- Certificate Setup → `/certificate-designer` (isClubAdmin only)

### Mobile menu (AppLayout.js)

- Under the "Tracking" section label, replace the "Gymnasts" link with "Skill Tracking" for `canManageGymnasts` users.
- Remove Certificates, Levels & Skills, Competition Categories, and Certificate Setup from the Tracking section.
- Add those items into the Admin section of the mobile menu (same grouping/ordering as desktop).

## 2. "Track These Gymnasts" Button (SessionDetail.js)

- Visible only to coaches and admins (`user.role === 'CLUB_ADMIN' || user.role === 'COACH'`).
- Rendered in the session info block, below the time/date line.
- On click, navigates to `/gymnasts?session=<instanceId>`.
- No additional API calls; the Gymnasts page handles the attendance fetch.

## 3. URL Param Handling in Gymnasts.js

When the page mounts with `?session=<instanceId>` in the URL:

1. Call `handleSessionSelect(sessionId)` — this calls `bookingApi.getAttendance(sessionId)`, populates `sessionGymnasts`, and works for any instance (not restricted to today's sessions).
2. Set `showSessionOnly = true` so the filter is active immediately.
3. Remove the `?session=` param from the URL via `setSearchParams` so that back-navigation or refresh does not re-trigger the auto-filter.

The existing manual session dropdown and "Session (N)" toggle button remain unchanged and continue to work as before.

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/AppLayout.js` | Nav restructure (desktop + mobile) |
| `frontend/src/pages/booking/SessionDetail.js` | Add "Track these gymnasts" button for coaches |
| `frontend/src/pages/Gymnasts.js` | Handle `?session=` URL param on mount |

## Out of Scope

- Renaming the `/gymnasts` route path (route stays the same; only the nav label changes).
- Changes to the Gymnasts page title or heading text.
- Any backend changes.
