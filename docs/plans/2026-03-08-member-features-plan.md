# Member Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add role-change UI, health notes field on gymnasts, and A–Z filtering + pagination to member/gymnast lists.

**Architecture:** Three independent areas: (1) role management is a UI addition over an existing backend endpoint with a one-line schema fix; (2) healthNotes is a new Prisma field + migration + two form updates + two display updates; (3) A–Z + pagination is pure UI state added to AdminMembers and Gymnasts.

**Tech Stack:** Express, Prisma 5, PostgreSQL, React 18

**Design doc:** `docs/plans/2026-03-08-member-features-design.md`

---

### Task 1: Extend role endpoint to accept GYMNAST

**Files:**
- Modify: `backend/routes/users.js`

**Context:** `updateUserRoleSchema` at the top of the file currently only validates `CLUB_ADMIN`, `COACH`, `PARENT`. We need to add `GYMNAST`. The route already handles the update correctly — this is a one-line schema change plus an audit call.

**Step 1: Find and update the validation schema**

In `backend/routes/users.js`, find:

```js
const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('CLUB_ADMIN', 'COACH', 'PARENT').required()
});
```

Change to:

```js
const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('CLUB_ADMIN', 'COACH', 'PARENT', 'GYMNAST').required()
});
```

**Step 2: Add audit call to the role update route**

In the `PUT /:userId/role` handler, after the `prisma.user.update(...)` call (and before `res.json(...)`), add:

```js
await audit({
  userId: req.user.id,
  clubId: req.user.clubId,
  action: 'user.role_change',
  entityType: 'User',
  entityId: userId,
  metadata: { from: targetUser.role, to: role },
});
```

Make sure `audit` is imported at the top of the file — check if it already is. If not, add:

```js
const { audit } = require('../services/auditLogService');
```

**Step 3: Verify server starts**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend && node -e "require('./server')" 2>&1 | head -5
```

Expected: no errors.

**Step 4: Commit**

```bash
git add backend/routes/users.js
git commit -m "feat: extend role endpoint to accept GYMNAST and add audit"
```

---

### Task 2: Role selector UI in AdminMembers

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

**Context:** The profile section of `MemberDetail` (around line 350) shows the role read-only as `ROLE_LABELS[member.role]`. We need to add a separate role-change widget below that — a dropdown + Save button, not part of the existing `EditProfileForm`. The `bookingApi` object needs a new `changeRole` method first.

**Step 1: Add `changeRole` to bookingApi**

Read `frontend/src/utils/bookingApi.js`. Find the section with user/member methods and add:

```js
export const changeRole = (userId, role) =>
  api.put(`/users/${userId}/role`, { role });
```

Or if the file uses the axios pattern with `getHeaders()` directly:

```js
export function changeRole(userId, role) {
  return axios.put(`${API_URL}/users/${userId}/role`, { role }, { headers: getHeaders() });
}
```

Match whatever pattern the existing user methods use. Read the file first to confirm.

**Step 2: Add RoleSelector component to AdminMembers.js**

Add this new component near the top of the file, after `EditProfileForm`:

```jsx
const ASSIGNABLE_ROLES = [
  { value: 'CLUB_ADMIN', label: 'Admin' },
  { value: 'COACH', label: 'Coach' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'GYMNAST', label: 'Gymnast' },
];

function RoleSelector({ member, onDone }) {
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleSave = async () => {
    if (role === member.role) { onDone(); return; }
    if (role === 'CLUB_ADMIN' && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await bookingApi.changeRole(member.id, role);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change role.');
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {confirming ? (
        <div>
          <p className="bk-error" style={{ marginBottom: '0.5rem' }}>
            This gives full admin access. Are you sure?
          </p>
          <div className="bk-row">
            <button className="bk-btn bk-btn--primary bk-btn--sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : 'Yes, make admin'}
            </button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => { setConfirming(false); setRole(member.role); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="bk-label" style={{ fontWeight: 'normal' }}>
            Role
            <select className="bk-select" value={role}
              onChange={e => setRole(e.target.value)}
              style={{ marginTop: '0.25rem' }}>
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          {error && <p className="bk-error">{error}</p>}
          <div className="bk-row" style={{ marginTop: '0.5rem' }}>
            <button className="bk-btn bk-btn--primary bk-btn--sm" disabled={saving || role === member.role}
              onClick={handleSave}>
              {saving ? 'Saving...' : 'Save role'}
            </button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={onDone}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add state and rendering to MemberDetail**

In `MemberDetail`, add a new state variable after the existing ones:

```js
const [editingRole, setEditingRole] = useState(false);
```

In the profile section JSX (around line 363), find where role is displayed read-only:

```jsx
<span className="bk-muted">Role</span><span>{ROLE_LABELS[member.role] ?? member.role}</span>
```

Replace with:

```jsx
<span className="bk-muted">Role</span>
<span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
  {ROLE_LABELS[member.role] ?? member.role}
  {!editingProfile && (
    <button className="bk-btn bk-btn--sm"
      style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', border: '1px solid var(--booking-border)' }}
      onClick={() => setEditingRole(v => !v)}>
      Change
    </button>
  )}
</span>
```

Then, after the closing `</div>` of the profile grid (still inside the bk-card, after the read-only grid), add:

```jsx
{editingRole && (
  <RoleSelector
    member={member}
    onDone={() => { setEditingRole(false); load(); }}
  />
)}
```

Make sure this only appears in the non-editing-profile branch (i.e., when `editingProfile` is false).

**Step 4: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -10
```

Expected: Compiled successfully.

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js frontend/src/utils/bookingApi.js
git commit -m "feat: add role selector to member profile in admin UI"
```

---

### Task 3: Add healthNotes field — migration and schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260308000003_add_gymnast_health_notes/migration.sql`

**Step 1: Add field to Gymnast model**

In `backend/prisma/schema.prisma`, find the `Gymnast` model. Add `healthNotes` after `coachNotes`:

```prisma
coachNotes  String?
healthNotes String?
```

**Step 2: Create migration SQL**

Create `backend/prisma/migrations/20260308000003_add_gymnast_health_notes/migration.sql`:

```sql
ALTER TABLE "gymnasts" ADD COLUMN "health_notes" TEXT;
```

**Important:** Check the `@@map` on the Gymnast model to confirm the table name is `gymnasts`. The column name `health_notes` follows Prisma's snake_case convention for `healthNotes`.

**Step 3: Apply migration and regenerate**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend && ./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma generate
```

Expected: Migration applied, client regenerated.

**Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260308000003_add_gymnast_health_notes/
git commit -m "feat: add healthNotes field to Gymnast model"
```

---

### Task 4: Add healthNotes to gymnast POST routes (backend)

**Files:**
- Modify: `backend/routes/gymnasts.js`

**Context:** Two routes need updating:
- `POST /add-child` (parent adds own child) — inline Joi schema at lines 98–102
- `POST /admin-add-child` (staff adds child for a user) — inline Joi schema at lines 125–130

Both routes create a `gymnast` via `prisma.gymnast.create`. The `healthNotes` field must be required in validation and passed to Prisma.

**Step 1: Update POST /add-child**

Find the inline Joi schema:

```js
const { error, value } = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  dateOfBirth: Joi.date().required(),
}).validate(req.body);
```

Change to:

```js
const { error, value } = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  dateOfBirth: Joi.date().required(),
  healthNotes: Joi.string().min(1).required(),
}).validate(req.body);
```

Then in `prisma.gymnast.create`, add `healthNotes` to the `data` object:

```js
const gymnast = await prisma.gymnast.create({
  data: {
    firstName: value.firstName,
    lastName: value.lastName,
    dateOfBirth: value.dateOfBirth,
    healthNotes: value.healthNotes,
    clubId: req.user.clubId,
    guardians: { connect: { id: req.user.id } },
  },
});
```

**Step 2: Update POST /admin-add-child**

Same change — add `healthNotes: Joi.string().min(1).required()` to the inline schema, and `healthNotes: value.healthNotes` to the `prisma.gymnast.create` data object.

**Step 3: Verify server starts**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend && node -e "require('./server')" 2>&1 | head -5
```

Expected: no errors.

**Step 4: Commit**

```bash
git add backend/routes/gymnasts.js
git commit -m "feat: require healthNotes when creating a gymnast"
```

---

### Task 5: Health notes UI in MyChildren add-child form

**Files:**
- Modify: `frontend/src/pages/booking/MyChildren.js`

**Context:** The add-child form is around lines 404–421. Form state is `{ firstName: '', lastName: '', dateOfBirth: '' }`. `handleSubmit` calls `bookingApi.addChild(form)`.

**Step 1: Update form state initial value**

Find:
```js
const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
```

Change to:
```js
const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
```

**Step 2: Update handleSubmit to build healthNotes payload**

Find the `handleSubmit` function. Before calling `bookingApi.addChild(form)`, build the correct `healthNotes` value:

```js
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!form.healthNotesNone && !form.healthNotes.trim()) {
    setError('Please describe any health issues or learning differences, or confirm there are none.');
    return;
  }
  setSubmitting(true);
  setError(null);
  try {
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      dateOfBirth: form.dateOfBirth,
      healthNotes: form.healthNotesNone ? 'none' : form.healthNotes.trim(),
    };
    await bookingApi.addChild(payload);
    setForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
    setShowForm(false);
    load();
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to add child.');
  } finally {
    setSubmitting(false);
  }
};
```

**Step 3: Add health notes fields to the form JSX**

In the form JSX, after the date of birth field and before the error/submit, add:

```jsx
<fieldset style={{ border: 'none', padding: 0, margin: '0.75rem 0 0' }}>
  <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={form.healthNotesNone}
      onChange={e => setForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
      style={{ marginTop: '0.2rem' }}
    />
    No known health issues or learning differences
  </label>
  <label className="bk-label">Health issues or learning differences
    <textarea
      className="bk-input"
      value={form.healthNotes}
      disabled={form.healthNotesNone}
      onChange={e => setForm(f => ({ ...f, healthNotes: e.target.value }))}
      rows={3}
      placeholder="Describe any health conditions, learning differences, or anything coaches should know"
      style={{ marginTop: '0.25rem', opacity: form.healthNotesNone ? 0.5 : 1 }}
    />
  </label>
</fieldset>
```

**Step 4: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/MyChildren.js
git commit -m "feat: add health notes field to add-child form in MyChildren"
```

---

### Task 6: Health notes UI in AdminMembers add-child form

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

**Context:** The add-child form in `MemberDetail` uses `addChildForm` state (`{ firstName: '', lastName: '', dateOfBirth: '' }`) and `handleAddChild` which calls `bookingApi.adminAddChild({ userId, ...addChildForm })`.

**Step 1: Update addChildForm initial value**

Find:
```js
const [addChildForm, setAddChildForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
```

Change to:
```js
const [addChildForm, setAddChildForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
```

**Step 2: Update handleAddChild**

Find `handleAddChild`. Replace its body so it builds the correct payload:

```js
const handleAddChild = async (e) => {
  e.preventDefault();
  if (!addChildForm.healthNotesNone && !addChildForm.healthNotes.trim()) {
    setAddChildError('Please describe any health issues or learning differences, or confirm there are none.');
    return;
  }
  setAddingChild(true);
  setAddChildError(null);
  try {
    const payload = {
      userId,
      firstName: addChildForm.firstName,
      lastName: addChildForm.lastName,
      dateOfBirth: addChildForm.dateOfBirth,
      healthNotes: addChildForm.healthNotesNone ? 'none' : addChildForm.healthNotes.trim(),
    };
    await bookingApi.adminAddChild(payload);
    setShowAddChild(false);
    setAddChildForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
    load();
  } catch (err) {
    setAddChildError(err.response?.data?.error || 'Failed to add child.');
  } finally {
    setAddingChild(false);
  }
};
```

**Step 3: Add health notes fields to the add-child form JSX**

In the add-child form JSX (around lines 500–531), after the date of birth field and before the error/submit, add the same health notes fieldset as in Task 5, but using `addChildForm` and `setAddChildForm`:

```jsx
<fieldset style={{ border: 'none', padding: 0, margin: '0.5rem 0 0' }}>
  <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'normal' }}>
    <input
      type="checkbox"
      checked={addChildForm.healthNotesNone}
      onChange={e => setAddChildForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
      style={{ marginTop: '0.2rem' }}
    />
    No known health issues or learning differences
  </label>
  <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>
    Health issues or learning differences
    <textarea
      className="bk-input"
      value={addChildForm.healthNotes}
      disabled={addChildForm.healthNotesNone}
      onChange={e => setAddChildForm(f => ({ ...f, healthNotes: e.target.value }))}
      rows={2}
      placeholder="Describe any conditions or confirm none above"
      style={{ marginTop: '0.2rem', opacity: addChildForm.healthNotesNone ? 0.5 : 1 }}
    />
  </label>
</fieldset>
```

**Step 4: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: add health notes field to add-child form in AdminMembers"
```

---

### Task 7: Display healthNotes in member/child detail views

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`
- Modify: `frontend/src/pages/booking/MyChildren.js`

**Context:** Two display locations:
1. AdminMembers — the gymnast detail panel shows fields like emergency contact. `healthNotes` should appear here, visible to CLUB_ADMIN and COACH.
2. MyChildren — the `GymnastCard` component (or wherever per-child info is shown) should show `healthNotes` to the parent.

Before coding, read both files to find where gymnast/child detail is rendered. In AdminMembers, search for where `emergencyContactName` or `coachNotes` is displayed. In MyChildren, find the `GymnastCard` component.

**Step 1: Display in AdminMembers gymnast panel**

Read the gymnast detail section in `MemberDetail`. Find where `emergencyContactName` or other gymnast fields are displayed. Add a health notes display row in the same style:

```jsx
<div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
  <span className="bk-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Health notes</span>
  <span style={{ color: gymnast.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
    {gymnast.healthNotes === 'none'
      ? 'No known health issues or learning differences'
      : gymnast.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
  </span>
</div>
```

Also ensure `healthNotes` is included in the gymnast data returned by `bookingApi.getMember`. Read `backend/routes/users.js` around the `GET /:userId` route to check the gymnast select fields — add `healthNotes: true` if it isn't already included.

**Step 2: Display in MyChildren**

Find the `GymnastCard` component in `MyChildren.js`. It likely renders emergency contact and other gymnast details. Add health notes display in the same pattern as above, visible to the parent.

**Step 3: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js frontend/src/pages/booking/MyChildren.js backend/routes/users.js
git commit -m "feat: display health notes in gymnast detail views"
```

---

### Task 8: A–Z filter + pagination in AdminMembers

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

**Context:** The `AdminMembers` component has a `filtered` array (computed from `members` + `search`). The member list is rendered by mapping over `filtered`. We add A–Z filter state and pagination state, compute a `paginated` slice from `filtered`, and render the A–Z bar and pagination controls.

**Step 1: Add state**

In the `AdminMembers` component body (after the existing state declarations), add:

```js
const [letterFilter, setLetterFilter] = useState('');
const [page, setPage] = useState(1);
const PAGE_SIZE = 25;
```

**Step 2: Update filtered computation**

The existing filtered computation is:

```js
const q = search.toLowerCase();
const filtered = members.filter(u =>
  `${u.firstName} ${u.lastName} ${u.email} ${childrenByUser[u.id] || ''}`.toLowerCase().includes(q)
);
```

Add A–Z filter after the search filter:

```js
const q = search.toLowerCase();
const filtered = members.filter(u => {
  const matchesSearch = `${u.firstName} ${u.lastName} ${u.email} ${childrenByUser[u.id] || ''}`.toLowerCase().includes(q);
  const matchesLetter = !letterFilter || (u.lastName || u.firstName || '').toUpperCase().startsWith(letterFilter);
  return matchesSearch && matchesLetter;
});

const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const safePage = Math.min(page, totalPages);
const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
```

**Step 3: Reset page when filter/search changes**

Add two `useEffect` calls (or combine into one):

```js
useEffect(() => { setPage(1); }, [search, letterFilter]);
```

**Step 4: Render A–Z bar**

Find where the search input is rendered. Below it, add the A–Z bar:

```jsx
{/* A–Z filter */}
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', margin: '0.5rem 0' }}>
  <button
    className="bk-btn bk-btn--sm"
    style={{ fontWeight: letterFilter === '' ? 700 : 400, border: '1px solid var(--booking-border)', minWidth: '2rem' }}
    onClick={() => setLetterFilter('')}
  >All</button>
  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
    <button
      key={letter}
      className="bk-btn bk-btn--sm"
      style={{
        fontWeight: letterFilter === letter ? 700 : 400,
        border: '1px solid var(--booking-border)',
        background: letterFilter === letter ? 'var(--booking-accent)' : undefined,
        color: letterFilter === letter ? '#fff' : undefined,
        minWidth: '2rem',
      }}
      onClick={() => setLetterFilter(l => l === letter ? '' : letter)}
    >{letter}</button>
  ))}
</div>
```

**Step 5: Render paginated list and pagination controls**

Find where `filtered.map(u => ...)` renders the member rows. Change `filtered.map` to `paginated.map`.

After the member list (and before the closing container div), add pagination controls:

```jsx
{totalPages > 1 && (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.875rem' }}>
    <button
      className="bk-btn bk-btn--sm"
      style={{ border: '1px solid var(--booking-border)' }}
      disabled={safePage <= 1}
      onClick={() => setPage(p => p - 1)}
    >← Prev</button>
    <span style={{ color: 'var(--booking-text-muted)' }}>Page {safePage} of {totalPages}</span>
    <button
      className="bk-btn bk-btn--sm"
      style={{ border: '1px solid var(--booking-border)' }}
      disabled={safePage >= totalPages}
      onClick={() => setPage(p => p + 1)}
    >Next →</button>
  </div>
)}
```

**Step 6: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 7: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: add A-Z filter and pagination to AdminMembers"
```

---

### Task 9: A–Z filter + pagination in Gymnasts page

**Files:**
- Modify: `frontend/src/pages/Gymnasts.js`

**Context:** The Gymnasts page already has search, sort, session filter, and level/competition URL filters. Active gymnasts are in `activeGymnasts`, archived in `archivedGymnasts`. Both are already filtered and sorted arrays. Add A–Z filter and pagination to the active gymnasts list (archived gymnasts are edge-case; paginate them separately with the same component but separate page state).

**Step 1: Add state**

In the `Gymnasts` component (after existing state declarations), add:

```js
const [letterFilter, setLetterFilter] = useState('');
const [page, setPage] = useState(1);
const PAGE_SIZE = 25;
```

**Step 2: Apply A–Z filter**

Find where `activeGymnasts` and `archivedGymnasts` are computed (around line 380 — they derive from `filteredGymnasts`). After those lines, add:

```js
const letterFilteredActive = !letterFilter
  ? activeGymnasts
  : activeGymnasts.filter(g => (g.lastName || g.firstName || '').toUpperCase().startsWith(letterFilter));

const totalPages = Math.max(1, Math.ceil(letterFilteredActive.length / PAGE_SIZE));
const safePage = Math.min(page, totalPages);
const paginatedActive = letterFilteredActive.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
```

**Step 3: Reset page when filters change**

```js
useEffect(() => { setPage(1); }, [searchTerm, letterFilter, showSessionOnly]);
```

**Step 4: Render A–Z bar**

Find where the search input / sort controls are rendered. Add the same A–Z bar as in Task 8 (reuse the same JSX pattern). Place it below the existing search/sort controls.

**Step 5: Render paginated active list + pagination controls**

Find where `activeGymnasts.map(...)` renders gymnast cards. Change to `paginatedActive.map(...)`.

After the active list, add the same pagination controls as in Task 8. Use `safePage`, `totalPages`, `setPage`.

**Step 6: Verify build**

```bash
cd /Users/james/Documents/Projects/Experiments/life/frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 7: Commit**

```bash
git add frontend/src/pages/Gymnasts.js
git commit -m "feat: add A-Z filter and pagination to Gymnasts page"
```

---

### Task 10: Push to production

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Verify on production**

- Navigate to `/booking/admin/members` — confirm A–Z bar and pagination appear
- Add a child — confirm health notes field is required
- Open a member detail — confirm role Change button appears and role can be changed
- Navigate to `/gymnasts` — confirm A–Z bar and pagination appear
