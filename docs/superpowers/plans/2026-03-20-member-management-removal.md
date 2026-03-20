# Member Management Removal — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all member management pages, components, and backend routes from the skill tracker section, leaving booking's existing Members page as the sole member management UI.

**Architecture:** Pure deletion — no new code, no schema changes. Eight frontend pages, three components, three CSS files, and five backend routes are removed. Two files (App.js and Profile.js) are edited to remove stale references. Layout.js is edited to trim the Administration nav dropdown.

**Tech Stack:** React 18, React Router v6, Express, Node.js

---

## Chunk 1: Backend and App.js cleanup

### Task 1: Remove backend route files and server.js mounts

**Files:**
- Modify: `backend/server.js` (lines 17, 23, 25–27 require; lines 159, 165, 167–169 app.use)
- Delete: `backend/routes/invites.js`
- Delete: `backend/routes/guardianRequests.js`
- Delete: `backend/routes/guardianInvites.js`
- Delete: `backend/routes/import.js`
- Delete: `backend/routes/userCustomFields.js`

- [ ] **Step 1a: Remove the five `require` lines from `backend/server.js`**

Remove these exact lines (they appear in lines 17–27 of the file):

```js
// REMOVE these lines:
const inviteRoutes = require('./routes/invites');
const importRoutes = require('./routes/import');
const guardianRequestRoutes = require('./routes/guardianRequests');
const guardianInviteRoutes = require('./routes/guardianInvites');
const userCustomFieldRoutes = require('./routes/userCustomFields');
```

- [ ] **Step 1b: Remove the five `app.use` mounts from `backend/server.js`**

Remove these exact lines (they appear around lines 159–169):

```js
// REMOVE these lines:
app.use('/api/invites', inviteRoutes);
app.use('/api/import', importRoutes);
app.use('/api/guardian-requests', guardianRequestRoutes);
app.use('/api/guardian-invites', guardianInviteRoutes);
app.use('/api/user-custom-fields', userCustomFieldRoutes);
```

- [ ] **Step 1c: Delete the five route files**

```bash
rm backend/routes/invites.js
rm backend/routes/guardianRequests.js
rm backend/routes/guardianInvites.js
rm backend/routes/import.js
rm backend/routes/userCustomFields.js
```

- [ ] **Step 1d: Verify the backend starts without errors**

```bash
cd backend && node -e "require('./server.js')" 2>&1 | head -20
```

Expected: server logs startup output with no `Cannot find module` or `ReferenceError` errors.

- [ ] **Step 1e: Commit**

```bash
git add backend/server.js
git commit -m "refactor: remove member management backend routes"
```

---

### Task 2: Clean up App.js — imports, routes, title block

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 2a: Remove the eight import statements**

Remove these exact lines from the top of `frontend/src/App.js`:

```js
// REMOVE these lines (currently around lines 22–36):
import Invites from './pages/Invites';
import Users from './pages/Users';
import ImportGymnasts from './pages/ImportGymnasts';
import AcceptInvite from './pages/AcceptInvite';
import Adults from './pages/Adults';
import AdultConnectionRequest from './pages/AdultConnectionRequest';
import AdultRequests from './pages/AdultRequests';
import CustomFields from './pages/CustomFields';
```

- [ ] **Step 2b: Remove the two public route declarations**

Find and remove these two `<Route>` lines in the public routes section (~lines 171–172):

```jsx
// REMOVE these lines:
<Route path="/adult-connection-request" element={<AdultConnectionRequest />} />
<Route path="/invite/:token" element={<AcceptInvite />} />
```

- [ ] **Step 2c: Remove the six tracking route declarations**

Find and remove these six `<Route>` lines inside the `<Route element={<TrackingRoute />}>` block:

```jsx
// REMOVE these lines:
<Route path="invites" element={<Invites />} />
<Route path="users" element={<Users />} />
<Route path="import" element={<ImportGymnasts />} />
<Route path="custom-fields" element={<CustomFields />} />
<Route path="adults" element={<Adults />} />
<Route path="adult-requests" element={<AdultRequests />} />
```

- [ ] **Step 2d: Remove five stale entries from the `pathname.startsWith` title block**

The `PageMeta` function in `App.js` (~lines 91–108) has a list of pathname prefixes that set the page title to `'Tracker | Trampoline Life'`. Remove these five entries:

```js
// REMOVE these five lines from the || chain:
pathname.startsWith('/users') ||
pathname.startsWith('/invites') ||
pathname.startsWith('/import') ||
pathname.startsWith('/custom-fields') ||
pathname.startsWith('/adult-requests')
```

Leave all other entries (`/gymnasts`, `/levels`, `/competitions`, `/progress`, `/my-progress`, `/certificates`, `/my-certificates`, `/profile`, `/club-settings`, `/branding`) untouched.

- [ ] **Step 2e: Verify the frontend builds without errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully` with no errors about missing modules.

- [ ] **Step 2f: Commit**

```bash
git add frontend/src/App.js
git commit -m "refactor: remove member management routes and imports from App.js"
```

---

## Chunk 2: Frontend file deletion and component cleanup

### Task 3: Delete the page files and CSS files

> **Note:** Task 2 (Chunk 1) already removed all imports and `<Route>` declarations for these files from `App.js`. Deleting the files now will not cause any module-not-found errors.

**Files:**
- Delete: `frontend/src/pages/Users.js`
- Delete: `frontend/src/pages/Adults.js`
- Delete: `frontend/src/pages/AdultRequests.js`
- Delete: `frontend/src/pages/AdultRequests.css`
- Delete: `frontend/src/pages/Invites.js`
- Delete: `frontend/src/pages/ImportGymnasts.js`
- Delete: `frontend/src/pages/CustomFields.js`
- Delete: `frontend/src/pages/CustomFields.css`
- Delete: `frontend/src/pages/AcceptInvite.js`
- Delete: `frontend/src/pages/AdultConnectionRequest.js`
- Delete: `frontend/src/pages/AdultConnectionRequest.css`

- [ ] **Step 3a: Delete all page files and their CSS files**

```bash
rm frontend/src/pages/Users.js
rm frontend/src/pages/Adults.js
rm frontend/src/pages/AdultRequests.js
rm frontend/src/pages/AdultRequests.css
rm frontend/src/pages/Invites.js
rm frontend/src/pages/ImportGymnasts.js
rm frontend/src/pages/CustomFields.js
rm frontend/src/pages/CustomFields.css
rm frontend/src/pages/AcceptInvite.js
rm frontend/src/pages/AdultConnectionRequest.js
rm frontend/src/pages/AdultConnectionRequest.css
```

- [ ] **Step 3b: Verify the frontend still builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully` — the files have already been de-referenced in Task 2, so no import errors.

- [ ] **Step 3c: Commit**

```bash
git commit -am "refactor: delete member management page files and CSS"
```

---

### Task 4: Remove GuardianInvite from Profile.js and delete component files

**Files:**
- Modify: `frontend/src/pages/Profile.js`
- Delete: `frontend/src/components/GuardianInvite.js`
- Delete: `frontend/src/components/SendInviteForm.js`
- Delete: `frontend/src/components/InviteList.js`

- [ ] **Step 4a: Remove the GuardianInvite import from Profile.js**

Remove line 4 from `frontend/src/pages/Profile.js`:

```js
// REMOVE this line:
import GuardianInvite from '../components/GuardianInvite';
```

- [ ] **Step 4b: Remove the "Guardian Invitation" tab button from Profile.js**

Find and remove this `<button>` block (~lines 157–162):

```jsx
// REMOVE this entire button:
<button
  className={`profile-tab ${activeTab === 'guardian' ? 'active' : ''}`}
  onClick={() => setActiveTab('guardian')}
>
  Guardian Invitation
</button>
```

- [ ] **Step 4c: Remove the guardian tab panel from Profile.js**

Find and remove this block (~lines 287–289):

```jsx
// REMOVE this entire block:
{activeTab === 'guardian' && (
  <GuardianInvite />
)}
```

- [ ] **Step 4d: Delete the three component files**

```bash
rm frontend/src/components/GuardianInvite.js
rm frontend/src/components/SendInviteForm.js
rm frontend/src/components/InviteList.js
```

- [ ] **Step 4e: Verify the frontend builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully`.

- [ ] **Step 4f: Commit**

```bash
git add frontend/src/pages/Profile.js
git commit -m "refactor: remove GuardianInvite from Profile and delete orphaned components"
```

---

### Task 5: Trim the Administration dropdown in Layout.js

**Files:**
- Modify: `frontend/src/components/Layout.js`

- [ ] **Step 5a: Remove six items from the desktop Administration dropdown**

In `frontend/src/components/Layout.js`, find the desktop dropdown block that currently looks like this (around lines 128–138):

```jsx
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
```

Replace it with:

```jsx
{openDropdown === 'administration' && (
  <div className="tracker-layout__dropdown-menu">
    <NavLink to="/club-settings" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Settings</NavLink>
    <NavLink to="/branding" className="tracker-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Club Branding</NavLink>
  </div>
)}
```

- [ ] **Step 5b: Remove six items from the mobile Administration section**

In the same file, find the mobile Administration section that currently looks like this (around lines 196–208):

```jsx
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
```

Replace it with:

```jsx
{isClubAdmin && (
  <>
    <div className="tracker-layout__mobile-section-label">Administration</div>
    <NavLink to="/club-settings" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Settings</NavLink>
    <NavLink to="/branding" className="tracker-layout__mobile-link" onClick={closeMobile}>Club Branding</NavLink>
  </>
)}
```

- [ ] **Step 5c: Verify the frontend builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully`.

- [ ] **Step 5d: Manual smoke test**

Start the dev server (`cd frontend && npm start`) and log in as a club admin. Verify:
- Administration dropdown shows only "Club Settings" and "Club Branding"
- No 404 errors in the console
- Mobile menu Administration section shows only "Club Settings" and "Club Branding"
- Profile page shows only "Edit Profile" and "Change Password" tabs (no "Guardian Invitation" tab)

- [ ] **Step 5e: Commit and push**

```bash
git add frontend/src/components/Layout.js
git commit -m "refactor: trim Administration nav — remove member management links"
git push
```
