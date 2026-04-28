# Admin Hub: Changelog + Side-Menu Consolidation Design

**Date:** 2026-04-28

## Goal

Two related cleanups:

1. The "Recent updates" panel (`ChangelogPanel`) currently sits at the bottom of `BookingAdmin` (the booking calendar admin page). It belongs on the admin hub (`/admin-hub`), under the Logs section.
2. The Admin dropdown in the side menu has grown to ~25 items across desktop and mobile. Replace it with a single `Admin` link that navigates to the admin hub. Hub tiles are the canonical entry point for everything currently in the dropdown.

## Architecture

- **Admin Changelog page** (`/booking/admin/changelog`): thin page wrapper around the existing `ChangelogPanel`. Adds a `← Admin` back link and a `bk-page` container.
- **AdminDashboard Logs section**: new tile `Recent Updates` next to the existing `Audit Log` tile.
- **ChangelogPanel**: drop the outer `marginTop / borderTop / paddingTop` styling that was specific to its old position under a calendar. Heading and item rendering unchanged.
- **AppLayout**: replace the entire Admin dropdown (desktop) and admin section (mobile) with a single `Admin` link to `/admin-hub`. Preserve the `pendingOrderCount` badge on that link. Remove the `activeSessions` state and its fetch effect — only the dropdown's "Register — HH:MM" quick-links consumed it, and those go away.

## Files

- Create `frontend/src/pages/booking/admin/AdminChangelog.js`
- Edit `frontend/src/pages/booking/admin/ChangelogPanel.js` — drop outer wrapper styling
- Edit `frontend/src/pages/booking/admin/BookingAdmin.js` — remove `ChangelogPanel` import and render
- Edit `frontend/src/pages/AdminDashboard.js` — add `Recent Updates` tile in Logs section
- Edit `frontend/src/App.js` — import `AdminChangelog`, register route `booking/admin/changelog`
- Edit `frontend/src/components/AppLayout.js` — replace desktop dropdown + mobile admin section with single `Admin` link, remove `activeSessions` state/effect and `registerItems` / `mobileRegisterItems` helpers

## Role gating

Unchanged. The existing dropdown is gated on `canManageGymnasts` (COACH / CLUB_ADMIN / WELFARE). `AdminDashboard` gates on the same. The new single `Admin` link uses the same gate, so every staff role lands in the same place they would today.

## Verification

Dev server, log in as a staff user. Confirm:

- Side nav shows a single `Admin` link (no dropdown). Order-count badge appears when there are pending shop orders.
- Clicking it lands on `/admin-hub`.
- The Logs section shows two tiles: `Audit Log` and `Recent Updates`.
- `Recent Updates` opens `/booking/admin/changelog` with the changelog and a `← Admin` back link.
- The booking-admin calendar page no longer renders the changelog.
- Mobile menu mirrors the desktop behaviour.
