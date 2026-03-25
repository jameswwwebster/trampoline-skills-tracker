# Skill Tracking Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the nav so coaches get a direct "Skill Tracking" link, move tracking admin items into the Admin dropdown, and add a "Track these gymnasts" button in the coach session detail that deep-links to the gymnasts page pre-filtered to that session.

**Architecture:** Three self-contained frontend edits — nav restructure in AppLayout.js, a new button in SessionDetail.js, and URL param handling in Gymnasts.js. No backend changes. No new files.

**Tech Stack:** React 18, React Router v6 (`useNavigate`, `useSearchParams`), custom auth context (`useAuth`)

---

## File Map

| File | Change |
|---|---|
| `frontend/src/components/AppLayout.js` | Restructure desktop Tracking block; add items to desktop Admin dropdown; update mobile Tracking + Admin sections |
| `frontend/src/pages/booking/SessionDetail.js` | Import `canManageGymnasts` from `useAuth`; add "Track these gymnasts" button |
| `frontend/src/pages/Gymnasts.js` | Add one-time mount `useEffect` that reads `?session=` param, loads attendance, activates filter, strips param |

---

## Task 1: AppLayout — desktop nav

**Files:**
- Modify: `frontend/src/components/AppLayout.js`

### Desktop Tracking block (lines ~226–251)

- [ ] **Step 1: Replace the Tracking dropdown**

Find and replace this entire block:

```jsx
            {/* Tracking */}
            <div className="app-layout__dropdown">
              <button
                className={`app-layout__dropdown-btn${openDropdown === 'tracking' ? ' active' : ''}`}
                onClick={() => toggleDropdown('tracking')}
              >
                Tracking ▾
              </button>
              {openDropdown === 'tracking' && (
                <div className="app-layout__dropdown-menu">
                  {canManageGymnasts && <>
                    <NavLink to="/gymnasts" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Gymnasts</NavLink>
                    <NavLink to="/certificates" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Certificates</NavLink>
                  </>}
                  {!canManageGymnasts && !isAdult && <>
                    <NavLink to="/my-progress" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Progress</NavLink>
                    <NavLink to="/my-certificates" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Certificates</NavLink>
                  </>}
                  {isClubAdmin && <>
                    <div className="app-layout__dropdown-divider" />
                    <NavLink to="/levels" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Levels & Skills</NavLink>
                    <NavLink to="/competitions" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Competition Categories</NavLink>
                    <NavLink to="/certificate-designer" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Certificate Setup</NavLink>
                  </>}
                </div>
              )}
            </div>
```

With:

```jsx
            {/* Tracking */}
            {canManageGymnasts ? (
              <NavLink to="/gymnasts" className="app-layout__link" onClick={() => setOpenDropdown(null)}>Skill Tracking</NavLink>
            ) : (
              <div className="app-layout__dropdown">
                <button
                  className={`app-layout__dropdown-btn${openDropdown === 'tracking' ? ' active' : ''}`}
                  onClick={() => toggleDropdown('tracking')}
                >
                  Tracking ▾
                </button>
                {openDropdown === 'tracking' && (
                  <div className="app-layout__dropdown-menu">
                    {!isAdult && <>
                      <NavLink to="/my-progress" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Progress</NavLink>
                      <NavLink to="/my-certificates" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Certificates</NavLink>
                    </>}
                  </div>
                )}
              </div>
            )}
```

### Desktop Admin dropdown (lines ~332–334)

- [ ] **Step 2: Add tracking items to Admin dropdown before Audit Log divider**

Find:

```jsx
                    <div className="app-layout__dropdown-divider" />
                    <NavLink to="/booking/admin/audit-log" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Audit Log</NavLink>
```

Replace with:

```jsx
                    <div className="app-layout__dropdown-divider" />
                    <NavLink to="/certificates" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Certificates</NavLink>
                    {isClubAdmin && <>
                      <NavLink to="/levels" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Levels & Skills</NavLink>
                      <NavLink to="/competitions" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Competition Categories</NavLink>
                      <NavLink to="/certificate-designer" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Certificate Setup</NavLink>
                    </>}
                    <div className="app-layout__dropdown-divider" />
                    <NavLink to="/booking/admin/audit-log" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Audit Log</NavLink>
```

- [ ] **Step 3: Verify in browser (desktop)**
  - Log in as a coach: confirm "Skill Tracking" direct link appears in the nav and goes to `/gymnasts`
  - Confirm "Tracking ▾" dropdown is gone for coaches
  - Open Admin dropdown: confirm Certificates, Levels & Skills (admin only), Competition Categories (admin only), Certificate Setup (admin only) appear before Audit Log
  - Log in as a gymnast (non-admin): confirm "Tracking ▾" dropdown still shows My Progress / My Certificates

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.js
git commit -m "feat: restructure desktop nav — Skill Tracking link + tracking items in Admin"
```

---

## Task 2: AppLayout — mobile nav

**Files:**
- Modify: `frontend/src/components/AppLayout.js`

### Mobile Tracking section (lines ~369–382)

- [ ] **Step 1: Update mobile Tracking section**

Find:

```jsx
          <div className="app-layout__mobile-section-label">Tracking</div>
          {canManageGymnasts && <>
            <NavLink to="/gymnasts" className="app-layout__mobile-link" onClick={closeMobile}>Gymnasts</NavLink>
            <NavLink to="/certificates" className="app-layout__mobile-link" onClick={closeMobile}>Certificates</NavLink>
          </>}
          {!canManageGymnasts && !isAdult && <>
            <NavLink to="/my-progress" className="app-layout__mobile-link" onClick={closeMobile}>My Progress</NavLink>
            <NavLink to="/my-certificates" className="app-layout__mobile-link" onClick={closeMobile}>My Certificates</NavLink>
          </>}
          {isClubAdmin && <>
            <NavLink to="/levels" className="app-layout__mobile-link" onClick={closeMobile}>Levels & Skills</NavLink>
            <NavLink to="/competitions" className="app-layout__mobile-link" onClick={closeMobile}>Competition Categories</NavLink>
            <NavLink to="/certificate-designer" className="app-layout__mobile-link" onClick={closeMobile}>Certificate Setup</NavLink>
          </>}
```

Replace with:

```jsx
          <div className="app-layout__mobile-section-label">Tracking</div>
          {canManageGymnasts && (
            <NavLink to="/gymnasts" className="app-layout__mobile-link" onClick={closeMobile}>Skill Tracking</NavLink>
          )}
          {!canManageGymnasts && !isAdult && <>
            <NavLink to="/my-progress" className="app-layout__mobile-link" onClick={closeMobile}>My Progress</NavLink>
            <NavLink to="/my-certificates" className="app-layout__mobile-link" onClick={closeMobile}>My Certificates</NavLink>
          </>}
```

### Mobile Admin section (lines ~406–419)

- [ ] **Step 2: Add tracking items to mobile Admin section before Audit Log**

Find:

```jsx
            <NavLink to="/booking/admin/audit-log" className="app-layout__mobile-link" onClick={closeMobile}>Audit Log</NavLink>
```

Replace with:

```jsx
            <NavLink to="/certificates" className="app-layout__mobile-link" onClick={closeMobile}>Certificates</NavLink>
            {isClubAdmin && <>
              <NavLink to="/levels" className="app-layout__mobile-link" onClick={closeMobile}>Levels & Skills</NavLink>
              <NavLink to="/competitions" className="app-layout__mobile-link" onClick={closeMobile}>Competition Categories</NavLink>
              <NavLink to="/certificate-designer" className="app-layout__mobile-link" onClick={closeMobile}>Certificate Setup</NavLink>
            </>}
            <NavLink to="/booking/admin/audit-log" className="app-layout__mobile-link" onClick={closeMobile}>Audit Log</NavLink>
```

- [ ] **Step 3: Verify in browser (mobile)**
  - Toggle mobile menu as a coach: confirm "Skill Tracking" appears under Tracking, Certificates / Levels / etc. appear under Admin
  - Toggle mobile menu as a gymnast: confirm Tracking section still shows My Progress / My Certificates

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.js
git commit -m "feat: restructure mobile nav — Skill Tracking link + tracking items in Admin"
```

---

## Task 3: SessionDetail — "Track these gymnasts" button

**Files:**
- Modify: `frontend/src/pages/booking/SessionDetail.js`

- [ ] **Step 1: Import `canManageGymnasts` from `useAuth`**

Find (line ~17):

```js
  const { user } = useAuth();
```

Replace with:

```js
  const { user, canManageGymnasts } = useAuth();
```

- [ ] **Step 2: Add the button in the session info block**

Find (lines ~178–180):

```jsx
      <div className="session-detail__info">
        <h2>{dateStr}</h2>
        <p>{session.startTime} – {session.endTime}</p>
```

Replace with:

```jsx
      <div className="session-detail__info">
        <h2>{dateStr}</h2>
        <p>{session.startTime} – {session.endTime}</p>
        {canManageGymnasts && (
          <button
            className="session-detail__add-btn"
            onClick={() => navigate(`/gymnasts?session=${instanceId}`)}
          >
            Track these gymnasts →
          </button>
        )}
```

- [ ] **Step 3: Verify in browser**
  - Log in as a coach, open a session detail page: confirm "Track these gymnasts →" button appears below the time
  - Click it: confirm navigation to `/gymnasts?session=<id>`
  - Log in as a regular member, open a session detail: confirm button is not visible

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: add Track these gymnasts button in coach session detail"
```

---

## Task 4: Gymnasts — handle `?session=` URL param

**Files:**
- Modify: `frontend/src/pages/Gymnasts.js`

- [ ] **Step 1: Add mount effect to handle the URL param**

Find the existing URL params effect (lines ~172–181):

```jsx
  // Check for URL parameters to highlight specific gymnast or apply filters
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && gymnasts.length > 0) {
      const targetGymnast = gymnasts.find(g => g.id === highlightId);
      if (targetGymnast) {
        setSearchTerm(`${targetGymnast.firstName} ${targetGymnast.lastName}`);
      }
    }
  }, [searchParams, gymnasts]);
```

Insert the following new effect **immediately before** that block:

```jsx
  // Handle ?session=<instanceId> deep link from "Track these gymnasts" button
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam) return;

    // Strip param from URL so refresh returns to default unfiltered state
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next, { replace: true });

    // Fetch attendees and activate the session filter
    setSelectedSessionId(sessionParam);
    setSessionLoading(true);
    bookingApi.getAttendance(sessionParam)
      .then(res => {
        setSessionGymnasts(new Set(res.data.attendees.map(a => a.gymnastId)));
        setShowSessionOnly(true);
      })
      .catch(() => {
        setError('Failed to load session attendees. Please try again.');
        setSelectedSessionId(null);
      })
      .finally(() => setSessionLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Note: Empty deps array is intentional — this runs once on mount to handle the initial URL param only. The `searchParams` reference is captured at mount time.

- [ ] **Step 2: Verify end-to-end**
  - As a coach, open a session detail for a session that has bookings
  - Click "Track these gymnasts →"
  - Confirm: lands on `/gymnasts`, the session filter is active (gymnasts in that session are shown), the `?session=` param is gone from the URL
  - Confirm: the session dropdown on the gymnasts page may show a blank option if the session isn't today's — this is expected
  - Confirm: refreshing the gymnasts page shows all gymnasts unfiltered (param was stripped)
  - Confirm: the existing manual session dropdown still works independently

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Gymnasts.js
git commit -m "feat: auto-filter gymnasts page from ?session= URL param"
```

- [ ] **Step 4: Push**

```bash
git push
```
