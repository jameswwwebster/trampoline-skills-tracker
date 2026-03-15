# Parent UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three small fixes: prevent duplicate bookings for the same gymnast, make session spaces remaining visually prominent, and allow parents and admins to edit a gymnast's health notes.

**Architecture:** Double-booking: backend-only guard in bookings.js. Spaces: frontend inline style changes to two components. Health notes: new PATCH endpoint in gymnasts.js + inline edit UI in MyChildren.js and AdminMembers.js.

**Tech Stack:** Express, Prisma 5, React 18, Joi

---

## Task 1 — Double-booking check (`bookings.js`) + backend tests

### Background

Three booking endpoints all follow the same pattern: validate the session, then check capacity. The new check sits between those two steps in each endpoint, querying `BookingLine` records for any of the incoming `gymnastIds` that already have a `CONFIRMED` booking on the same `sessionInstanceId`.

Relevant file: `backend/routes/booking/bookings.js`

The block to insert (identical in all three locations):

```js
const alreadyBooked = await prisma.bookingLine.findMany({
  where: {
    gymnastId: { in: gymnastIds },
    booking: { sessionInstanceId, status: 'CONFIRMED' },
  },
  include: { gymnast: { select: { firstName: true } } },
});
if (alreadyBooked.length > 0) {
  const names = alreadyBooked.map(l => l.gymnast.firstName).join(', ');
  return res.status(400).json({ error: `Already booked: ${names}` });
}
```

### Steps

- [ ] **1.1 Write failing tests** — add three new `describe` blocks at the bottom of `backend/__tests__/booking.bookings.test.js`:

  ```js
  describe('POST /api/booking/bookings — double-booking prevention', () => {
    it('returns 400 "Already booked: <name>" when gymnast is already CONFIRMED in that session', async () => {
      const { instance } = await createSession(club);
      // Seed an existing confirmed booking for `gymnast`
      await prisma.booking.create({
        data: {
          userId: parent.id,
          sessionInstanceId: instance.id,
          status: 'CONFIRMED',
          totalAmount: 0,
          lines: { create: [{ gymnastId: gymnast.id, amount: 0 }] },
        },
      });
      // Give parent a credit so the route doesn't hit Stripe
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
      await prisma.credit.create({ data: { userId: parent.id, amount: 800, expiresAt } });

      const res = await request(testApp)
        .post('/api/booking/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Already booked/);
    });
  });

  describe('POST /api/booking/bookings/batch — double-booking prevention', () => {
    it('returns 400 when gymnast already has a CONFIRMED booking for a session in the batch', async () => {
      const { instance } = await createSession(club);
      await prisma.booking.create({
        data: {
          userId: parent.id,
          sessionInstanceId: instance.id,
          status: 'CONFIRMED',
          totalAmount: 0,
          lines: { create: [{ gymnastId: gymnast.id, amount: 0 }] },
        },
      });
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
      await prisma.credit.create({ data: { userId: parent.id, amount: 800, expiresAt } });

      const res = await request(testApp)
        .post('/api/booking/bookings/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Already booked/);
    });
  });
  ```

  Also add a third describe block for the combined endpoint:

  ```js
  describe('POST /api/booking/bookings/combined — double-booking prevention', () => {
    it('returns 400 when gymnast already has a CONFIRMED booking for a session in the combined request', async () => {
      const { instance } = await createSession(club);
      await prisma.booking.create({
        data: {
          userId: parent.id,
          sessionInstanceId: instance.id,
          status: 'CONFIRMED',
          totalAmount: 0,
          lines: { create: [{ gymnastId: gymnast.id, amount: 0 }] },
        },
      });
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
      await prisma.credit.create({ data: { userId: parent.id, amount: 800, expiresAt } });

      const res = await request(testApp)
        .post('/api/booking/bookings/combined')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessions: [{ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] }], shopItems: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Already booked/);
    });
  });
  ```

  Run tests — confirm they fail (404/500, no duplicate guard yet).

- [ ] **1.2 Implement — `POST /api/booking/bookings` (single, ~line 106)**

  Insert the `alreadyBooked` block immediately before the `// Check availability` comment (currently line 106). After insertion the order is:
  1. Session start-time guard (existing)
  2. **Duplicate check** (new)
  3. Capacity check (existing)

  ```js
  // Prevent duplicate booking for the same gymnast
  const alreadyBooked = await prisma.bookingLine.findMany({
    where: {
      gymnastId: { in: gymnastIds },
      booking: { sessionInstanceId, status: 'CONFIRMED' },
    },
    include: { gymnast: { select: { firstName: true } } },
  });
  if (alreadyBooked.length > 0) {
    const names = alreadyBooked.map(l => l.gymnast.firstName).join(', ');
    return res.status(400).json({ error: `Already booked: ${names}` });
  }
  ```

- [ ] **1.3 Implement — `POST /api/booking/bookings/batch` (per-session loop, ~line 362)**

  Inside the `for (const item of items)` loop, insert the duplicate check immediately before the capacity check (`const bookedCount = ...`). Use `sessionInstanceId` from `item` and `gymnast` from `item`:

  ```js
  // Prevent duplicate booking for the same gymnast
  const alreadyBookedBatch = await prisma.bookingLine.findMany({
    where: {
      gymnastId: { in: gymnastIds },
      booking: { sessionInstanceId, status: 'CONFIRMED' },
    },
    include: { gymnast: { select: { firstName: true } } },
  });
  if (alreadyBookedBatch.length > 0) {
    const names = alreadyBookedBatch.map(l => l.gymnast.firstName).join(', ');
    return res.status(400).json({ error: `Already booked: ${names}` });
  }
  ```

- [ ] **1.4 Implement — `POST /api/booking/bookings/combined` (per-session loop, ~line 769)**

  Inside the inner `for (const item of sessions)` loop, insert the duplicate check immediately before the capacity check (`const bookedCount = ...`). Variable name: `alreadyBookedCombined`.

  ```js
  // Prevent duplicate booking for the same gymnast
  const alreadyBookedCombined = await prisma.bookingLine.findMany({
    where: {
      gymnastId: { in: gymnastIds },
      booking: { sessionInstanceId, status: 'CONFIRMED' },
    },
    include: { gymnast: { select: { firstName: true } } },
  });
  if (alreadyBookedCombined.length > 0) {
    const names = alreadyBookedCombined.map(l => l.gymnast.firstName).join(', ');
    return res.status(400).json({ error: `Already booked: ${names}` });
  }
  ```

- [ ] **1.5 Run tests** — `npx jest backend/__tests__/booking.bookings.test.js` — all pass.

- [ ] **1.6 Verify** — Confirm the three insertion points each appear directly before their respective `const bookedCount` line and that no existing tests regressed.

- [ ] **1.7 Commit** — `git add backend/routes/booking/bookings.js backend/__tests__/booking.bookings.test.js && git commit -m "feat: prevent double-booking same gymnast in single, batch, and combined endpoints"` — push.

---

## Task 2 — Spaces remaining prominence (frontend only, no tests)

### Background

Two files need inline style additions — no logic changes, pure styling.

- `frontend/src/pages/booking/BookingCalendar.js` — the status `<span>` at line 170
- `frontend/src/pages/booking/SessionDetail.js` — the slots available `<p>` at line 162

Colour thresholds:
- `<= 3` slots: `var(--booking-danger)` (red), `fontWeight: 700`
- `<= 5` slots (but `> 3`): `#e67e22` (amber), `fontWeight: 600`
- Otherwise: no inline style override

### Steps

- [ ] **2.1 BookingCalendar.js** — replace line 170:

  Old:
  ```jsx
  <span className="booking-calendar__day-session-status">{sessionLabel(s)}</span>
  ```

  New:
  ```jsx
  <span
    className="booking-calendar__day-session-status"
    style={
      !s.isBooked && !s.cancelledAt && s.availableSlots > 0 && s.availableSlots <= 3
        ? { color: 'var(--booking-danger)', fontWeight: 700 }
        : !s.isBooked && !s.cancelledAt && s.availableSlots > 3 && s.availableSlots <= 5
        ? { color: '#e67e22', fontWeight: 600 }
        : undefined
    }
  >
    {sessionLabel(s)}
  </span>
  ```

- [ ] **2.2 SessionDetail.js** — replace line 162:

  Old:
  ```jsx
  <p>{session.availableSlots} of {session.capacity} slots available</p>
  ```

  New:
  ```jsx
  <p>
    <strong style={{
      color: !session.cancelledAt && session.availableSlots <= 3 ? 'var(--booking-danger)'
           : !session.cancelledAt && session.availableSlots <= 5 ? '#e67e22'
           : undefined
    }}>
      {session.availableSlots}
    </strong>{' '}of {session.capacity} slots available
  </p>
  ```

- [ ] **2.3 Manual verify** — open the booking calendar in the browser; find a session with 1-3 slots and confirm the status text is red/bold; find one with 4-5 slots and confirm amber/semibold; find one with 6+ slots and confirm no colour change. Confirm the session detail panel also shows the coloured slot count.

- [ ] **2.4 Commit** — `git add frontend/src/pages/booking/BookingCalendar.js frontend/src/pages/booking/SessionDetail.js && git commit -m "feat: highlight low spaces remaining in booking calendar and session detail"` — push.

---

## Task 3 — Health notes endpoint (`gymnasts.js` + `bookingApi.js`) + backend tests

### Background

Follow the exact same auth pattern as `PATCH /api/gymnasts/:id/emergency-contact` (lines 356-388 in `backend/routes/gymnasts.js`): fetch gymnast with `include: { guardians: true }`, 404 if not found, 403 if not a guardian and not staff.

The only behavioural nuance: empty string and `null` both persist as `null`; the string `'none'` persists as `'none'`; any other non-empty string persists as-is.

Check whether `backend/__tests__/gymnasts.test.js` exists. It does not currently exist, so create it. Seed helpers are in `backend/__tests__/helpers/seed.js` — use `createTestApp`, `createTestClub`, `createParent`, `createGymnast`, `tokenFor`, `cleanDatabase`, `prisma`.

### Steps

- [ ] **3.1 Write failing tests** — create `backend/__tests__/gymnasts.test.js`:

  ```js
  const request = require('supertest');
  const { createTestApp } = require('./helpers/create-test-app');
  const { prisma, cleanDatabase } = require('./helpers/db');
  const {
    createTestClub,
    createParent,
    createGymnast,
    tokenFor,
  } = require('./helpers/seed');

  const testApp = createTestApp();
  let club, parent, gymnast, token;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    parent = await createParent(club);
    gymnast = await createGymnast(club, parent);
    token = tokenFor(parent);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  describe('PATCH /api/gymnasts/:id/health-notes', () => {
    it('updates health notes for a guardian', async () => {
      const res = await request(testApp)
        .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ healthNotes: 'Asthma' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
      expect(updated.healthNotes).toBe('Asthma');
    });

    it('stores null when empty string sent', async () => {
      const res = await request(testApp)
        .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ healthNotes: '' });

      expect(res.status).toBe(200);
      const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
      expect(updated.healthNotes).toBeNull();
    });

    it('stores null when null sent', async () => {
      const res = await request(testApp)
        .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ healthNotes: null });

      expect(res.status).toBe(200);
      const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
      expect(updated.healthNotes).toBeNull();
    });

    it('returns 404 for gymnast in a different club', async () => {
      const otherClub = await createTestClub();
      const otherGymnast = await createGymnast(otherClub);

      const res = await request(testApp)
        .patch(`/api/gymnasts/${otherGymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ healthNotes: 'Something' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for a non-guardian, non-admin user', async () => {
      const otherParent = await createParent(club);
      const otherToken = tokenFor(otherParent);

      const res = await request(testApp)
        .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ healthNotes: 'Something' });

      expect(res.status).toBe(403);
    });

    it('stores "none" when the "none" sentinel is sent', async () => {
      const res = await request(testApp)
        .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ healthNotes: 'none' });

      expect(res.status).toBe(200);
      const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
      expect(updated.healthNotes).toBe('none');
    });
  });
  ```

  **Note on import paths:** The plan uses `require('./helpers/create-test-app')` and `require('./helpers/db')`. Before running, confirm these paths exist in `backend/__tests__/helpers/`. Check other test files (e.g. `booking.bookings.test.js`) for the exact import paths used there and mirror them exactly.

  Run `npx jest backend/__tests__/gymnasts.test.js` — confirm all six fail (404 from route not existing).

- [ ] **3.2 Implement endpoint in `backend/routes/gymnasts.js`**

  Add after the `PATCH /:id/emergency-contact` handler (after line 388):

  ```js
  // PATCH /api/gymnasts/:id/health-notes
  // Any guardian (or club admin/coach) can update health notes
  router.patch('/:id/health-notes', auth, async (req, res) => {
    try {
      const gymnast = await prisma.gymnast.findUnique({
        where: { id: req.params.id },
        include: { guardians: { select: { id: true } } },
      });
      if (!gymnast || gymnast.clubId !== req.user.clubId) {
        return res.status(404).json({ error: 'Gymnast not found' });
      }

      const isGuardian = gymnast.guardians.some(g => g.id === req.user.id);
      const isStaff = ['CLUB_ADMIN', 'COACH'].includes(req.user.role);
      if (!isGuardian && !isStaff) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { error, value } = Joi.object({
        healthNotes: Joi.string().allow('', null).optional(),
      }).validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      // Normalise: empty string or null → null; otherwise store as-is
      const healthNotes = value.healthNotes === '' || value.healthNotes == null
        ? null
        : value.healthNotes;

      await prisma.gymnast.update({
        where: { id: req.params.id },
        data: { healthNotes },
      });

      await audit(req.user.id, 'gymnast.updateHealthNotes', {
        gymnastId: req.params.id,
        healthNotes,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  ```

  Note: the `clubId` check replaces a two-step 404/403 approach — any gymnast not in the user's club returns 404 (matching the 404-for-other-club test case).

- [ ] **3.3 Add `updateHealthNotes` to `frontend/src/utils/bookingApi.js`**

  Add after the `updateEmergencyContact` entry:

  ```js
  updateHealthNotes: (gymnastId, data) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/health-notes`, data, { headers: getHeaders() }),
  ```

- [ ] **3.4 Run tests** — `npx jest backend/__tests__/gymnasts.test.js` — all pass.

- [ ] **3.5 Commit** — `git add backend/routes/gymnasts.js frontend/src/utils/bookingApi.js backend/__tests__/gymnasts.test.js && git commit -m "feat: add PATCH /api/gymnasts/:id/health-notes endpoint with guardian and admin auth"` — push.

---

## Task 4 — Health notes frontend — parent (`MyChildren.js`)

### Background

`MyChildren.js` renders a `GymnastCard` component (function at line 203). Each card already manages its own `editingEC` boolean for the emergency contact form. Add a parallel `editingHealthNotes` boolean plus the save handler.

Current read-only block (lines 251-258):
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

### Steps

- [ ] **4.1 Add state and handler to `GymnastCard`**

  Inside `GymnastCard` (after the `const [editingEC, setEditingEC] = useState(false);` line at ~204), add:

  ```js
  const [editingHealthNotes, setEditingHealthNotes] = useState(false);
  const [healthNotesValue, setHealthNotesValue] = useState(gymnast.healthNotes || '');
  const [healthNotesNone, setHealthNotesNone] = useState(gymnast.healthNotes === 'none');
  const [healthNotesSaving, setHealthNotesSaving] = useState(false);
  const [healthNotesError, setHealthNotesError] = useState(null);

  const handleSaveHealthNotes = async () => {
    setHealthNotesSaving(true);
    setHealthNotesError(null);
    try {
      const healthNotes = healthNotesNone ? 'none' : healthNotesValue || null;
      await bookingApi.updateHealthNotes(gymnast.id, { healthNotes });
      setEditingHealthNotes(false);
      onUpdated();
    } catch (err) {
      setHealthNotesError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setHealthNotesSaving(false);
    }
  };
  ```

- [ ] **4.2 Replace the read-only health notes block** (lines 251-258) with the combined read/edit view:

  ```jsx
  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
    <span className="bk-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Health notes</span>
    {editingHealthNotes ? (
      <div style={{ marginTop: '0.25rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={healthNotesNone}
            onChange={e => {
              setHealthNotesNone(e.target.checked);
              if (e.target.checked) setHealthNotesValue('');
            }}
          />
          No known health issues
        </label>
        {!healthNotesNone && (
          <textarea
            className="bk-input"
            rows={3}
            style={{ width: '100%', marginBottom: '0.4rem', fontSize: '0.875rem' }}
            value={healthNotesValue}
            onChange={e => setHealthNotesValue(e.target.value)}
            placeholder="Describe any health issues or learning differences"
          />
        )}
        {healthNotesError && <p className="bk-error">{healthNotesError}</p>}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="bk-btn bk-btn--primary bk-btn--sm"
            disabled={healthNotesSaving}
            onClick={handleSaveHealthNotes}
          >
            {healthNotesSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            className="bk-btn bk-btn--sm"
            style={{ border: '1px solid var(--booking-border)' }}
            onClick={() => {
              setEditingHealthNotes(false);
              setHealthNotesValue(gymnast.healthNotes === 'none' ? '' : gymnast.healthNotes || '');
              setHealthNotesNone(gymnast.healthNotes === 'none');
              setHealthNotesError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span style={{ color: gymnast.healthNotes === 'none' ? 'var(--booking-text-muted)' : 'inherit' }}>
          {gymnast.healthNotes === 'none'
            ? 'No known health issues or learning differences'
            : gymnast.healthNotes || <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
        </span>
        <button
          className="bk-btn bk-btn--sm"
          style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)', flexShrink: 0 }}
          onClick={() => {
            setHealthNotesValue(gymnast.healthNotes === 'none' ? '' : gymnast.healthNotes || '');
            setHealthNotesNone(gymnast.healthNotes === 'none');
            setEditingHealthNotes(true);
          }}
        >
          Edit
        </button>
      </div>
    )}
  </div>
  ```

- [ ] **4.3 Manual verify** — open My Children in the browser; confirm the health notes line shows the current value and an Edit button; click Edit and confirm the checkbox and textarea appear correctly; tick "No known health issues", save, confirm the display updates; re-open edit, untick and enter text, save, confirm text value is shown.

- [ ] **4.4 Commit** — `git add frontend/src/pages/booking/MyChildren.js && git commit -m "feat: add inline health notes editing to parent gymnast card"` — push.

---

## Task 5 — Health notes frontend — admin (`AdminMembers.js`)

### Background

`AdminMembers.js` renders gymnasts through a `GymnastRow` component (function at line 337). This component already manages several pieces of local state (`editingDob`, `dmtLoading`, etc.). Add a parallel `editingHealthNotes` boolean and save handler following the same pattern used for DOB editing.

Current read-only block (lines 586-596):
```jsx
{/* Health notes */}
<li style={{ ...infoItemStyle, ...(!g.isSelf ? { borderBottom: 'none' } : {}) }}>
  <span style={keyStyle}>Health notes</span>
  <span style={{ textAlign: 'right' }}>
    {g.healthNotes === 'none'
      ? <span style={{ color: 'var(--booking-text-muted)' }}>None</span>
      : g.healthNotes
        ? g.healthNotes
        : <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
  </span>
</li>
```

### Steps

- [ ] **5.1 Add state and handler to `GymnastRow`**

  Inside `GymnastRow` (after the existing `const [addingStartDate, ...]` line at ~354), add:

  ```js
  const [editingHealthNotes, setEditingHealthNotes] = useState(false);
  const [healthNotesValue, setHealthNotesValue] = useState(g.healthNotes === 'none' ? '' : g.healthNotes || '');
  const [healthNotesNone, setHealthNotesNone] = useState(g.healthNotes === 'none');
  const [healthNotesSaving, setHealthNotesSaving] = useState(false);
  const [healthNotesError, setHealthNotesError] = useState(null);

  const handleSaveHealthNotes = async () => {
    setHealthNotesSaving(true);
    setHealthNotesError(null);
    try {
      const healthNotes = healthNotesNone ? 'none' : healthNotesValue || null;
      await bookingApi.updateHealthNotes(g.id, { healthNotes });
      setEditingHealthNotes(false);
      onUpdated();
    } catch (err) {
      setHealthNotesError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setHealthNotesSaving(false);
    }
  };
  ```

- [ ] **5.2 Replace the read-only health notes `<li>` block** (lines 586-596) with the combined read/edit view:

  ```jsx
  {/* Health notes */}
  <li style={{ ...infoItemStyle, ...(!g.isSelf ? { borderBottom: 'none' } : {}) }}>
    <span style={keyStyle}>Health notes</span>
    <span style={{ textAlign: 'right' }}>
      {editingHealthNotes ? (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={healthNotesNone}
              onChange={e => {
                setHealthNotesNone(e.target.checked);
                if (e.target.checked) setHealthNotesValue('');
              }}
            />
            No known health issues
          </label>
          {!healthNotesNone && (
            <textarea
              className="bk-input"
              rows={3}
              style={{ width: '100%', fontSize: '0.82rem' }}
              value={healthNotesValue}
              onChange={e => setHealthNotesValue(e.target.value)}
              placeholder="Describe any health issues or learning differences"
            />
          )}
          {healthNotesError && (
            <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{healthNotesError}</span>
          )}
          <span style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="bk-btn bk-btn--sm bk-btn--primary"
              style={{ fontSize: '0.75rem' }}
              disabled={healthNotesSaving}
              onClick={handleSaveHealthNotes}
            >
              {healthNotesSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="bk-btn bk-btn--sm"
              style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
              onClick={() => {
                setEditingHealthNotes(false);
                setHealthNotesValue(g.healthNotes === 'none' ? '' : g.healthNotes || '');
                setHealthNotesNone(g.healthNotes === 'none');
                setHealthNotesError(null);
              }}
            >
              Cancel
            </button>
          </span>
        </span>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <span>
            {g.healthNotes === 'none'
              ? <span style={{ color: 'var(--booking-text-muted)' }}>None</span>
              : g.healthNotes
                ? g.healthNotes
                : <em style={{ color: 'var(--booking-text-muted)' }}>Not recorded</em>}
          </span>
          <button
            className="bk-btn bk-btn--sm"
            style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
            onClick={() => {
              setHealthNotesValue(g.healthNotes === 'none' ? '' : g.healthNotes || '');
              setHealthNotesNone(g.healthNotes === 'none');
              setEditingHealthNotes(true);
            }}
          >
            Edit
          </button>
        </span>
      )}
    </span>
  </li>
  ```

- [ ] **5.3 Manual verify** — open Admin Members in the browser; expand a gymnast card; confirm the health notes row shows the current value and an Edit button; click Edit; confirm the checkbox and optional textarea appear; save with "No known health issues" ticked and confirm the display shows "None"; re-open edit, untick and enter text, save, confirm text value shown.

- [ ] **5.4 Commit** — `git add frontend/src/pages/booking/admin/AdminMembers.js && git commit -m "feat: add inline health notes editing to admin gymnast card"` — push.
