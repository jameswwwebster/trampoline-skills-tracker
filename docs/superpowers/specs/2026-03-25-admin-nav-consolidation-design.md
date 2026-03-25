# Admin Nav Consolidation — Design Spec

## Overview

Consolidate all admin-facing nav items into the Admin dropdown, removing them from the Bookings and Shop dropdowns. Organise the Admin dropdown with section labels for clarity. Add a pending-orders badge on the Communications section.

## Goals

- Bookings and Shop dropdowns become clean member-facing menus
- All admin links live in one place (Admin dropdown) with clear sections
- Coaches and admins can see at a glance if there are shop orders requiring action

## Non-Goals

- No changes to routes, page logic, or backend business logic beyond the count endpoint
- No changes to member-facing pages or member nav experience (except removing admin items from their dropdowns, which members never saw anyway)

---

## Backend

### New endpoint: `GET /api/booking/shop/admin/orders/pending-count`

- Auth: staff only (`CLUB_ADMIN`, `COACH`)
- Returns `{ count: N }` where N = count of ShopOrders with status `ORDERED` or `ARRIVED`
- Lightweight — no joins, no pagination
- Added to `backend/routes/booking/shopAdmin.js`

---

## Frontend

### `frontend/src/utils/shopApi.js`

Add:

```js
getPendingOrderCount: () =>
  axios.get(`${API_URL}/booking/shop/admin/orders/pending-count`, { headers: getHeaders() }),
```

---

### `frontend/src/components/AppLayout.js`

#### State

Add `pendingOrderCount` (integer, default 0). Fetched once on mount when `canManageGymnasts` is true (matching the Admin dropdown guard) via `shopApi.getPendingOrderCount()`.

#### Desktop — Bookings dropdown

Remove the admin-only block (Sessions, Session Management, Closures, Register). Remaining items:
- Book a session
- My Bookings
- My Waitlist (non-admin only)

#### Desktop — Shop dropdown

Remove Shop Orders. Remaining items:
- Shop
- My Orders

#### Desktop — Admin dropdown (new structure)

Section labels (`app-layout__dropdown-label`) separate the groups. Non-clickable, styled as muted uppercase text.

```
SESSIONS
  Sessions
  Session Management
  Closures
  Register (active session buttons or muted placeholder)

MEMBERS
  Members
  BG Numbers
  Credits
  Charges
  Payments

COMMUNICATIONS
  Messages
  Shop Orders

SKILL TRACKING
  Certificates
  [isClubAdmin] Levels & Skills
  [isClubAdmin] Competition Categories
  [isClubAdmin] Certificate Setup

SETTINGS  [isClubAdmin only — entire section hidden for coaches]
  Club Settings
  Club Branding
  Audit Log
```

**Badge:** When `pendingOrderCount > 0`, a numeric badge appears on the "Admin ▾" dropdown button itself (same `.app-layout__badge` class and pattern as the Noticeboard link badge). This is the most discoverable placement — visible without opening the dropdown. No badge is rendered inside the dropdown on the COMMUNICATIONS label.

No change to the `dropdownRef` outside-click handler.

#### Mobile menu

The existing mobile Admin section gets sub-labels (`app-layout__mobile-sub-label`) mirroring the same five sections:
- Sessions, Session Management, Closures, Register move from mobile Bookings section to mobile Admin under the SESSIONS sub-label
- Shop Orders moves from mobile Shop section to mobile Admin under the COMMUNICATIONS sub-label
- The mobile Bookings section is left with Book a session, My Bookings, My Waitlist (non-admin)
- The mobile Shop section is left with Shop and My Orders

---

### `frontend/src/components/AppLayout.css`

Add two new classes:

**`.app-layout__dropdown-label`** — non-clickable section header within a desktop dropdown. Muted, uppercase, small font, with padding. No hover state.

**`.app-layout__mobile-sub-label`** — similar but for within the mobile Admin section. Slightly indented, muted, smaller than the top-level section label.

---

## Data Flow

```
AppLayout mounts (admin user)
  → shopApi.getPendingOrderCount()
  → setPendingOrderCount(res.data.count)

Admin dropdown renders
  → Admin ▾ button shows numeric badge if pendingOrderCount > 0
```

The count is fetched once on load. It updates when the component remounts (e.g. navigation away and back). No polling — acceptable because the badge is a soft indicator, not a hard real-time alert.

---

## Error Handling

If the pending count fetch fails, `pendingOrderCount` stays 0 (no badge shown). Silent failure — no UI impact.

---

## Files Changed

| File | Change |
|---|---|
| `backend/routes/booking/shopAdmin.js` | Add `GET /orders/pending-count` route |
| `frontend/src/utils/shopApi.js` | Add `getPendingOrderCount` |
| `frontend/src/components/AppLayout.js` | Restructure dropdowns + badge state |
| `frontend/src/components/AppLayout.css` | Add dropdown-label + mobile-sub-label styles |
