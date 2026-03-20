# Tracking Section — Branding & UX Refresh

## Goal

Bring the tracking section's visual design and layout fully in line with the booking section, restore coach/admin access via nav links, and block parents (ADULT/CHILD) at the route level.

## Scope

- Route-level access control: coaches and admins only (parents blocked)
- New two-row sticky navbar matching the BookingLayout structure
- Full CSS refresh: cards, buttons, typography, forms aligned with booking design system
- Emoji removal across all tracking pages
- Cross-section navigation: "Booking" link in tracking nav, "Skill Tracker" link in booking nav

---

## Architecture

### 1. Access Control — `TrackingRoute`

New component at `frontend/src/components/TrackingRoute.js`. It replaces the bare `<ProtectedRoute><Layout /></ProtectedRoute>` wrapper in `App.js`.

**Behaviour:**
- While auth is loading (`loading === true` from `useAuth()`): render a loading spinner
- Not authenticated (`!user && !loading`): redirect to `/login?next=<pathname>`
- Authenticated as `ADULT`, `CHILD`, or `GYMNAST`: redirect to `/booking`
- Authenticated as `COACH`, `CLUB_ADMIN`, or `SUPER_ADMIN`: render children

**Implementation:**

`TrackingRoute` is a React component that renders `<Layout />` as its child. `Layout` renders `<Outlet />` internally (unchanged), which surfaces the nested `<Route>` children. `TrackingRoute` does not render `<Outlet />` itself — it renders `<Layout />` directly, mirroring how `ProtectedRoute` currently works.

**`App.js` change:**

```jsx
// Before:
<Route element={
  <ProtectedRoute>
    <Layout />
  </ProtectedRoute>
}>

// After:
<Route element={<TrackingRoute />}>
```

`TrackingRoute` renders `<Layout />` internally:

```jsx
export default function TrackingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to={`/login?next=${location.pathname}`} replace />;
  if (['ADULT', 'CHILD', 'GYMNAST'].includes(user.role)) return <Navigate to="/booking" replace />;
  return <Layout />;
}
```

Note: the current `ProtectedRoute` uses `encodeURIComponent(location.pathname)` in the redirect — `TrackingRoute` must match: `` `/login?next=${encodeURIComponent(location.pathname)}` ``.

---

### 2. Layout Rebuild — `Layout.js` + `TrackingLayout.css`

`Layout.js` is rebuilt to use the same two-row sticky nav structure as `BookingLayout.js`. A new CSS file `frontend/src/components/TrackingLayout.css` holds the nav styles using `tracker-layout__*` class names (avoids collision with `booking-layout__*`).

**Nav structure (desktop):**

```
┌─────────────────────────────────────────────────────┐
│ [Logo / Club name]          [James Webster]  [Log out]│  ← Row 1: topbar
├─────────────────────────────────────────────────────┤
│ Skill Tracking  Certificates▾  Configuration▾  Administration▾  |  Booking │  ← Row 2: links
└─────────────────────────────────────────────────────┘
```

**Row 1 (`tracker-layout__topbar`):**
- Left: brand — shows `branding.logoUrl` as an `<img>` if set, otherwise text `"Trampoline Life"`. Links to `/dashboard`.
- Right: user first+last name as plain text, then "Log out" button

**Row 2 (`tracker-layout__links`):**
- Visible links/dropdowns per role (unchanged from current Layout.js logic, plus restored Dashboard):
  - `Dashboard` → `/dashboard` (all roles)
  - `Skill Tracking` → `/gymnasts` (coaches + admins)
  - `Certificates ▾` → dropdown: Certificate Management (`/certificates`), Certificate Setup (`/certificate-designer` — admin only) (coaches + admins)
  - `Configuration ▾` → dropdown: Levels & Skills (`/levels`), Competition Categories (`/competitions`) (admin only)
  - `Administration ▾` → dropdown: Club Settings, Club Branding, Custom Fields, Manage Users, Invitations, Adults, Adult Requests, Import Gymnasts (admin only)
  - `Super Admin` → `/super-admin` (super admin only)
- The current Layout.js also shows "My Progress" and "My Certificates" links for ADULT/CHILD/GYMNAST roles. Since `TrackingRoute` now redirects all three of those roles to `/booking`, those links are unreachable dead code and are **omitted** from the rebuilt Layout.
- The current "Dashboard" link (`/`) in the existing Layout is also **omitted** — the `/` route is now `PublicHome`, not the tracking dashboard.
- After the nav links, for coaches and admins: a `tracker-layout__divider` (vertical line) then a `tracker-layout__cross-link` link labelled **"Booking"** linking to `/booking`

**Mobile (`max-width: 900px`):**
- Row 2 links hidden; hamburger button (☰) appears in Row 1 (right side, before Log out)
- Clicking opens a right-sliding panel (`tracker-layout__mobile-menu`) — same pattern as `booking-layout__mobile-menu`
- Panel has: header with title "Menu" and × close button, then all nav links flat-listed with section labels for grouped items, a Profile link (`/profile`), then a "Booking" link for coaches/admins, then a "Log out" button
- Dark overlay behind panel closes it on click

**CSS (`TrackingLayout.css`):**
- Imported directly in `Layout.js` via `import './TrackingLayout.css'` (consistent with how `BookingLayout.js` imports `./BookingLayout.css`)
- Mirrors `BookingLayout.css` structure exactly but with `tracker-layout__` prefix
- Imports `bookingVars.css` at the top via `@import '../pages/booking/bookingVars.css'` (relative path from `frontend/src/components/`) to access `--booking-*` CSS variables
- Row 1 background: `var(--booking-bg-dark)` (#2d2d2d)
- Row 2 background: same dark, separated from row 1 by `1px solid rgba(255,255,255,0.1)`
- Active link: bottom border `2px solid var(--booking-accent)` + subtle purple background tint
- Dropdown menus: white background, `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`, `border-radius: 6px`
- Mobile panel: `width: min(320px, 85vw)`, slides in from right, `transition: transform 0.25s ease`


---

### 3. CSS Refresh — `App.css`

The global `App.css` is updated to align the tracking page content with the booking design system. No class names are renamed in page components — only the CSS definitions change.

**Font imports:** Remove unused font families (Open Sans, Roboto, Montserrat, Poppins, Playfair Display, Source Code Pro). Keep only `Exo 2` (already shared with booking).

**CSS variables:** Already aligned with booking values (`--primary-color: #2d2d2d`, `--secondary-color: #7c35e8`, etc.). No changes needed to `:root`.

**Card styles** — `.card`, `.dashboard-card`, `.skill-card`, `.routine-card`, `.competition-card`, `.level-card`:
- Background: `#ffffff`
- Border radius: `6px` (currently `4px` in some places)
- Box shadow: `0 1px 4px rgba(0,0,0,0.08)` (matches bk-card)
- Padding: `1.25rem`
- Border: none (remove grey borders where present)

**Button styles** — `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-outline`:
- Border radius: `6px`
- `.btn-primary`: background `var(--secondary-color)` (#7c35e8), white text, no border
- `.btn-secondary`: background `#eaeaec`, dark text
- `.btn-danger`: background `#e74c3c`, white text
- `.btn-outline`: transparent background, `1px solid var(--secondary-color)`, purple text
- Hover states: 10% darker on background (`filter: brightness(0.92)`)
- Padding: `0.5rem 1rem` (same as booking buttons)
- Font: `var(--font-family)`, `font-size: 0.9rem`, `font-weight: 500`

**Form controls** — `.form-control`, `input`, `select`, `textarea`:
- Border: `1px solid var(--booking-border)` (#d4d4d8)
- Border radius: `6px`
- Padding: `0.5rem 0.75rem`
- Focus: `outline: none; border-color: var(--secondary-color); box-shadow: 0 0 0 2px rgba(124,53,232,0.15)`

**Tables:**
- Header row: `background: #f5f3ff` (light purple tint, matches booking admin tables)
- Row hover: `background: #fafafa`
- Border: `1px solid var(--booking-border)`
- Border radius on containing element: `6px`

**Page title headings (h1/h2 within `.main-content`):**
- `font-weight: 600`
- `color: var(--text-color)` (#1a1a1a)
- `margin-bottom: 1.25rem`

---

### 4. Emoji Removal

Remove all emojis from page headings, nav items, and inline content across tracking page files.

**In `Layout.js`** (handled as part of the rebuild):
- `🏆 My Certificates` → `My Certificates`
- `🔧 Super Admin` → `Super Admin`

**In page files** — scan and remove emojis from JSX headings, button labels, and status messages:
- `frontend/src/pages/Dashboard.js` (a `/dashboard` route is being re-added to the tracking layout as part of this work — see App.js change above)
- `frontend/src/pages/Gymnasts.js`
- `frontend/src/pages/Certificates.js`
- `frontend/src/pages/CertificateDesigner.js`
- `frontend/src/pages/CertificatePreview.js`
- `frontend/src/pages/CustomFields.js`
- `frontend/src/pages/Health.js`
- `frontend/src/pages/SuperAdmin.js`
- `frontend/src/pages/Levels.js`
- `frontend/src/pages/Branding.js`

Emojis in booking page files (e.g. `📌` in the noticeboard banner, `⚠` in payment banners) are **out of scope** — those are contextual indicators, not decorative, and the booking side is not being changed.

---

### 5. Booking Layout — Cross-section Link

In `BookingLayout.js`, add a "Skill Tracker" link for coaches and admins.

**Placement:** Inside the `booking-layout__admin-group` `<div>`, after the closing `</div>` of the Tools dropdown and before the closing `</div>` of `booking-layout__admin-group`. Add a divider and a `<NavLink>` (not `<Link>`) to match the styling of other admin links:

```jsx
<span className="booking-layout__admin-divider" />
<NavLink to="/gymnasts" className="booking-layout__admin-link">Skill Tracker</NavLink>
```

`NavLink` is used (not `Link`) for class-name consistency with other admin links. Active-state styling will not trigger since `/gymnasts` is never under `/booking`, which is fine.

---

## File Changes

| File | Change |
|------|--------|
| `frontend/src/components/TrackingRoute.js` | **New** — role gate, redirects ADULT/CHILD to `/booking` |
| `frontend/src/App.js` | Replace `<ProtectedRoute><Layout /></ProtectedRoute>` with `<TrackingRoute />`; add `<Route path="dashboard" element={<Dashboard />} />` to the tracking layout's child routes |
| `frontend/src/components/Layout.js` | Full rebuild — two-row nav, `tracker-layout__*` classes, no emojis, Booking cross-link |
| `frontend/src/components/TrackingLayout.css` | **New** — nav CSS mirroring BookingLayout.css with `tracker-layout__*` selectors |
| `frontend/src/App.css` | Remove unused font imports; update card, button, form, table styles |
| `frontend/src/pages/booking/BookingLayout.js` | Add "Skill Tracker" link in admin nav area |
| `frontend/src/pages/Dashboard.js` | Remove emojis |
| `frontend/src/pages/Gymnasts.js` | Remove emojis |
| `frontend/src/pages/Certificates.js` | Remove emojis |
| `frontend/src/pages/CertificateDesigner.js` | Remove emojis |
| `frontend/src/pages/CertificatePreview.js` | Remove emojis |
| `frontend/src/pages/CustomFields.js` | Remove emojis |
| `frontend/src/pages/Health.js` | Remove emojis |
| `frontend/src/pages/SuperAdmin.js` | Remove emojis |
| `frontend/src/pages/Levels.js` | Remove emojis |
| `frontend/src/pages/Branding.js` | Remove emojis |

---

## Out of Scope

- Redesigning individual tracking page layouts (Gymnasts.js grid, Progress.js skill cards, etc.)
- Updating booking page emojis (⚠, 📌 — these are contextual indicators)
- Deeper integration between tracking and booking (planned separately)
- Public-facing tracking views for parents (planned separately)
