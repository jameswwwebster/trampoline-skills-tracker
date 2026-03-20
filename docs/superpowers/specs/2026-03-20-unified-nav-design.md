# Unified Navigation — Design Spec

## Goal

Replace the two separate navigation layouts (`Layout.js` for skill tracking, `BookingLayout.js` for booking) with a single unified `AppLayout.js` and a redesigned `Dashboard.js` home page. All sections — Bookings, Tracking, Shop, Noticeboard, Account, Admin — are reachable from one persistent navbar.

## Background

The app currently has two separate layouts that the user switches between via a cross-link. As features have grown, the sections have become harder to navigate — admin items are scattered, and switching between booking and tracking requires a context switch. This redesign unifies everything under one nav grouped by function.

---

## Role Definitions

Roles in the system: `CLUB_ADMIN`, `COACH`, `ADULT`, `GYMNAST`, `SUPER_ADMIN`.

These map to existing `AuthContext` flags:

| Flag | Roles |
|------|-------|
| `isClubAdmin` | CLUB_ADMIN |
| `canManageGymnasts` | CLUB_ADMIN, COACH |
| `canEditLevels` | CLUB_ADMIN |
| `isAdmin` *(booking concept, use where BookingLayout used it)* | CLUB_ADMIN, COACH |
| `isSuperAdmin` | SUPER_ADMIN |
| **"member"** *(this spec only)* | ADULT, GYMNAST, SUPER_ADMIN — i.e. `!canManageGymnasts` |

Throughout this spec: **"admin/coach"** = `canManageGymnasts`; **"admin only"** = `isClubAdmin`; **"member"** = anyone who is not CLUB_ADMIN or COACH.

---

## Structure

### AppLayout.js

A single layout wrapping the entire authenticated app. Replaces both `Layout.js` and `BookingLayout.js`. Contains:
- The persistent top navbar (desktop + mobile)
- Banners (payment, overdue charge, noticeboard)
- `<Outlet />` for page content

Fetches noticeboard unread count once on mount and stores it as shared state, exposed via a React context or prop drilling to navbar and dashboard. Exposes a `refreshUnreadCount` callback. The Noticeboard page calls this callback after marking items as read, causing AppLayout to re-fetch the count from the API.

### Dashboard.js

The landing page after login at `/dashboard`. Replaces the existing `Dashboard.js`. Content differs by role (see Dashboard section).

---

## Desktop Navbar

```
[ ⌂ Home | Bookings ▾ | Tracking ▾ | Shop ▾ | Noticeboard 🔴 ]    [ Account ▾ | Admin ▾ ]
```

- Left group: primary navigation
- Right group: right-aligned — Account and Admin
- Noticeboard shows an unread badge when shared unread count > 0
- Admin dropdown only visible to CLUB_ADMIN and COACH
- Active state: when the current route matches a dropdown item, the parent dropdown label is highlighted. Noticeboard and Home use standard NavLink active styling.

### Dropdown contents

**Bookings ▾**
- Book a session → `/booking`
- My Bookings → `/booking/my-bookings`
- *(admin/coach only)* Sessions → `/booking/admin` *(exact match — use React Router `end` prop to prevent this highlighting when on a child route)*
- *(admin/coach only)* Session Management → `/booking/admin/session-management`
- *(admin/coach only)* Closures → `/booking/admin/closures`
- *(admin/coach only)* Register — always shown to admin/coach. When a session is active (within 15 mins before start time through to end time): shows as a highlighted link labelled "Register — HH:MM–HH:MM" linking to `/booking/admin/register/:id`. When multiple sessions are active, one item per session. When no session is active: shown as a greyed-out non-clickable item labelled "Register (no active session)".

**Tracking ▾**
- *(admin/coach only)* Gymnasts → `/gymnasts`
- *(admin/coach only)* Certificates → `/certificates`
- *(member only)* My Progress → `/my-progress`
- *(member only)* My Certificates → `/my-certificates`
- *(admin only)* Levels & Skills → `/levels`
- *(admin only)* Competition Categories → `/competitions`
- *(admin only)* Certificate Setup → `/certificate-designer`

**Shop ▾**
- Shop → `/booking/shop`
- My Orders → `/booking/my-orders`
- *(admin/coach only)* Shop Orders → `/booking/admin/shop-orders`

**Noticeboard** → `/booking/noticeboard` — direct NavLink with unread badge when count > 0

**Account ▾**
- My Account → `/booking/my-account`
- My Charges → `/booking/my-charges` *(hidden for admin/coach — i.e. CLUB_ADMIN and COACH)*
- Profile → `/profile`
- Help → `/booking/admin/help` for admin/coach; `/booking/help` for members
- *(isSuperAdmin only)* Super Admin → `/super-admin`

**Admin ▾** *(admin/coach only — CLUB_ADMIN and COACH)*
- Members → `/booking/admin/members`
- BG Numbers → `/booking/admin/bg-numbers`
- Credits → `/booking/admin/credits`
- Charges → `/booking/admin/charges`
- Messages → `/booking/admin/messages` *(Recipient Groups accessed from within the Messages page)*
- Club Settings → `/club-settings`
- Club Branding → `/branding`
- Audit Log → `/booking/admin/audit-log`

SUPER_ADMIN does not see the Admin dropdown. They access admin functionality via the Super Admin link in Account.

---

## Mobile Navbar

### Collapsed bar

Shows: **brand name** (left) | **Noticeboard badge** + **hamburger icon** (right)

The Noticeboard unread badge is always visible in the collapsed bar when unread count > 0, so users see new notices without opening the menu.

### Slide-in menu (hamburger open)

Flat scrollable list. Sections use labelled headers — no expandable sub-dropdowns. Same role-based visibility as desktop.

```
[ × Menu ]

⌂ Home

─── BOOKINGS ───
  Book a session
  My Bookings
  (admin/coach) Sessions
  (admin/coach) Session Management
  (admin/coach) Closures
  (admin/coach) Register — dynamic label + highlight when session is active,
                            same rules as desktop

─── TRACKING ───
  (admin/coach) Gymnasts
  (admin/coach) Certificates
  (member) My Progress
  (member) My Certificates
  (admin only) Levels & Skills
  (admin only) Competition Categories
  (admin only) Certificate Setup

─── SHOP ───
  Shop
  My Orders
  (admin/coach) Shop Orders

📌 Noticeboard  [unread badge when count > 0]

────────────────
👤 Account
  My Account
  (member only) My Charges
  Profile
  Help  (role-appropriate URL)
  (superadmin only) Super Admin

⚙️ Admin  (admin/coach only)
  Members
  BG Numbers
  Credits
  Charges
  Messages
  Club Settings
  Club Branding
  Audit Log

────────────────
Log out
```

---

## Dashboard

### Member dashboard (ADULT, GYMNAST)

Order top to bottom:

1. **Noticeboard panel** — always shown.
   - Unread count > 0: shows unread badge + title of latest unread notice. Links to `/booking/noticeboard`.
   - Unread count = 0 and posts exist: shows title of latest notice, no badge.
   - No posts exist: shows "No notices yet."

2. **Section tiles (2×2 grid)**:
   - 📅 Bookings → `/booking`
   - 🛍 Shop → `/booking/shop`
   - 🤸 Skill Tracking → `/my-progress`
   - 👤 My Account → `/booking/my-account`

### Admin / Coach dashboard (CLUB_ADMIN, COACH)

Order top to bottom:

1. **Today widget** — shown when sessions exist today OR overdue charges > 0. Hidden when neither condition is true.
   - Today's sessions: list with time ranges. Active session (within 15 mins before start through to end): highlighted Register link labelled with session time. Omitted entirely when no sessions today.
   - Overdue charges: shown as a count with link to `/booking/admin/charges` — only when count > 0. Omitted when count = 0.
   - If sessions exist but overdue charges = 0: widget shows session list only.
   - If overdue charges > 0 but no sessions today: widget shows overdue charges row only (no session list section).

2. **Section tiles (2×2 grid)**:
   - 📅 Bookings → `/booking/admin`
   - 🛍 Shop → `/booking/shop`
   - 🤸 Skill Tracking → `/gymnasts`
   - ⚙️ Admin → `/booking/admin/members`

3. **Noticeboard panel** — same display rules as member panel, shown below tiles.

### SUPER_ADMIN dashboard

Uses the member dashboard layout. The Skill Tracking tile links to `/my-progress` (SUPER_ADMIN does not have `canManageGymnasts`).

---

## Banners

Banners move from `BookingLayout.js` to `AppLayout.js`, behaviour unchanged:

- **Payment pending** — membership `status === 'PENDING_PAYMENT'`. Member only (not admin/coach).
- **Needs payment method** — membership `needsPaymentMethod === true`. Member only.
- **Overdue charge** — any charge is overdue. Member only.
- **Noticeboard new post** — unread count > 0. All users. Dismissed in-memory on click (clicking navigates to noticeboard, which marks items read via existing read-state mechanism).

Banners appear below the navbar, above page content.

---

## Routing

All routes under `<Layout>` (tracking) and `<BookingLayout>` are moved under `<AppLayout>` in `App.js`. Route paths are unchanged. `/booking` prefix retained.

`/dashboard` is the authoritative home path. Existing redirects to `/dashboard` are unchanged.

---

## What Is Not Changed

- All page components — only the layout wrapper and nav change
- Route paths
- Auth logic and role flags
- Banner behaviour
- Public layout (`PublicNav.js`)
- Register live-session logic (15-min window, time-based)
- Read-state mechanism for noticeboard

---

## Out of Scope

- Redesigning any individual page
- Changes to the booking or tracking data model
- Public-facing pages (PublicHome, PublicTimetable, etc.)
- Moving Recipient Groups out of the Messages page
