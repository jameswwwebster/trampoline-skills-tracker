# AdminMembers Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the AdminMembers page for mobile readability, removing duplication and restructuring information by importance — gymnast compliance status front-and-centre, secondary details behind an expander.

**Architecture:** Backend adds `hasPendingBg` to the members list endpoint by checking gymnast BG statuses. The frontend replaces the current list row (which truncates) with a clean name+role+alert design, and replaces the accordion detail (which repeats name/email and presents all gymnast info at equal weight) with a profile bar + gymnast-first card layout where compliance badges are always visible and lower-frequency fields (health notes, membership management, remove) live behind a collapsible expander.

**Tech Stack:** Express + Prisma (backend), React 18 (frontend), existing `booking-shared.css` + inline styles.

**Spec:** `docs/superpowers/specs/2026-03-10-admin-members-redesign.md`

---

## Chunk 1: Backend

### Task 1: Add `hasPendingBg` to GET /api/users

**Files:**
- Modify: `backend/routes/users.js:90-121` (gymnasts query — add bgNumberStatus to select)
- Modify: `backend/routes/users.js:138-144` (usersWithCustomFields map — add hasPendingBg)
- Create: `backend/__tests__/admin.users.hasPendingBg.test.js`

**Context:** `GET /api/users` is at line 47 of `backend/routes/users.js`. It already fetches all gymnasts in the club. We just need to include `bgNumberStatus` in the gymnast select, build a set of guardian user IDs whose gymnasts have a PENDING status, then stamp `hasPendingBg` on each user.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/admin.users.hasPendingBg.test.js`:

```js
const request = require('supertest');
const app = require('../server');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

let club, admin, adminToken, parent, parentToken;

beforeEach(async () => {
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `admin-${Date.now()}@test.tl` });
  adminToken = tokenFor(admin);
  parent = await createParent(club);
  parentToken = tokenFor(parent);
});

afterEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); });

test('hasPendingBg is false when gymnast has no pending BG number', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'VERIFIED' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user).toBeDefined();
  expect(user.hasPendingBg).toBe(false);
});

test('hasPendingBg is true when any gymnast of that user has PENDING BG status', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'PENDING', bgNumber: 'BG111' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user).toBeDefined();
  expect(user.hasPendingBg).toBe(true);
});

test('hasPendingBg is false when gymnast is INVALID not PENDING', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'INVALID', bgNumber: 'BG222' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user.hasPendingBg).toBe(false);
});

test('hasPendingBg requires CLUB_ADMIN auth', async () => {
  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${parentToken}`);
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- --testPathPattern=admin.users.hasPendingBg --verbose 2>&1 | tail -20
```

Expected: 4 failing tests (hasPendingBg field not yet present).

- [ ] **Step 3: Add bgNumberStatus to gymnasts select**

In `backend/routes/users.js`, find the gymnasts `findMany` select (around line 94). Add `bgNumberStatus` and `bgNumber`:

```js
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        createdAt: true,
        bgNumber: true,        // ADD
        bgNumberStatus: true,  // ADD
        guardians: { select: { id: true } },
        user: {
          select: {
            email: true,
            customFieldValues: {
```

- [ ] **Step 4: Build the pendingBgGuardianIds set and stamp hasPendingBg**

Immediately after the gymnasts query (after line 121, before the `gymnastsAsUsers` map), add:

```js
    // Build set of user IDs who have at least one gymnast with PENDING BG status.
    // Covers both child gymnasts (linked via guardians) and adult participants (linked via userId).
    const pendingBgGuardianIds = new Set();
    gymnasts.forEach(g => {
      if (g.bgNumberStatus === 'PENDING') {
        g.guardians.forEach(guardian => pendingBgGuardianIds.add(guardian.id));
        if (g.userId) pendingBgGuardianIds.add(g.userId); // adult participant
      }
    });
```

Then in the `usersWithCustomFields` map (around line 138), add `hasPendingBg`:

```js
    const usersWithCustomFields = users.map(user => ({
      ...user,
      confirmedBookings: user.bookings.filter(b => b.status === 'CONFIRMED').length,
      cancelledBookings: user.bookings.filter(b => b.status === 'CANCELLED').length,
      bookings: undefined,
      customFieldValues: user.customFieldValues || [],
      hasPendingBg: pendingBgGuardianIds.has(user.id),  // ADD
    }));
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npm test -- --testPathPattern=admin.users.hasPendingBg --verbose 2>&1 | tail -20
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/users.js backend/__tests__/admin.users.hasPendingBg.test.js
git commit -m "feat: add hasPendingBg to GET /api/users member list"
```

---

## Chunk 2: Frontend list row

### Task 2: Redesign the AdminMembers list row

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js` — `AdminMembers` component and `load` function only (lines ~1073–1332)

**Context:** The `load` function builds `childrenByUser` as a name-string map. We need a parallel `gymnastsCountByUser` map (userId → count). The list row currently shows name + email on the left and role + stats (bookings, last login) on the right. Replace with: name + role badge + optional BG pending badge on the left, gymnast count subtitle, chevron on the right. `hasPendingBg` now comes from the API response directly.

- [ ] **Step 1: Add gymnastsCountByUser state and populate it in load**

In the `AdminMembers` component, add state:

```js
const [gymnastsCountByUser, setGymnastsCountByUser] = useState({});
```

In the `load` function, after building the `childrenByUser` map, add:

```js
        // Build gymnast count per guardian
        const countMap = {};
        gymnasts.forEach(g => {
          (g.guardianIds || []).forEach(uid => {
            countMap[uid] = (countMap[uid] || 0) + 1;
          });
        });
        setGymnastsCountByUser(countMap);
```

- [ ] **Step 2: Replace the list row render**

Find the `paginated.map(u => { ... })` block (around line 1221) and replace the entire `<button>` element (the row trigger) with:

```jsx
<button
  onClick={() => setSelectedId(prev => prev === u.id ? null : u.id)}
  style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '0.75rem 1rem', textAlign: 'left', font: 'inherit',
    cursor: 'pointer',
    border: `2px solid ${isSelected ? 'var(--booking-accent)' : 'var(--booking-border)'}`,
    borderRadius: isSelected ? 'var(--booking-radius) var(--booking-radius) 0 0' : 'var(--booking-radius)',
    borderBottom: isSelected ? 'none' : undefined,
    background: isSelected ? 'rgba(124,53,232,0.06)' : 'var(--booking-bg-white)',
    transition: 'border-color 0.15s, background 0.15s',
    opacity: u.isArchived ? 0.5 : 1,
  }}
>
  <div style={{ minWidth: 0, flex: 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.firstName} {u.lastName}</span>
      <span style={{
        fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
        background: 'rgba(124,53,232,0.1)', color: 'var(--booking-accent)',
      }}>
        {ROLE_LABELS[u.role] ?? u.role}
      </span>
      {u.hasPendingBg && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
          background: 'rgba(230,126,34,0.12)', color: '#e67e22',
        }}>
          ⚠ BG pending
        </span>
      )}
    </div>
    <div style={{ fontSize: '0.75rem', color: 'var(--booking-text-muted)', marginTop: '0.1rem' }}>
      {(() => {
        const count = gymnastsCountByUser[u.id] || 0;
        return count === 1 ? '1 gymnast' : `${count} gymnasts`;
      })()}
    </div>
  </div>
  <span style={{
    fontSize: '0.8rem', color: isSelected ? 'var(--booking-accent)' : 'var(--booking-text-muted)',
    display: 'inline-block', transition: 'transform 0.2s',
    flexShrink: 0, marginLeft: '0.75rem',
  }}>
    {isSelected ? '▴' : '▾'}
  </span>
</button>
```

- [ ] **Step 3: Verify in browser**

Run `cd frontend && npm start`, open the Members admin page. Confirm:
- Rows show name + role badge
- Rows with a gymnast having PENDING BG show the orange badge
- Subtitle shows "X gymnasts" (or "1 gymnast")
- Nothing is truncated on a narrow viewport (~375px)
- Archived members appear at 0.5 opacity

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: redesign AdminMembers list row — name/role/BG badge, gymnast count subtitle"
```

---

## Chunk 3: MemberDetail profile section

### Task 3: Redesign MemberDetail — profile, credits, actions

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js` — `MemberDetail` component (lines ~758–1062)

**Context:** `MemberDetail` currently renders a gradient header (repeating name/email), then a profile card (repeating name/email again), then a credits card. Replace with: a single profile section as a key/value list (email, phone, role, member since, credits toggle), with credits expanding inline and all actions (edit, reset pw, remove) at the bottom of the section. Remove the gradient header entirely. The `EditProfileForm`, `RoleSelector`, `AssignCreditForm` sub-components are reused unchanged.

- [ ] **Step 1: Add creditsOpen state to MemberDetail**

In `MemberDetail`, add to the existing state declarations:

```js
const [creditsOpen, setCreditsOpen] = useState(false);
```

- [ ] **Step 2: Replace the MemberDetail render**

Replace everything inside the `return (` of `MemberDetail` (the full JSX, from `<div>` through closing `</div>`) with the following. Keep all the existing handler functions (`handlePasswordReset`, `handleRemoveMember`, `handleAddChild`, `load`) unchanged — only the JSX changes.

```jsx
return (
  <div>
    {/* ── Profile section ─────────────────────────── */}
    <div className="bk-card" style={{ marginBottom: '1rem' }}>
      {editingProfile ? (
        <EditProfileForm member={member} onDone={() => { setEditingProfile(false); load(); }} />
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {[
              { key: 'Email', val: member.email },
              {
                key: 'Phone', val: member.phone
                  ? <a href={`tel:${member.phone}`} style={{ color: 'var(--booking-accent)' }}>{member.phone}</a>
                  : <span style={{ color: 'var(--booking-danger)' }}>No phone number</span>
              },
              {
                key: 'Role', val: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {ROLE_LABELS[member.role] ?? member.role}
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', border: '1px solid var(--booking-border)' }}
                      onClick={() => setEditingRole(v => !v)}
                    >
                      Change
                    </button>
                  </span>
                )
              },
              {
                key: 'Member since',
                val: new Date(member.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              },
              {
                key: 'Credits', val: totalCredits > 0
                  ? (
                    <button
                      onClick={() => setCreditsOpen(v => !v)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--booking-accent)', fontWeight: 600, fontSize: '0.875rem' }}
                    >
                      £{(totalCredits / 100).toFixed(2)} {creditsOpen ? '▴' : '▾'}
                    </button>
                  )
                  : <span className="bk-muted">No credits</span>
              },
              // Note: + Assign credit button is rendered below the list always (see below)
            ].map(({ key, val }) => (
              <li key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)',
                gap: '0.75rem', fontSize: '0.875rem',
              }}>
                <span style={{ color: 'var(--booking-text-muted)', flexShrink: 0 }}>{key}</span>
                <span style={{ textAlign: 'right' }}>{val}</span>
              </li>
            ))}
          </ul>

          {member.isArchived && (
            <span style={{
              display: 'inline-block', marginTop: '0.5rem',
              fontSize: '0.75rem', fontWeight: 600, padding: '1px 8px', borderRadius: 4,
              background: 'rgba(231,76,60,0.1)', color: 'var(--booking-danger)',
            }}>
              Archived
            </span>
          )}

          {/* Credits inline expand — only when there are credits to show */}
          {creditsOpen && totalCredits > 0 && (
            <div style={{
              marginTop: '0.5rem', background: 'rgba(124,53,232,0.05)',
              border: '1px solid rgba(124,53,232,0.15)', borderRadius: 'var(--booking-radius)',
              padding: '0.65rem 0.75rem',
            }}>
              {member.credits.map(c => (
                <div key={c.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.875rem', padding: '0.2rem 0',
                  borderBottom: '1px solid var(--booking-bg-light)',
                }}>
                  <span>£{(c.amount / 100).toFixed(2)}</span>
                  <span className="bk-muted">Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Assign credit — always accessible regardless of current balance */}
          <div style={{ marginTop: '0.5rem' }}>
            {assigningCredit ? (
              <AssignCreditForm userId={member.id} onDone={() => { setAssigningCredit(false); load(); }} />
            ) : (
              <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setAssigningCredit(true)}>
                + Assign credit
              </button>
            )}
          </div>

          {/* Role change inline */}
          {editingRole && (
            <RoleSelector member={member} onDone={() => { setEditingRole(false); load(); }} />
          )}

          {/* Password reset message */}
          {resetMessage && (
            <p style={{
              margin: '0.4rem 0 0', fontSize: '0.8rem',
              color: resetMessage.type === 'success' ? 'var(--booking-success)' : 'var(--booking-danger)',
            }}>
              {resetMessage.text}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
            <button
              className="bk-btn bk-btn--sm"
              style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setEditingProfile(true)}
            >
              Edit profile
            </button>
            <button
              className="bk-btn bk-btn--sm"
              style={{ border: '1px solid var(--booking-border)' }}
              disabled={sendingReset}
              onClick={handlePasswordReset}
            >
              {sendingReset ? 'Sending…' : '↺ Password reset'}
            </button>
            {!confirmRemoveMember ? (
              <button
                className="bk-btn bk-btn--sm"
                style={{ color: 'var(--booking-danger)', border: '1px solid rgba(231,76,60,0.4)' }}
                onClick={() => setConfirmRemoveMember(true)}
              >
                Remove member
              </button>
            ) : (
              <div style={{
                width: '100%', marginTop: '0.25rem',
                background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.3)',
                borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem',
              }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
                  Remove {member.firstName} and all their children? This cannot be undone.
                </p>
                {removeError && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{removeError}</p>}
                <div className="bk-row" style={{ gap: '0.4rem' }}>
                  <button
                    className="bk-btn bk-btn--sm" disabled={removing}
                    style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                    onClick={handleRemoveMember}
                  >
                    {removing ? 'Removing...' : 'Confirm remove'}
                  </button>
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ border: '1px solid var(--booking-border)' }}
                    onClick={() => { setConfirmRemoveMember(false); setRemoveError(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>

    {/* ── Gymnasts section ─────────────────────────── */}
    <div className="bk-card">
      <div className="bk-row bk-row--between" style={{ marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
          Gymnasts
        </h4>
        {!showAddChild && (
          <button className="bk-btn bk-btn--sm bk-btn--primary" onClick={() => setShowAddChild(true)}>
            + Add child
          </button>
        )}
      </div>

      {member.gymnasts.length === 0 && !showAddChild && (
        <p className="bk-muted" style={{ margin: '0 0 0.5rem' }}>No gymnasts linked.</p>
      )}

      {[...member.gymnasts].sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0)).map(g => (
        <GymnastRow key={g.id} g={g} memberships={memberships} onUpdated={load} />
      ))}

      {showAddChild && (
        <form
          onSubmit={handleAddChild}
          style={{
            marginTop: member.gymnasts.length > 0 ? '0.75rem' : 0,
            paddingTop: member.gymnasts.length > 0 ? '0.75rem' : 0,
            borderTop: member.gymnasts.length > 0 ? '1px solid var(--booking-bg-light)' : 'none',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Add child</p>
          <div className="bk-grid-2" style={{ marginBottom: '0.5rem' }}>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>First name
              <input className="bk-input" value={addChildForm.firstName}
                onChange={e => setAddChildForm(f => ({ ...f, firstName: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Last name
              <input className="bk-input" value={addChildForm.lastName}
                onChange={e => setAddChildForm(f => ({ ...f, lastName: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
          </div>
          <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem', marginBottom: '0.5rem', display: 'block' }}>
            Date of birth
            <input type="date" className="bk-input" value={addChildForm.dateOfBirth}
              onChange={e => setAddChildForm(f => ({ ...f, dateOfBirth: e.target.value }))}
              required style={{ marginTop: '0.2rem' }} />
          </label>
          <fieldset style={{ border: 'none', padding: 0, margin: '0.5rem 0 0' }}>
            <label className="bk-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'normal' }}>
              <input type="checkbox" checked={addChildForm.healthNotesNone}
                onChange={e => setAddChildForm(f => ({ ...f, healthNotesNone: e.target.checked }))}
                className="bk-checkbox" />
              No known health issues or learning differences
            </label>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>
              Health issues or learning differences
              <textarea className="bk-input" value={addChildForm.healthNotes}
                disabled={addChildForm.healthNotesNone}
                onChange={e => setAddChildForm(f => ({ ...f, healthNotes: e.target.value }))}
                rows={2}
                placeholder="Describe any conditions or confirm none above"
                style={{ marginTop: '0.2rem', opacity: addChildForm.healthNotesNone ? 0.5 : 1 }} />
            </label>
          </fieldset>
          {addChildError && <p className="bk-error">{addChildError}</p>}
          <div className="bk-row" style={{ gap: '0.4rem' }}>
            <button type="submit" disabled={addingChild} className="bk-btn bk-btn--sm bk-btn--primary">
              {addingChild ? 'Adding...' : 'Add child'}
            </button>
            <button type="button" className="bk-btn bk-btn--sm"
              style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => {
                setShowAddChild(false);
                setAddChildForm({ firstName: '', lastName: '', dateOfBirth: '', healthNotes: '', healthNotesNone: false });
                setAddChildError(null);
              }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
);
```

- [ ] **Step 3: Verify in browser**

Open a member's detail panel. Confirm:
- No gradient header — profile goes straight to key/value list
- Email and phone are on separate rows
- Credits row shows `£X.XX ▾`; clicking expands inline with credit lines and assign button
- Edit profile / Password reset / Remove member are buttons at the bottom
- Remove member shows a two-step confirmation inline
- Gymnasts section still renders (may look identical to current at this stage — Task 4 redesigns it)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: redesign MemberDetail profile section — key/value list, inline credits, actions at bottom"
```

---

## Chunk 4: GymnastRow redesign

### Task 4: Redesign GymnastRow — compliance info list + details expander

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js` — `GymnastRow` component and `BgNumberAdminRow` component (lines ~204–461)

**Context:** `GymnastRow` currently renders everything at equal visual weight. Replace with: card with orange tint when issues exist, name + membership badge header, key/value info list (DOB with inline edit, consents, BG insurance, emergency contact for `isSelf`), inline BG action bar for PENDING/INVALID, and a `▸ Details` expander (collapsed by default) containing health notes, `GymnastMembership`, and remove child. `BgNumberAdminRow` is replaced by a simpler inline `BgActionBar` component defined alongside `GymnastRow`. The existing `GymnastMembership` sub-component is kept unchanged.

**Membership badge values:**

| status | label | style |
|---|---|---|
| ACTIVE | `Active £X/mo` | green |
| PAUSED | `Paused £X/mo` | orange |
| PENDING_PAYMENT | `Pending payment` | orange |
| SCHEDULED | `Scheduled £X/mo` | purple |
| CANCELLED / none | `Ad-hoc` | muted |

- [ ] **Step 1: Add RemoveChild helper component**

Add this component immediately before the `GymnastRow` function definition (replacing `BgNumberAdminRow` location):

```jsx
function RemoveChild({ gymnast: g, onUpdated }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await bookingApi.deleteGymnast(g.id);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove gymnast.');
      setRemoving(false);
    }
  };

  if (!confirming) return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <button className="bk-btn bk-btn--sm"
        style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)', fontSize: '0.78rem' }}
        onClick={() => setConfirming(true)}>
        Remove child
      </button>
    </div>
  );

  return (
    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--booking-radius)', padding: '0.5rem 0.75rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--booking-danger)' }}>
          Remove {g.firstName} {g.lastName}? This will delete all their booking history.
        </p>
        {error && <p className="bk-error" style={{ marginBottom: '0.4rem' }}>{error}</p>}
        <div className="bk-row" style={{ gap: '0.4rem' }}>
          <button className="bk-btn bk-btn--sm" disabled={removing}
            style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
            onClick={handleRemove}>{removing ? 'Removing...' : 'Confirm remove'}</button>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => { setConfirming(false); setError(null); }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add BgActionBar component (replaces BgNumberAdminRow)**

Add this new component immediately after `RemoveChild`:


```jsx
function BgActionBar({ gymnast, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(gymnast.bgNumber || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSet = async () => {
    if (!input.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await bookingApi.setBgNumber(gymnast.id, input.trim());
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (action) => {
    setSaving(true);
    setError(null);
    try {
      await bookingApi.verifyBgNumber(gymnast.id, action);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(230,126,34,0.08)', border: '1px solid rgba(230,126,34,0.25)',
      borderRadius: 'var(--booking-radius)', padding: '0.4rem 0.6rem',
      marginTop: '0.35rem', fontSize: '0.75rem',
    }}>
      {editing ? (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="bk-input"
            style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', padding: '0.2rem 0.4rem' }}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="BG number"
            autoFocus
          />
          <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving || !input.trim()} onClick={handleSet} style={{ fontSize: '0.75rem' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)', fontSize: '0.75rem' }} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : gymnast.bgNumberStatus === 'PENDING' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace' }}>{gymnast.bgNumber}</span>
          <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving} onClick={() => handleVerify('verify')} style={{ fontSize: '0.75rem' }}>
            Verify
          </button>
          <button className="bk-btn bk-btn--sm" disabled={saving}
            style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)', fontSize: '0.75rem' }}
            onClick={() => handleVerify('invalidate')}>
            Mark invalid
          </button>
          <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)', fontSize: '0.75rem' }} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      ) : (
        /* INVALID state */
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {gymnast.bgNumber && <span style={{ fontFamily: 'monospace', color: 'var(--booking-danger)' }}>{gymnast.bgNumber}</span>}
          <button className="bk-btn bk-btn--sm bk-btn--primary" style={{ fontSize: '0.75rem' }} onClick={() => { setInput(gymnast.bgNumber || ''); setEditing(true); }}>
            Edit BG number
          </button>
        </div>
      )}
      {error && <p style={{ color: 'var(--booking-danger)', fontSize: '0.78rem', margin: '0.3rem 0 0' }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Replace GymnastRow**

Replace the entire `GymnastRow` function (lines ~301–461) with:

```jsx
const MEMBERSHIP_BADGE = {
  ACTIVE:          (m) => ({ label: `Active £${(m.monthlyAmount/100).toFixed(2)}/mo`,  color: 'var(--booking-success)', bg: 'rgba(39,174,96,0.12)' }),
  PAUSED:          (m) => ({ label: `Paused £${(m.monthlyAmount/100).toFixed(2)}/mo`,  color: '#e67e22', bg: 'rgba(230,126,34,0.12)' }),
  PENDING_PAYMENT: ()  => ({ label: 'Pending payment',                                  color: '#e67e22', bg: 'rgba(230,126,34,0.12)' }),
  SCHEDULED:       (m) => ({ label: `Scheduled £${(m.monthlyAmount/100).toFixed(2)}/mo`, color: '#7c35e8', bg: 'rgba(124,53,232,0.1)' }),
};

function GymnastRow({ g, memberships, onUpdated }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingDob, setEditingDob] = useState(false);
  const [dobValue, setDobValue] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobError, setDobError] = useState(null);

  const handleSaveDob = async () => {
    if (!dobValue) return;
    setDobSaving(true);
    setDobError(null);
    try {
      await bookingApi.updateGymnast(g.id, {
        firstName: g.firstName,
        lastName: g.lastName,
        dateOfBirth: dobValue,
      });
      setEditingDob(false);
      onUpdated();
    } catch (err) {
      setDobError(err.response?.data?.error || 'Failed to save.');
      setDobSaving(false);
    }
  };

  const membership = memberships.find(m => m.gymnastId === g.id && m.status !== 'CANCELLED') ?? null;
  const badgeFn = membership ? MEMBERSHIP_BADGE[membership.status] : null;
  const badge = badgeFn ? badgeFn(membership) : { label: 'Ad-hoc', color: 'var(--booking-text-muted)', bg: 'var(--booking-bg-light)' };

  const bgInsuranceRequired = (g.pastSessionCount ?? 0) >= 2 || !!membership;

  const getConsentValue = (type) => g.consents?.find(c => c.type === type)?.granted;

  const hasIssues = (
    g.bgNumberStatus === 'PENDING' ||
    g.bgNumberStatus === 'INVALID' ||
    !g.dateOfBirth ||
    (bgInsuranceRequired && !g.bgNumber) ||
    (g.isSelf && !g.emergencyContactName)
  );

  const infoItemStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '0.25rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)',
    gap: '0.75rem', fontSize: '0.82rem',
  };
  const keyStyle = { color: 'var(--booking-text-muted)', flexShrink: 0 };

  const bgInsuranceDisplay = () => {
    if (!bgInsuranceRequired && !g.bgNumber) return null;
    if (g.bgNumberStatus === 'VERIFIED') return (
      <span style={{ color: 'var(--booking-success)' }}>
        ✓ Verified{g.bgNumber && <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem', fontSize: '0.78rem', color: 'var(--booking-text-muted)' }}>{g.bgNumber}</span>}
      </span>
    );
    if (g.bgNumberStatus === 'PENDING') return (
      <span style={{ color: '#e67e22' }}>
        ⚠ Pending{g.bgNumber && <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem', fontSize: '0.78rem' }}>{g.bgNumber}</span>}
      </span>
    );
    if (g.bgNumberStatus === 'INVALID') return (
      <span style={{ color: 'var(--booking-danger)' }}>
        ✗ Invalid{g.bgNumber && <span style={{ fontFamily: 'monospace', marginLeft: '0.4rem', fontSize: '0.78rem' }}>{g.bgNumber}</span>}
      </span>
    );
    return <span style={{ color: 'var(--booking-danger)' }}>✗ Not provided</span>;
  };

  const detailsLabel = g.isSelf
    ? 'Emergency contact, health notes, membership, remove'
    : 'Health notes, membership, remove';

  return (
    <div style={{
      background: hasIssues ? '#fffaf5' : '#f9f8ff',
      border: `1px solid ${hasIssues ? 'rgba(230,126,34,0.4)' : '#e8e0ff'}`,
      borderRadius: 'var(--booking-radius)',
      padding: '0.75rem',
      marginBottom: '0.5rem',
    }}>
      {/* Header: name + membership badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>
          {g.firstName} {g.lastName}
          {g.isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 400, color: 'var(--booking-text-muted)' }}>Adult participant</span>}
        </strong>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '1px 8px', borderRadius: 4, background: badge.bg, color: badge.color, flexShrink: 0 }}>
          {badge.label}
        </span>
      </div>

      {/* Info list */}
      <ul style={{ listStyle: 'none', margin: '0 0 0.4rem', padding: 0 }}>
        {/* DOB */}
        <li style={infoItemStyle}>
          <span style={keyStyle}>DOB</span>
          <span>
            {editingDob ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <input type="date" className="bk-input"
                  style={{ fontSize: '0.82rem', padding: '0.2rem 0.4rem', width: 'auto' }}
                  value={dobValue} onChange={e => setDobValue(e.target.value)} autoFocus />
                <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={dobSaving || !dobValue} onClick={handleSaveDob} style={{ fontSize: '0.75rem' }}>
                  {dobSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="bk-btn bk-btn--sm" onClick={() => { setEditingDob(false); setDobError(null); }} style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}>
                  Cancel
                </button>
                {dobError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{dobError}</span>}
              </span>
            ) : g.dateOfBirth ? (
              <span>
                {new Date(g.dateOfBirth).toLocaleDateString('en-GB')}
                {' '}
                <button onClick={() => { setEditingDob(true); setDobValue(new Date(g.dateOfBirth).toISOString().slice(0, 10)); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0 }}>
                  Edit
                </button>
              </span>
            ) : (
              <span style={{ color: 'var(--booking-danger)' }}>
                Missing{' '}
                <button onClick={() => { setEditingDob(true); setDobValue(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-accent)', fontSize: '0.75rem', padding: 0, fontWeight: 600 }}>
                  Set
                </button>
              </span>
            )}
          </span>
        </li>
        {/* Consents */}
        <li style={infoItemStyle}>
          <span style={keyStyle}>Coaching photos</span>
          {getConsentValue('photo_coaching')
            ? <span style={{ color: 'var(--booking-success)' }}>✓ Allowed</span>
            : <span style={{ color: 'var(--booking-danger)' }}>✗ Not allowed</span>}
        </li>
        <li style={infoItemStyle}>
          <span style={keyStyle}>Social media</span>
          {getConsentValue('photo_social_media')
            ? <span style={{ color: 'var(--booking-success)' }}>✓ Allowed</span>
            : <span style={{ color: 'var(--booking-danger)' }}>✗ Not allowed</span>}
        </li>
        {/* BG insurance */}
        {(bgInsuranceRequired || g.bgNumber) && (
          <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
            <span style={keyStyle}>BG insurance</span>
            {bgInsuranceDisplay()}
          </li>
        )}
        {/* Emergency contact (adult participants only) */}
        {g.isSelf && (
          <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
            <span style={keyStyle}>Emergency contact</span>
            {g.emergencyContactName
              ? <span style={{ color: 'var(--booking-success)' }}>✓ On file</span>
              : <span style={{ color: 'var(--booking-danger)' }}>✗ Missing</span>}
          </li>
        )}
      </ul>

      {/* BG action bar (PENDING or INVALID) */}
      {(g.bgNumberStatus === 'PENDING' || g.bgNumberStatus === 'INVALID') && (
        <BgActionBar gymnast={g} onUpdated={onUpdated} />
      )}

      {/* Details expander */}
      <button
        onClick={() => setDetailsOpen(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem 0 0',
          color: 'var(--booking-accent)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: detailsOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
        {detailsLabel}
      </button>

      {detailsOpen && (
        <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {/* Emergency contact details (adult participants only) */}
          {g.isSelf && g.emergencyContactName && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
              <p style={{ margin: '0 0 0.15rem', fontWeight: 600 }}>{g.emergencyContactName}{g.emergencyContactRelationship && ` (${g.emergencyContactRelationship})`}</p>
              <a href={`tel:${g.emergencyContactPhone}`} style={{ color: 'var(--booking-accent)' }}>{g.emergencyContactPhone}</a>
            </div>
          )}

          {/* Health notes */}
          <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--booking-text-muted)', fontWeight: 600 }}>
              Health notes
            </p>
            <p style={{ margin: 0, color: g.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
              {g.healthNotes === 'none'
                ? 'No known health issues or learning differences'
                : g.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
            </p>
          </div>

          {/* Membership management */}
          <GymnastMembership gymnast={g} membership={membership} onRefresh={onUpdated} />

          {/* Remove child */}
          {!g.isSelf && <RemoveChild gymnast={g} onUpdated={onUpdated} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Open a member with gymnasts. Confirm:
- Each gymnast shows as a card with purple tint (or orange if issues)
- DOB is listed as a row with inline Edit/Set link
- Consents are listed as `✓ Allowed` / `✗ Not allowed` rows (not badges)
- BG insurance is listed as a row with the correct status
- Adult participants (`isSelf`) show emergency contact row
- Children do not show emergency contact row
- PENDING BG shows the orange action bar with Verify / Mark invalid / Edit
- INVALID BG shows the action bar with Edit BG number
- `▸ Details` expander is collapsed by default; clicking it shows health notes, membership management, and remove child
- For adult participants, expander also shows emergency contact details at top

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: redesign GymnastRow — compliance info list, BG action bar, details expander"
```

---

## Chunk 5: Wrap-up

- [ ] **Push to remote**

```bash
git push
```

- [ ] **Smoke test the full flow**

1. Open Members admin page on mobile viewport (~375px)
2. Confirm no row data is truncated
3. Expand a member — confirm no name/email repetition in header
4. Confirm credits toggle works
5. Expand a gymnast's details — confirm health notes and membership management appear
6. Confirm BG pending badge appears in the list row for a member with a pending gymnast
7. Confirm PENDING BG action bar allows verify/invalidate
8. Confirm INVALID BG action bar allows re-entry
9. Confirm remove member and remove child both require two-step confirmation
