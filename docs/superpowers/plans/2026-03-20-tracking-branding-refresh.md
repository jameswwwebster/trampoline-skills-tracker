# Tracking Section — Branding & UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the tracking section's visual design fully in line with the booking section, restrict access to coaches/admins only, and add cross-section navigation.

**Architecture:** New `TrackingRoute` component gates access by role. `Layout.js` is rebuilt with a two-row sticky nav mirroring `BookingLayout.js`, using a new `TrackingLayout.css` that imports the shared `bookingVars.css`. `App.css` global styles (cards, buttons, forms) are updated to match the booking design system. Emojis are removed from all tracking page files.

**Tech Stack:** React 18, React Router v6, CSS (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-20-tracking-branding-refresh-design.md`

---

## Chunk 1: Access Control + New Layout Shell

### Task 1: TrackingRoute — role-gated access control

**Files:**
- Create: `frontend/src/components/TrackingRoute.js`
- Modify: `frontend/src/App.js` (lines 177–202)

The current tracking layout wraps `<ProtectedRoute><Layout /></ProtectedRoute>`. Replace with `<TrackingRoute />` which redirects `ADULT`, `CHILD`, and `GYMNAST` roles to `/booking`, and also adds the missing `/dashboard` route.

- [ ] **Step 1: Create `TrackingRoute.js`**

```jsx
// frontend/src/components/TrackingRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

const BLOCKED_ROLES = ['ADULT', 'CHILD', 'GYMNAST'];

export default function TrackingRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (BLOCKED_ROLES.includes(user.role)) return <Navigate to="/booking" replace />;

  return <Layout />;
}
```

- [ ] **Step 2: Update `App.js` — swap `<ProtectedRoute><Layout /></ProtectedRoute>` and add Dashboard route**

In `frontend/src/App.js`:

Add import at the top (after the existing `Layout` import):
```js
import TrackingRoute from './components/TrackingRoute';
import Dashboard from './pages/Dashboard';
```

Replace the tracking layout route block (currently lines 177–202):
```jsx
// BEFORE:
<Route element={
  <ProtectedRoute>
    <Layout />
  </ProtectedRoute>
}>
  <Route path="gymnasts" element={<Gymnasts />} />
  ...
</Route>

// AFTER:
<Route element={<TrackingRoute />}>
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="gymnasts" element={<Gymnasts />} />
  <Route path="levels" element={<Levels />} />
  <Route path="competitions" element={<Competitions />} />
  <Route path="progress/:gymnastId" element={<Progress />} />
  <Route path="my-progress" element={<MyProgress />} />
  <Route path="invites" element={<Invites />} />
  <Route path="users" element={<Users />} />
  <Route path="profile" element={<Profile />} />
  <Route path="certificates" element={<Certificates />} />
  <Route path="my-certificates" element={<MyCertificates />} />
  <Route path="certificates/:certificateId/preview" element={<CertificatePreview />} />
  <Route path="certificate-designer" element={<CertificateDesigner />} />
  <Route path="import" element={<ImportGymnasts />} />
  <Route path="club-settings" element={<ClubSettings />} />
  <Route path="branding" element={<Branding />} />
  <Route path="custom-fields" element={<CustomFields />} />
  <Route path="adults" element={<Adults />} />
  <Route path="adult-requests" element={<AdultRequests />} />
  <Route path="health" element={<Health />} />
  <Route path="super-admin" element={<SuperAdmin />} />
</Route>
```

- [ ] **Step 3: Verify the build passes**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | tail -5
```
Expected: `Compiled successfully.` (or only pre-existing warnings, no new errors)

- [ ] **Step 4: Smoke-test routing in dev server**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm start
```

- Navigate to `/gymnasts` as a coach → page loads
- Navigate to `/gymnasts` as an ADULT user → redirects to `/booking`
- Navigate to `/dashboard` as a coach → Dashboard page loads

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TrackingRoute.js frontend/src/App.js
git commit -m "feat: TrackingRoute — block ADULT/CHILD/GYMNAST from tracker, restore /dashboard route"
```

---

### Task 2: TrackingLayout.css — nav stylesheet

**Files:**
- Create: `frontend/src/components/TrackingLayout.css`

This is a near-exact mirror of `BookingLayout.css` with `tracker-layout__` class prefix and no payment banner / unread badge sections (those are booking-specific).

- [ ] **Step 1: Create `frontend/src/components/TrackingLayout.css`**

```css
@import '../pages/booking/bookingVars.css';

.tracker-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--booking-font);
  background: var(--booking-bg-light);
}

.tracker-layout__nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--booking-bg-dark);
  color: var(--booking-text-on-dark);
}

/* Top bar: brand left, user+logout right */
.tracker-layout__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.tracker-layout__brand {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: #fff;
  text-decoration: none;
}

.tracker-layout__user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tracker-layout__username {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
}

.tracker-layout__logout {
  background: none;
  border: 1px solid rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.65);
  border-radius: var(--booking-radius);
  padding: 0.25rem 0.65rem;
  font-family: var(--booking-font);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}

.tracker-layout__logout:hover {
  border-color: rgba(255,255,255,0.6);
  color: #fff;
}

/* Link row */
.tracker-layout__links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
}

.tracker-layout__links a,
.tracker-layout__link {
  color: rgba(255,255,255,0.65);
  text-decoration: none;
  padding: 0.3rem 0.65rem;
  border-radius: var(--booking-radius);
  font-size: 0.875rem;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.tracker-layout__links a.active,
.tracker-layout__links a:hover,
.tracker-layout__link.active,
.tracker-layout__link:hover {
  color: #fff;
  background: var(--booking-accent);
}

.tracker-layout__divider {
  width: 1px;
  height: 1.1rem;
  background: rgba(255,255,255,0.18);
  margin: 0 0.2rem;
  flex-shrink: 0;
}

.tracker-layout__cross-link {
  font-size: 0.82rem !important;
  opacity: 0.8;
}

.tracker-layout__cross-link:hover {
  background: rgba(124,53,232,0.4) !important;
  color: #fff !important;
  opacity: 1;
}

/* Dropdown */
.tracker-layout__dropdown {
  position: relative;
  flex-shrink: 0;
}

.tracker-layout__dropdown-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--booking-font);
  color: rgba(255,255,255,0.65);
  padding: 0.3rem 0.65rem;
  border-radius: var(--booking-radius);
  font-size: 0.875rem;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.tracker-layout__dropdown-btn:hover,
.tracker-layout__dropdown-btn.active {
  color: #fff;
  background: var(--booking-accent);
}

.tracker-layout__dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--booking-bg-dark);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--booking-radius);
  min-width: 180px;
  max-width: calc(100vw - 1rem);
  z-index: 200;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

@media (max-width: 480px) {
  .tracker-layout__dropdown-menu {
    left: auto;
    right: 0;
  }
}

.tracker-layout__dropdown-item {
  display: block;
  color: rgba(255,255,255,0.75);
  text-decoration: none;
  padding: 0.4rem 0.9rem;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.tracker-layout__dropdown-item:hover,
.tracker-layout__dropdown-item.active {
  background: var(--booking-accent);
  color: #fff;
}

/* Main content */
.tracker-layout__main {
  flex: 1;
  padding: 1.5rem;
}

/* ─── Hamburger button ───────────────────────────────────────────────────── */
.tracker-layout__hamburger {
  display: none;
  background: none;
  border: 1px solid rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.75);
  border-radius: var(--booking-radius);
  padding: 0.25rem 0.6rem;
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  transition: border-color 0.15s, color 0.15s;
}

.tracker-layout__hamburger:hover {
  border-color: rgba(255,255,255,0.6);
  color: #fff;
}

/* ─── Mobile overlay ─────────────────────────────────────────────────────── */
.tracker-layout__mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 300;
}

/* ─── Mobile slide-in menu ───────────────────────────────────────────────── */
.tracker-layout__mobile-menu {
  position: fixed;
  top: 0;
  right: -100%;
  width: min(320px, 85vw);
  height: 100dvh;
  background: var(--booking-bg-dark);
  z-index: 400;
  display: flex;
  flex-direction: column;
  transition: right 0.25s ease;
  overflow-y: auto;
}

.tracker-layout__mobile-menu.open {
  right: 0;
}

.tracker-layout__mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.tracker-layout__mobile-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
}

.tracker-layout__mobile-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.6);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.tracker-layout__mobile-close:hover { color: #fff; }

.tracker-layout__mobile-links {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
}

.tracker-layout__mobile-section-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  padding: 0.75rem 1rem 0.25rem;
}

.tracker-layout__mobile-link {
  display: block;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  font-family: var(--booking-font);
  background: none;
  border: none;
  text-align: left;
  width: 100%;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.tracker-layout__mobile-link:hover,
.tracker-layout__mobile-link.active {
  background: rgba(255,255,255,0.08);
  color: #fff;
}

.tracker-layout__mobile-footer {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 0.5rem 0;
  flex-shrink: 0;
}

.tracker-layout__mobile-logout {
  color: rgba(255,255,255,0.5) !important;
}

/* ─── Responsive: show hamburger, hide link row ──────────────────────────── */
@media (max-width: 900px) {
  .tracker-layout__hamburger {
    display: inline-flex;
    align-items: center;
  }
  .tracker-layout__links {
    display: none;
  }
}
```

- [ ] **Step 2: Verify no CSS syntax errors**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | grep -i "error\|warning" | head -10
```

Expected: no new errors relating to TrackingLayout.css

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TrackingLayout.css
git commit -m "feat: add TrackingLayout.css — two-row nav styles mirroring booking"
```

---

### Task 3: Layout.js rebuild

**Files:**
- Modify: `frontend/src/components/Layout.js` (full rewrite)

Replace the entire file with the new two-row nav structure. Uses `tracker-layout__*` classes from `TrackingLayout.css`. Removes all emojis from nav items. Removes the dead-code ADULT/CHILD/GYMNAST nav items (Dashboard link at `/` and "My Certificates"/"My Progress" for those roles — all are now unreachable via `TrackingRoute`). Adds Dashboard link at `/dashboard` for all users. Adds "Booking" cross-link for coaches/admins.

- [ ] **Step 1: Replace `frontend/src/components/Layout.js` entirely**

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import './TrackingLayout.css';

export default function Layout() {
  const {
    user, logout,
    canManageGymnasts, isClubAdmin, canReadCompetitions, canEditLevels, isSuperAdmin,
  } = useAuth();
  const { branding } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  const toggleDropdown = (name) => setOpenDropdown(o => o === name ? null : name);
  const closeMobile = () => setIsMobileMenuOpen(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  const isCoachOrAdmin = canManageGymnasts || isClubAdmin;

  return (
    <div className="tracker-layout">
      <nav className="tracker-layout__nav">

        {/* Row 1: brand + username + logout + hamburger */}
        <div className="tracker-layout__topbar">
          <NavLink to="/dashboard" className="tracker-layout__brand">
            {branding?.logoUrl
              ? <img src={branding.logoUrl} alt="Club Logo" style={{ height: '36px', maxWidth: '160px' }} />
              : 'Trampoline Life'}
          </NavLink>
          <div className="tracker-layout__user">
            <span className="tracker-layout__username">{user?.firstName} {user?.lastName}</span>
            <button className="tracker-layout__logout" onClick={handleLogout}>Log out</button>
            <button
              className="tracker-layout__hamburger"
              onClick={() => setIsMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Row 2: nav links */}
        <div className="tracker-layout__links" ref={dropdownRef}>

          <NavLink to="/dashboard" className="tracker-layout__link">Dashboard</NavLink>

          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="tracker-layout__link">Skill Tracking</NavLink>
          )}

          {canManageGymnasts && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'certificates' ? ' active' : ''}`}
                onClick={() => toggleDropdown('certificates')}
              >
                Certificates ▾
              </button>
              {openDropdown === 'certificates' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/certificates" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                    Certificate Management
                  </NavLink>
                  {isClubAdmin && (
                    <NavLink to="/certificate-designer" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Certificate Setup
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {canEditLevels && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'configuration' ? ' active' : ''}`}
                onClick={() => toggleDropdown('configuration')}
              >
                Configuration ▾
              </button>
              {openDropdown === 'configuration' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/levels" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                    Levels & Skills
                  </NavLink>
                  {canReadCompetitions && (
                    <NavLink to="/competitions" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>
                      Competition Categories
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {isClubAdmin && (
            <div className="tracker-layout__dropdown">
              <button
                className={`tracker-layout__dropdown-btn${openDropdown === 'administration' ? ' active' : ''}`}
                onClick={() => toggleDropdown('administration')}
              >
                Administration ▾
              </button>
              {openDropdown === 'administration' && (
                <div className="tracker-layout__dropdown-menu">
                  <NavLink to="/club-settings" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Settings</NavLink>
                  <NavLink to="/branding" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Branding</NavLink>
                  <NavLink to="/custom-fields" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Custom Fields</NavLink>
                  <NavLink to="/users" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Manage Users</NavLink>
                  <NavLink to="/invites" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Invitations</NavLink>
                  <NavLink to="/adults" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Adults</NavLink>
                  <NavLink to="/adult-requests" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Adult Requests</NavLink>
                  <NavLink to="/import" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Import Gymnasts</NavLink>
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <NavLink to="/super-admin" className="tracker-layout__link">Super Admin</NavLink>
          )}

          {isCoachOrAdmin && (
            <>
              <span className="tracker-layout__divider" />
              <NavLink to="/booking" className={`tracker-layout__link tracker-layout__cross-link`}>Booking</NavLink>
            </>
          )}

        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="tracker-layout__mobile-overlay" onClick={closeMobile} />
      )}

      {/* Mobile slide-in menu */}
      <div className={`tracker-layout__mobile-menu${isMobileMenuOpen ? ' open' : ''}`}>
        <div className="tracker-layout__mobile-header">
          <span className="tracker-layout__mobile-title">Menu</span>
          <button className="tracker-layout__mobile-close" onClick={closeMobile} aria-label="Close menu">×</button>
        </div>

        <div className="tracker-layout__mobile-links">

          <NavLink to="/dashboard" className="tracker-layout__mobile-link" onClick={closeMobile}>Dashboard</NavLink>

          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="tracker-layout__mobile-link" onClick={closeMobile}>Skill Tracking</NavLink>
          )}

          {canManageGymnasts && (
            <>
              <div className="tracker-layout__mobile-section-label">Certificates</div>
              <NavLink to="/certificates" className="tracker-layout__mobile-link" onClick={closeMobile}>Certificate Management</NavLink>
              {isClubAdmin && (
                <NavLink to="/certificate-designer" className="tracker-layout__mobile-link" onClick={closeMobile}>Certificate Setup</NavLink>
              )}
            </>
          )}

          {canEditLevels && (
            <>
              <div className="tracker-layout__mobile-section-label">Configuration</div>
              <NavLink to="/levels" className="tracker-layout__mobile-link" onClick={closeMobile}>Levels & Skills</NavLink>
              {canReadCompetitions && (
                <NavLink to="/competitions" className="tracker-layout__mobile-link" onClick={closeMobile}>Competition Categories</NavLink>
              )}
            </>
          )}

          {isClubAdmin && (
            <>
              <div className="tracker-layout__mobile-section-label">Administration</div>
              <NavLink to="/club-settings" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Settings</NavLink>
              <NavLink to="/branding" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Branding</NavLink>
              <NavLink to="/custom-fields" className="tracker-layout__mobile-link" onClick={closeMobile}>Custom Fields</NavLink>
              <NavLink to="/users" className="tracker-layout__mobile-link" onClick={closeMobile}>Manage Users</NavLink>
              <NavLink to="/invites" className="tracker-layout__mobile-link" onClick={closeMobile}>Invitations</NavLink>
              <NavLink to="/adults" className="tracker-layout__mobile-link" onClick={closeMobile}>Adults</NavLink>
              <NavLink to="/adult-requests" className="tracker-layout__mobile-link" onClick={closeMobile}>Adult Requests</NavLink>
              <NavLink to="/import" className="tracker-layout__mobile-link" onClick={closeMobile}>Import Gymnasts</NavLink>
            </>
          )}

          {isSuperAdmin && (
            <NavLink to="/super-admin" className="tracker-layout__mobile-link" onClick={closeMobile}>Super Admin</NavLink>
          )}

        </div>

        <div className="tracker-layout__mobile-footer">
          <NavLink to="/profile" className="tracker-layout__mobile-link" onClick={closeMobile}>Profile</NavLink>
          {isCoachOrAdmin && (
            <NavLink to="/booking" className="tracker-layout__mobile-link" onClick={closeMobile}>Booking</NavLink>
          )}
          <button className={`tracker-layout__mobile-link tracker-layout__mobile-logout`} onClick={() => { handleLogout(); closeMobile(); }}>
            Log out
          </button>
        </div>

      </div>

      <main className="tracker-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | tail -5
```

Expected: `Compiled successfully.`

- [ ] **Step 3: Smoke-test the nav visually**

Start the dev server (`npm start`) and log in as a coach. Verify:
- Two-row sticky navbar appears, matching the booking nav style
- "Dashboard", "Skill Tracking", "Certificates ▾" links visible
- "Booking" cross-link visible after the divider
- Hamburger appears at narrow viewport (< 900px); mobile panel slides in from right
- No emojis in the nav

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.js
git commit -m "feat: rebuild tracking Layout.js — two-row nav, no emojis, Booking cross-link"
```

---

## Chunk 2: CSS Refresh + Cross-Link + Emoji Removal

### Task 4: App.css — global style refresh

**Files:**
- Modify: `frontend/src/App.css`

Update font import, card styles, button styles, and form control styles to match the booking design system. No class names are renamed — only the CSS rules change.

- [ ] **Step 1: Replace the Google Fonts import (line 4)**

```css
/* BEFORE: */
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Open+Sans:wght@300;400;600;700&family=Roboto:wght@300;400;500;700&family=Montserrat:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Source+Code+Pro:wght@300;400;500;600&display=swap');

/* AFTER: */
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800&display=swap');
```

- [ ] **Step 2: Update `.card` styles (around line 605)**

```css
/* BEFORE: */
.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* AFTER: */
.card {
  background: #ffffff;
  border-radius: 6px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
```

- [ ] **Step 3a: Update `.btn` base rule (line 711)**

```css
/* BEFORE: */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

/* AFTER: */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: var(--font-family);
  cursor: pointer;
  transition: filter 0.15s, background 0.15s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}
```

- [ ] **Step 3b: Update `.btn-primary:hover` (line 728)**

```css
/* BEFORE: */
.btn-primary:hover {
  background-color: var(--primary-color);
}

/* AFTER: */
.btn-primary:hover {
  filter: brightness(0.92);
}
```

- [ ] **Step 3c: Update `.btn-danger:hover` (line 746)**

```css
/* BEFORE: */
.btn-danger:hover {
  background-color: #c0392b;
}

/* AFTER: */
.btn-danger:hover {
  filter: brightness(0.92);
}
```

- [ ] **Step 3d: Update `.btn-secondary` and its hover (lines 750–757)**

```css
/* BEFORE: */
.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background-color: #7f8c8d;
}

/* AFTER: */
.btn-secondary {
  background-color: #eaeaec;
  color: #1a1a1a;
}

.btn-secondary:hover {
  filter: brightness(0.92);
}
```

- [ ] **Step 3e: Update `.btn-outline` border (line 759)**

```css
/* BEFORE: */
.btn-outline {
  background-color: transparent;
  border: 2px solid var(--secondary-color);
  color: var(--secondary-color);
}

/* AFTER: */
.btn-outline {
  background-color: transparent;
  border: 1px solid var(--secondary-color);
  color: var(--secondary-color);
}
```

- [ ] **Step 3f: Update `.btn-outline:hover` (line 765)**

```css
/* BEFORE: */
.btn-outline:hover {
  background-color: var(--secondary-color);
  color: white;
}

/* AFTER: */
.btn-outline:hover {
  filter: brightness(0.92);
}
```

- [ ] **Step 4a: Update `.form-control` (line 642)**

```css
/* BEFORE: */
.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

/* AFTER: */
.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  font-size: 1rem;
  font-family: var(--font-family);
  transition: border-color 0.15s, box-shadow 0.15s;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
```

- [ ] **Step 4b: Update `.form-control:focus` focus shadow (line 654)**

```css
/* BEFORE: */
.form-control:focus {
  outline: none;
  border-color: var(--secondary-color);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* AFTER: */
.form-control:focus {
  outline: none;
  border-color: var(--secondary-color);
  box-shadow: 0 0 0 2px rgba(124,53,232,0.15);
}
```

- [ ] **Step 4c: Update `.form-select` (line 660)**

```css
/* BEFORE: */
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 8px 10px;
  padding-right: 2.5rem;
}

/* AFTER: */
.form-select {
  width: 100%;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  font-size: 1rem;
  font-family: var(--font-family);
  background-color: white;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 8px 10px;
}
```

- [ ] **Step 4d: Update `.form-select:focus` focus shadow (line 677)**

```css
/* BEFORE: */
.form-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* AFTER: */
.form-select:focus {
  outline: none;
  border-color: var(--secondary-color);
  box-shadow: 0 0 0 2px rgba(124,53,232,0.15);
}
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Visually verify cards and buttons look consistent with booking side**

Start dev server, navigate to a few tracking pages (e.g. `/gymnasts`, `/certificates`). Cards should have tighter padding, subtler shadow, 6px radius. Buttons should be slightly smaller and match booking button style.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.css
git commit -m "style: update App.css — align cards/buttons/forms with booking design system, drop unused fonts"
```

---

### Task 5: BookingLayout.js — "Skill Tracker" cross-link

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js` (around line 327)

Add a "Skill Tracker" `NavLink` in the admin nav group, after the Tools dropdown closing `</div>` and before the closing `</div>` of `booking-layout__admin-group`.

- [ ] **Step 1: Add Skill Tracker link in `BookingLayout.js`**

Find this block (around line 325–328):
```jsx
                  </div>
                )}
              </div>
            </div>
```

This is: close dropdown-menu `</div>`, close `{openDropdown === 'tools' && (`, close `booking-layout__dropdown` `</div>`, close `booking-layout__admin-group` `</div>`.

The exact text to find is the closing of the Tools dropdown and admin group:
```jsx
                  </div>
                )}
              </div>
            </div>
```

Insert the divider + link immediately before the final `</div>` (end of `booking-layout__admin-group`):
```jsx
                  </div>
                )}
              </div>
              <span className="booking-layout__admin-divider" />
              <NavLink to="/gymnasts" className="booking-layout__admin-link">Skill Tracker</NavLink>
            </div>
```

- [ ] **Step 2: Verify build passes and link appears for admins**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | tail -5
```

Log in as a coach/admin on the booking side. Verify "Skill Tracker" link appears in the admin nav area. Click it — should navigate to `/gymnasts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/BookingLayout.js
git commit -m "feat: add Skill Tracker cross-link to booking nav (coaches/admins only)"
```

---

### Task 6: Emoji removal — tracking page files

**Files:**
- Modify: `frontend/src/pages/Dashboard.js`
- Modify: `frontend/src/pages/Gymnasts.js`
- Modify: `frontend/src/pages/Certificates.js`
- Modify: `frontend/src/pages/CertificateDesigner.js`
- Modify: `frontend/src/pages/CertificatePreview.js`
- Modify: `frontend/src/pages/CustomFields.js`
- Modify: `frontend/src/pages/Health.js`
- Modify: `frontend/src/pages/SuperAdmin.js`
- Modify: `frontend/src/pages/Levels.js`
- Modify: `frontend/src/pages/Branding.js`

Remove all emoji characters from JSX headings, button text, labels, and status messages. Replace with clean text equivalents. Do not remove emojis from `console.log` statements or comments.

- [ ] **Step 1: Find all emojis in tracking pages**

```bash
grep -rn '[^\x00-\x7F]' \
  frontend/src/pages/Dashboard.js \
  frontend/src/pages/Gymnasts.js \
  frontend/src/pages/Certificates.js \
  frontend/src/pages/CertificateDesigner.js \
  frontend/src/pages/CertificatePreview.js \
  frontend/src/pages/CustomFields.js \
  frontend/src/pages/Health.js \
  frontend/src/pages/SuperAdmin.js \
  frontend/src/pages/Levels.js \
  frontend/src/pages/Branding.js \
  | grep -v "console\." | grep -v "\/\/"
```

Review each result. Common patterns to replace:
- `🏆 My Certificates` → `My Certificates`
- `🔧 Super Admin` → `Super Admin`
- `✏️` (edit icon) → remove or replace with text "Edit"
- `🔒` (lock icon) → remove or describe inline (e.g. "(locked)")
- `✖` or `✕` (close/remove icons) → `×` (HTML entity equivalent, already ASCII-safe) or "Remove"
- `🎨` → remove
- `✅` / `❌` → replace with text ("Done" / "Error") or CSS-styled spans

Use your judgement: if an emoji is decorative in a heading, remove it. If it's load-bearing as the only indicator of status (e.g. inline ✅ next to a status value), replace with a text equivalent.

- [ ] **Step 2: Edit each file to remove emojis**

Work through each file from the grep results. Make targeted edits — don't restructure any logic, just remove the emoji characters.

- [ ] **Step 3: Verify no emojis remain in these files**

```bash
grep -rn '[^\x00-\x7F]' \
  frontend/src/pages/Dashboard.js \
  frontend/src/pages/Gymnasts.js \
  frontend/src/pages/Certificates.js \
  frontend/src/pages/CertificateDesigner.js \
  frontend/src/pages/CertificatePreview.js \
  frontend/src/pages/CustomFields.js \
  frontend/src/pages/Health.js \
  frontend/src/pages/SuperAdmin.js \
  frontend/src/pages/Levels.js \
  frontend/src/pages/Branding.js \
  | grep -v "console\." | grep -v "\/\/"
```

Expected: no output (or only console.log / comment lines)

- [ ] **Step 4: Build passes**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.js \
        frontend/src/pages/Gymnasts.js \
        frontend/src/pages/Certificates.js \
        frontend/src/pages/CertificateDesigner.js \
        frontend/src/pages/CertificatePreview.js \
        frontend/src/pages/CustomFields.js \
        frontend/src/pages/Health.js \
        frontend/src/pages/SuperAdmin.js \
        frontend/src/pages/Levels.js \
        frontend/src/pages/Branding.js
git commit -m "style: remove emojis from all tracking page headings and labels"
```

---

## Final verification

- [ ] `npm run build` passes with no new errors
- [ ] Push to remote: `git push`
