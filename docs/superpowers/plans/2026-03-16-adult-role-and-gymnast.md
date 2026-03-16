# Adult Role, Mark as Gymnast & BG Number Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the PARENT role to ADULT throughout the codebase, allow coaches to mark an adult user as a gymnast (so they can book sessions for themselves), and fix BG number entry in the admin view.

**Architecture:** Three independent changes executed in sequence. The rename is a mechanical find-replace across DB, backend, and frontend. The mark-as-gymnast feature adds one new backend endpoint and one frontend button. The BG number fix is a single frontend condition change.

**Tech Stack:** PostgreSQL (Prisma migrations), Express, React

---

## Chunk 1: PARENT → ADULT Rename

### Task 1: Database migration

**Files:**
- Create: `backend/prisma/migrations/20260316120000_rename_parent_to_adult/migration.sql`
- Modify: `backend/prisma/schema.prisma` line 713

- [ ] **Step 1: Create the migration file**

Create `backend/prisma/migrations/20260316120000_rename_parent_to_adult/migration.sql`:

```sql
ALTER TYPE "UserRole" RENAME VALUE 'PARENT' TO 'ADULT';
```

- [ ] **Step 2: Update schema.prisma**

In `backend/prisma/schema.prisma`, change the `UserRole` enum (around line 711):

```prisma
enum UserRole {
  CLUB_ADMIN
  COACH
  ADULT
  GYMNAST
  SUPER_ADMIN
}
```

- [ ] **Step 3: Apply the migration**

```bash
cd backend && npx prisma migrate deploy
```

Expected: migration applied successfully, no errors.

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd backend && npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260316120000_rename_parent_to_adult/
git commit -m "feat: rename PARENT role to ADULT in database"
```

---

### Task 2: Backend role string updates

**Files:**
- Modify: `backend/middleware/auth.js`
- Modify: `backend/routes/auth.js`
- Modify: `backend/routes/users.js`
- Modify: `backend/routes/gymnasts.js`
- Modify: `backend/routes/guardianRequests.js`
- Modify: `backend/routes/invites.js`
- Modify: `backend/routes/import.js`
- Modify: `backend/routes/progress.js`
- Modify: `backend/routes/certificates.js`
- Modify: `backend/routes/booking/bookings.js`
- Modify: `backend/routes/booking/sessions.js`
- Modify: `backend/routes/booking/commitments.js`
- Modify: `backend/services/recipientResolver.js`
- Modify: `backend/prisma/seed.js`
- Modify: `backend/__tests__/helpers/seed.js`
- Modify: `backend/__tests__/booking.attendance.test.js`
- Modify: `backend/__tests__/booking.shop.test.js`
- Modify: `backend/__tests__/parent/auth.test.js`

All changes are find-replace: `'PARENT'` → `'ADULT'` (the string literal used in role comparisons, `requireRole` arrays, and seed data).

- [ ] **Step 1: Update middleware/auth.js**

In `backend/middleware/auth.js`, replace all occurrences of `'PARENT'` with `'ADULT'`. Key location: line 193 (role-based clubId scoping check).

- [ ] **Step 2: Update auth.js**

In `backend/routes/auth.js`, replace all occurrences of `'PARENT'` with `'ADULT'`. Key locations: line 51 (role check), line 59 (default role assignment on register), line 159, line 197, line 313.

The default registration role assignment (line 59) must read:
```js
role: 'ADULT',
```

- [ ] **Step 3: Update users.js**

In `backend/routes/users.js`, replace all `'PARENT'` with `'ADULT'`. Key locations: lines 27, 604, 714, 718.

- [ ] **Step 4: Update gymnasts.js**

In `backend/routes/gymnasts.js`, replace all `'PARENT'` with `'ADULT'`. Key location: line 437.

- [ ] **Step 5: Update guardianRequests.js**

In `backend/routes/guardianRequests.js`, replace all `'PARENT'` with `'ADULT'`. Key location: line 391 (role assigned when creating a new user during guardian request approval).

- [ ] **Step 6: Update invites.js**

In `backend/routes/invites.js`, replace `'PARENT'` with `'ADULT'`. Key location: line 13.

- [ ] **Step 7: Update import.js**

In `backend/routes/import.js`, replace `'PARENT'` with `'ADULT'`. Key location: line 595.

- [ ] **Step 8: Update progress.js**

In `backend/routes/progress.js`, replace all `'PARENT'` with `'ADULT'`. Key locations: lines 579, 652, 1204.

- [ ] **Step 9: Update certificates.js**

In `backend/routes/certificates.js`, replace all `'PARENT'` with `'ADULT'`. Key locations: lines 378, 665, 744.

- [ ] **Step 10: Update booking/bookings.js**

In `backend/routes/booking/bookings.js`, replace all `'PARENT'` with `'ADULT'`. Key locations: lines 218, 483, 856.

- [ ] **Step 11: Update booking/sessions.js**

In `backend/routes/booking/sessions.js`, replace `'PARENT'` with `'ADULT'`. Key location: line 71.

- [ ] **Step 12: Update booking/commitments.js**

In `backend/routes/booking/commitments.js`, check for `'PARENT'` occurrences. Line 16 is a comment — update the comment text to read `ADULT` instead of `PARENT` if it references the role name. There is no runtime role string literal in this file.

- [ ] **Step 12b: Update recipientResolver.js**

In `backend/services/recipientResolver.js` (line 11): update the JSDoc comment that documents the accepted `role` filter values — replace `'PARENT'` with `'ADULT'`. This is documentation only, but callers rely on it to know which values are valid.

- [ ] **Step 13: Update seed.js and test seeds**

In `backend/prisma/seed.js`:
- Replace `role: 'PARENT'` with `role: 'ADULT'` (line 160)
- Update the log statement on line 169: replace `Role: PARENT` with `Role: ADULT` (this is a template literal, not a role comparison — update the text manually)

In `backend/__tests__/helpers/seed.js`, replace all `'PARENT'` with `'ADULT'`.

In `backend/__tests__/booking.attendance.test.js`, replace all `'PARENT'` with `'ADULT'`.

In `backend/__tests__/booking.shop.test.js` (line 40), replace `role: 'PARENT'` with `role: 'ADULT'`.

In `backend/__tests__/parent/auth.test.js` (line 52), replace `.toBe('PARENT')` with `.toBe('ADULT')`.

- [ ] **Step 14: Start backend and verify no startup errors**

```bash
cd backend && node index.js
```

Expected: server starts without errors. Stop with Ctrl+C.

- [ ] **Step 15: Commit**

```bash
git add backend/middleware/ backend/routes/ backend/prisma/seed.js backend/__tests__/
git commit -m "feat: rename PARENT to ADULT in all backend role checks"
```

---

### Task 3: Frontend role checks and UI strings

**Files:**
- Modify: `frontend/src/contexts/AuthContext.js`
- Modify: `frontend/src/pages/Dashboard.js`
- Modify: `frontend/src/components/Layout.js`
- Modify: `frontend/src/components/SendInviteForm.js`
- Modify: `frontend/src/components/RecipientPicker.js`
- Modify: `frontend/src/components/GuardianInvite.js`
- Modify: `frontend/src/components/AddGymnastForm.js`
- Modify: `frontend/src/pages/Users.js`
- Modify: `frontend/src/pages/Profile.js`
- Modify: `frontend/src/pages/MyCertificates.js`
- Modify: `frontend/src/pages/SuperAdmin.js`
- Modify: `frontend/src/pages/Login.js`
- Modify: `frontend/src/pages/ChildLogin.js`
- Modify: `frontend/src/pages/Gymnasts.js`
- Modify: `frontend/src/pages/MyProgress.js`
- Modify: `frontend/src/pages/booking/MyChildren.js`
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`
- Modify: `frontend/src/pages/booking/admin/AdminMessages.js`
- Modify: `frontend/src/pages/booking/admin/AdminBgNumbers.js`
- Modify: `frontend/src/pages/booking/admin/AdminHelpPage.js`
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

- [ ] **Step 1: Update AuthContext.js**

In `frontend/src/contexts/AuthContext.js`, replace all `'PARENT'` with `'ADULT'` (lines 258, 292, 293, 294).

Also rename the exported computed boolean `isParent` to `isAdult` — update both the definition (where it reads `user?.role === 'PARENT'` → `user?.role === 'ADULT'`) and the value name in the returned context object.

- [ ] **Step 2: Update all consumers of isParent**

The `isParent` computed boolean is consumed in at least these files — rename every destructured/used `isParent` to `isAdult`:

- `frontend/src/pages/MyProgress.js` (lines 29, 56, 110)
- `frontend/src/pages/Dashboard.js` (line 8 destructures `isParent` from `useAuth()`)
- `frontend/src/components/Layout.js` (line 27 destructures `isParent`, line 40 uses it)

Search for any other file using `isParent`:
```bash
grep -r "isParent" frontend/src --include="*.js" -l
```
Update every occurrence found.

- [ ] **Step 3: Update Layout.js**

In `frontend/src/components/Layout.js`, after renaming `isParent` → `isAdult` (Step 2):
- Replace all `'PARENT'` with `'ADULT'` (lines 111, 258)
- Replace any UI label "Parent" with "Adult" in nav/menu items
- Update nav link `/parent-requests` → `/adult-requests` (lines 183, 325)

- [ ] **Step 4: Update SendInviteForm.js**

In `frontend/src/components/SendInviteForm.js`:
- Line 121: replace `'PARENT'` with `'ADULT'` in the role option value
- Line 80 (prose): replace "parents" with "adults" in the invite description text (e.g. "Invite coaches and parents to join your club" → "Invite coaches and adults to join your club")
- Update any other "Parent" label text to "Adult"

- [ ] **Step 5: Update RecipientPicker.js**

In `frontend/src/components/RecipientPicker.js` (line 6): replace `'PARENT'` with `'ADULT'`. Update any display label "Parent" to "Adult".

- [ ] **Step 6: Update GuardianInvite.js**

In `frontend/src/components/GuardianInvite.js`: replace "invite a parent or guardian" with "invite an adult or guardian". Replace any other "parent" label with "adult".

- [ ] **Step 7: Update AddGymnastForm.js**

In `frontend/src/components/AddGymnastForm.js` (line 174): replace "parents/guardians" with "adults/guardians".

- [ ] **Step 8: Update Users.js**

In `frontend/src/pages/Users.js`, replace all `'PARENT'` with `'ADULT'` (lines 252, 267, 353, 378, 613, 759, 785, 1122, 1135). Also replace UI-facing strings: "Parent" role label → "Adult".

- [ ] **Step 9: Update Profile.js**

In `frontend/src/pages/Profile.js` (line 103): replace `'PARENT'` with `'ADULT'`. Update any label "Parent" to "Adult".

- [ ] **Step 10: Update MyCertificates.js**

In `frontend/src/pages/MyCertificates.js` (lines 24, 96, 114): replace `'PARENT'` with `'ADULT'`.

- [ ] **Step 11: Update SuperAdmin.js**

In `frontend/src/pages/SuperAdmin.js` (line 427): replace `'PARENT'` with `'ADULT'`.

- [ ] **Step 12: Update Login.js**

In `frontend/src/pages/Login.js` (line 79): update the demo email label from "Parent" to "Adult".

- [ ] **Step 13: Update ChildLogin.js**

In `frontend/src/pages/ChildLogin.js` (lines 174, 198): replace "Ask your parent, guardian, or coach" with "Ask your adult, guardian, or coach".

- [ ] **Step 14: Update Gymnasts.js**

In `frontend/src/pages/Gymnasts.js` (lines 1059, 1152): update any links from `/parents?highlight=...` to `/adults?highlight=...`.

- [ ] **Step 15: Update AdminMembers.js**

In `frontend/src/pages/booking/admin/AdminMembers.js` (lines 6, 10, 121, 1671, 1677, 1790, 1791, 1816):
- Replace all `'PARENT'` with `'ADULT'`
- Replace UI-facing strings: "Parent" → "Adult", "parent" → "adult"

- [ ] **Step 16: Update AdminMessages.js**

In `frontend/src/pages/booking/admin/AdminMessages.js` (lines 144, 145): replace `'PARENT'` with `'ADULT'`. Update any label "Parents" → "Adults".

- [ ] **Step 17: Update AdminBgNumbers.js**

In `frontend/src/pages/booking/admin/AdminBgNumbers.js` (line 50): replace `'PARENT'` with `'ADULT'`. Update any label "Parent" → "Adult".

- [ ] **Step 18: Update AdminHelpPage.js**

In `frontend/src/pages/booking/admin/AdminHelpPage.js`: replace all "parent"/"parents" with "adult"/"adults" throughout the help text. Do a global find-replace, then review for cases like "parental" which should become "adult guardian".

- [ ] **Step 19: Update BookingAdmin.js**

In `frontend/src/pages/booking/admin/BookingAdmin.js` (around line 338): check the "Parent: ..." label. If it refers to the user role, change it to "Adult:". If it refers to a relationship label (e.g. a booking made on behalf of a child), leave it or update it to "Booked by:" as appropriate.

- [ ] **Step 20: Update MyChildren.js**

In `frontend/src/pages/booking/MyChildren.js`: replace any "parent"/"parents" in UI strings with "adult"/"adults". Update BG number guidance text as needed.

- [ ] **Step 21: Commit**

```bash
git add frontend/src/
git commit -m "feat: rename Parent to Adult throughout frontend"
```

---

### Task 4: File renames

**Files:**
- Rename: `frontend/src/pages/Parents.js` → `Adults.js`
- Rename: `frontend/src/pages/ParentRequests.js` → `AdultRequests.js`
- Rename: `frontend/src/pages/ParentConnectionRequest.js` → `AdultConnectionRequest.js`
- Modify: `frontend/src/App.js` (route paths and component imports)
- Modify: `frontend/src/components/Layout.js` (nav link paths)

- [ ] **Step 1: Rename the JS files and any associated CSS files**

```bash
cd frontend/src/pages
mv Parents.js Adults.js
mv ParentRequests.js AdultRequests.js
mv ParentConnectionRequest.js AdultConnectionRequest.js
```

Check for co-located CSS files and rename them too:

```bash
ls ParentRequests.css ParentConnectionRequest.css Parents.css 2>/dev/null
```

If any exist, rename them to match (e.g. `mv ParentRequests.css AdultRequests.css`) and update the `import './ParentRequests.css'` statement inside the renamed JS file to reference the new CSS filename.

- [ ] **Step 2: Update imports and routes in App.js**

In `frontend/src/App.js`:

**Update the two existing imports:**
```js
// Before:
import ParentRequests from './pages/ParentRequests';
import ParentConnectionRequest from './pages/ParentConnectionRequest';

// After:
import AdultRequests from './pages/AdultRequests';
import AdultConnectionRequest from './pages/AdultConnectionRequest';
```

**Add a new import and route for Adults** (currently there is no route for `/parents` — Links to `/adults` will 404 without adding one):
```js
import Adults from './pages/Adults';
```

```jsx
<Route path="/adults" element={<Adults />} />
```

**Update the two existing route paths:**
```jsx
// Before:
<Route path="/parent-requests" element={<ParentRequests />} />
<Route path="/parent-connection-request" element={<ParentConnectionRequest />} />

// After:
<Route path="/adult-requests" element={<AdultRequests />} />
<Route path="/adult-connection-request" element={<AdultConnectionRequest />} />
```

**Update any pathname guards** (e.g. around line 103):
```js
pathname.startsWith('/parent-requests')   →   pathname.startsWith('/adult-requests')
```

- [ ] **Step 3: Update pathname guards and nav links**

In `frontend/src/App.js`, check for any `pathname.startsWith('/parent-requests')` guards or similar string comparisons keyed on the old path (e.g. around line 103). Update each to use the new path:

```js
pathname.startsWith('/parent-requests')   →   pathname.startsWith('/adult-requests')
pathname.startsWith('/parent-connection-request')   →   pathname.startsWith('/adult-connection-request')
```

In `frontend/src/components/Layout.js`, update nav links that point to the old paths:

```js
// Before (lines 183, 325):
href="/parent-requests"   →   href="/adult-requests"
href="/parents"           →   href="/adults"
```

- [ ] **Step 4: Update internal strings in the renamed files**

In `Adults.js`, `AdultRequests.js`, and `AdultConnectionRequest.js`, update:
- Page title text: "Parents" → "Adults", "Parent Requests" → "Adult Requests"
- Any remaining "parent"/"parents" string references → "adult"/"adults"
- Any functional role comparisons: `user.role === 'PARENT'` → `user.role === 'ADULT'` (e.g. line 27 of `Adults.js`)

- [ ] **Step 5: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: rename Parent pages to Adult, update routes to /adults"
```

---

## Chunk 2: Mark Adult as Gymnast + BG Number Fix

### Task 5: Backend — admin-mark-adult endpoint

**Files:**
- Modify: `backend/routes/gymnasts.js` (add new route after line 185)

- [ ] **Step 1: Add the route**

In `backend/routes/gymnasts.js`, add after the `admin-add-child` route (after line 185):

```js
// POST /api/gymnasts/admin-mark-adult
// Coach/admin creates a gymnast record for an existing adult user (no DOB required)
router.post('/admin-mark-adult', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      userId: Joi.string().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await prisma.user.findUnique({
      where: { id: value.userId },
      select: { id: true, clubId: true, firstName: true, lastName: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    // Prevent duplicate: check if user already has a gymnast record linked to them
    const existing = await prisma.gymnast.findFirst({
      where: { userId: value.userId, clubId: req.user.clubId },
    });
    if (existing) return res.status(409).json({ error: 'This user already has a gymnast record' });

    const gymnast = await prisma.gymnast.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: null,
        clubId: req.user.clubId,
        userId: value.userId,
        guardians: { connect: { id: value.userId } },
      },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'member.create', entityType: 'Gymnast', entityId: gymnast.id,
      metadata: { name: `${gymnast.firstName} ${gymnast.lastName}`, adultUserId: value.userId },
    });

    res.status(201).json(gymnast);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 2: Verify backend starts without errors**

```bash
cd backend && node index.js
```

Expected: server starts cleanly. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/gymnasts.js
git commit -m "feat: add admin-mark-adult endpoint for coach-created gymnast records"
```

---

### Task 6: Frontend — Mark as Gymnast button

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

The user detail view in AdminMembers.js already shows user info and linked gymnasts. Add a "Mark as gymnast" button that appears when the user has no gymnast record with `userId` matching themselves.

- [ ] **Step 1: Add the API call to bookingApi.js**

In `frontend/src/utils/bookingApi.js`, add a new entry following the same pattern used by neighbouring calls (e.g. `adminAddChild`):

```js
markAdultAsGymnast: (userId) =>
  axios.post(`${API_URL}/gymnasts/admin-mark-adult`, { userId }, { headers: getHeaders() }),
```

Note: the variable is `API_URL` (not `BASE_URL`), and headers are passed as `{ headers: getHeaders() }` — match the pattern used by the existing calls in this file exactly.

- [ ] **Step 2: Add the button in AdminMembers.js**

In the user detail section of `AdminMembers.js`, find where gymnast records linked to a user are displayed. Add a "Mark as gymnast" button that shows when `user.gymnasts` is empty or contains no entry where `gymnast.userId === user.id`.

Add a handler inside the relevant component:

```js
const handleMarkAsGymnast = async (userId) => {
  try {
    await bookingApi.markAdultAsGymnast(userId);
    onUpdated(); // refresh the member list
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to create gymnast record');
  }
};
```

Render the button in the user detail panel:

```jsx
{!userGymnasts.some(g => g.userId === user.id) && (
  <button
    className="bk-btn bk-btn--sm"
    style={{ marginTop: '0.5rem' }}
    onClick={() => handleMarkAsGymnast(user.id)}
  >
    Mark as gymnast
  </button>
)}
```

- [ ] **Step 3: Verify in the browser**

1. Open admin member view for an adult user with no gymnast record
2. Confirm "Mark as gymnast" button is visible
3. Click it — gymnast record should be created and the view should refresh
4. Confirm the button no longer appears after the record is created

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js frontend/src/utils/bookingApi.js
git commit -m "feat: mark adult as gymnast button in admin member view"
```

---

### Task 7: BG number entry fix

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js` (lines 798–800 and 322–329)

Currently `BgActionBar` only renders when `bgNumberStatus` is `PENDING` or `INVALID`. It should also render when there is no number yet (null status) and when the number is `VERIFIED` (to allow corrections).

- [ ] **Step 1: Remove the outer render condition**

Find this block (around line 798):

```jsx
{(g.bgNumberStatus === 'PENDING' || g.bgNumberStatus === 'INVALID') && (
  <BgActionBar gymnast={g} onUpdated={onUpdated} />
)}
```

Replace with:

```jsx
<BgActionBar gymnast={g} onUpdated={onUpdated} />
```

(Remove the condition entirely — always render `BgActionBar` for every gymnast row.)

- [ ] **Step 2: Add null/VERIFIED fallback inside BgActionBar**

Inside the `BgActionBar` component (lines 250–334), find the final `else` branch (around lines 322–329) that currently handles `INVALID`. The component's conditional structure is roughly:

```
if editing → input form
else if PENDING → show number + Verify/Mark Invalid/Edit buttons
else if INVALID → show number + Edit button
```

Replace the existing final `else` branch (the `INVALID` branch, lines 322–329) with two branches:

```jsx
) : gymnast.bgNumberStatus === 'INVALID' ? (
  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>{gymnast.bgNumber}</span>
    <button className="bk-btn bk-btn--sm bk-btn--primary" style={{ fontSize: '0.75rem' }} onClick={() => setEditing(true)}>
      Edit BG number
    </button>
  </div>
) : (
  // null (no number) or VERIFIED — show enter/edit option
  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
    {gymnast.bgNumberStatus === 'VERIFIED' && (
      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{gymnast.bgNumber}</span>
    )}
    <button className="bk-btn bk-btn--sm" style={{ fontSize: '0.75rem' }} onClick={() => setEditing(true)}>
      {gymnast.bgNumber ? 'Edit BG number' : 'Enter BG number'}
    </button>
  </div>
)}
```

- [ ] **Step 3: Verify in the browser**

1. Open the admin gymnast view for a gymnast with no BG number — "Enter BG number" button should appear
2. Enter a number — it should save and show as PENDING (orange)
3. Open the view for a gymnast with VERIFIED status — the number displays in monospace and an "Edit BG number" button appears
4. Edit the number — it saves correctly

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "fix: show BG number entry for all gymnasts, not just pending/invalid"
```

---

### Final step: push

```bash
git push
```
