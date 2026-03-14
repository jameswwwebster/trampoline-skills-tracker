# Session Types Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session type (STANDARD/DMT) to session templates and DMT approval to gymnasts, gating DMT bookings behind a coach-issued approval.

**Architecture:** Three layers of change — database schema (new enum + fields), backend routes (validation, new endpoint, booking gate), and frontend (type selector, admin toggle, eligibility display). Each layer is independently testable and committed separately.

**Tech Stack:** Prisma 5 + PostgreSQL, Express + Joi, React 18 + axios (bookingApi pattern)

---

## Chunk 1: Schema + Backend Routes

### Task 1: Database schema migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add SessionType enum, update SessionTemplate, update Gymnast and User**

  In `schema.prisma`, add the enum after the existing enums block (near `BgNumberStatus`):
  ```prisma
  enum SessionType {
    STANDARD
    DMT
  }
  ```

  On `SessionTemplate`, add after `pricePerGymnast`:
  ```prisma
  type  SessionType  @default(STANDARD)
  ```

  On `Gymnast`, add after the `bgNumber` fields:
  ```prisma
  dmtApproved      Boolean   @default(false)
  dmtApprovedAt    DateTime?
  dmtApprovedById  String?
  dmtApprovedBy    User?     @relation("DmtApprovedBy", fields: [dmtApprovedById], references: [id])
  ```

  On `User`, add after existing relations:
  ```prisma
  dmtApprovals  Gymnast[]  @relation("DmtApprovedBy")
  ```

- [ ] **Step 2: Run migration**

  ```bash
  cd backend && npx prisma migrate dev --name add_session_type_and_dmt_approval
  ```
  Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify schema compiles**

  ```bash
  cd backend && npx prisma validate
  ```
  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/
  git commit -m "feat: add SessionType enum and DMT approval fields to schema"
  ```

---

### Task 2: Backend — templates route, sessions route, bookable-for-me

**Files:**
- Modify: `backend/routes/booking/templates.js`
- Modify: `backend/routes/booking/sessions.js`
- Modify: `backend/routes/gymnasts.js`
- Modify: `backend/__tests__/booking.templates.test.js`

- [ ] **Step 1: Write failing tests for session type in templates**

  Append to `backend/__tests__/booking.templates.test.js`:
  ```js
  describe('POST /api/booking/templates — session type', () => {
    it('creates a DMT template when type=DMT', async () => {
      const res = await request(app)
        .post('/api/booking/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 1, startTime: '10:00', endTime: '11:00', openSlots: 8, type: 'DMT' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('DMT');
    });

    it('defaults type to STANDARD when not provided', async () => {
      const res = await request(app)
        .post('/api/booking/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 2, startTime: '09:00', endTime: '10:00', openSlots: 10 });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('STANDARD');
    });
  });

  describe('PUT /api/booking/templates/:id — session type', () => {
    it('updates type from STANDARD to DMT', async () => {
      const template = await prisma.sessionTemplate.create({
        data: { clubId: club.id, dayOfWeek: 4, startTime: '11:00', endTime: '12:00', openSlots: 6, pricePerGymnast: 600 },
      });

      const res = await request(app)
        .put(`/api/booking/templates/${template.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 4, startTime: '11:00', endTime: '12:00', openSlots: 6, type: 'DMT', applyToFutureInstances: false });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('DMT');
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd backend && npx jest booking.templates.test.js --no-coverage
  ```
  Expected: FAIL — `type` not in response body.

- [ ] **Step 3: Implement type in templates route**

  In `backend/routes/booking/templates.js`, find the Joi schema (around line 10-18) and add `type`:
  ```js
  type: Joi.string().valid('STANDARD', 'DMT').optional().default('STANDARD'),
  ```

  In the `POST /` handler's `data` object, add:
  ```js
  type: value.type,
  ```

  In the `PUT /:id` handler's `data` object, add:
  ```js
  type: value.type,
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd backend && npx jest booking.templates.test.js --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 5: Write failing test for sessions route returning type**

  Create `backend/__tests__/booking.sessions.type.test.js`:
  ```js
  const request = require('supertest');
  const { createTestApp } = require('./helpers/create-test-app');
  const { prisma, cleanDatabase } = require('./helpers/db');
  const { createTestClub, createParent, createSession, tokenFor } = require('./helpers/seed');

  const app = createTestApp();
  let club, parent, token;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    parent = await createParent(club);
    token = tokenFor(parent);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  describe('GET /api/booking/sessions — type field', () => {
    it('includes type in session list response', async () => {
      await createSession(club, undefined, { type: 'DMT' });

      const now = new Date();
      const res = await request(app)
        .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${token}`);

      // Find a DMT session in the response
      const dmt = res.body.find(s => s.type === 'DMT');
      expect(dmt).toBeDefined();
    });
  });

  describe('GET /api/booking/sessions/:instanceId — type field', () => {
    it('includes type in session detail response', async () => {
      const { instance } = await createSession(club, undefined, { type: 'DMT' });

      const res = await request(app)
        .get(`/api/booking/sessions/${instance.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('DMT');
    });
  });
  ```

- [ ] **Step 6: Run test to confirm it fails**

  ```bash
  cd backend && npx jest booking.sessions.type.test.js --no-coverage
  ```
  Expected: FAIL — `type` undefined in response.

- [ ] **Step 7: Implement type in sessions route**

  In `backend/routes/booking/sessions.js`, find the `GET /` handler's mapped response object (around line 37-54). Add `type: instance.template.type` to the object.

  Find the `GET /:instanceId` handler's response object (around line 102-114). Add `type: instance.template.type` to that object too.

  Note: both endpoints manually construct their response objects — type is not passed through automatically. It must be added to each explicitly.

- [ ] **Step 8: Run tests to confirm they pass**

  ```bash
  cd backend && npx jest booking.sessions.type.test.js --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 9: Write failing test for bookable-for-me returning dmtApproved**

  Create `backend/__tests__/gymnast.dmt.test.js`:
  ```js
  const request = require('supertest');
  const { createTestApp } = require('./helpers/create-test-app');
  const { prisma, cleanDatabase } = require('./helpers/db');
  const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

  const app = createTestApp();
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

  describe('GET /api/gymnasts/bookable-for-me', () => {
    it('includes dmtApproved field (default false)', async () => {
      const res = await request(app)
        .get('/api/gymnasts/bookable-for-me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const g = res.body.find(g => g.id === gymnast.id);
      expect(g).toBeDefined();
      expect(g.dmtApproved).toBe(false);
    });

    it('returns dmtApproved=true after approval', async () => {
      await prisma.gymnast.update({
        where: { id: gymnast.id },
        data: { dmtApproved: true, dmtApprovedAt: new Date() },
      });

      const res = await request(app)
        .get('/api/gymnasts/bookable-for-me')
        .set('Authorization', `Bearer ${token}`);

      const g = res.body.find(g => g.id === gymnast.id);
      expect(g.dmtApproved).toBe(true);
    });

    it('includes dmtApproved for linked child gymnasts (the children select path)', async () => {
      // Create a child gymnast linked to a different parent
      // The bookable-for-me endpoint has two code paths: self-gymnast and linked children
      // This test exercises the linked-children path
      const childGymnast = await createGymnast(club, parent, { dmtApproved: true, dmtApprovedAt: new Date() });

      const res = await request(app)
        .get('/api/gymnasts/bookable-for-me')
        .set('Authorization', `Bearer ${token}`);

      const g = res.body.find(g => g.id === childGymnast.id);
      expect(g).toBeDefined();
      expect(g.dmtApproved).toBe(true);
    });
  });
  ```

- [ ] **Step 10: Run test to confirm it fails**

  ```bash
  cd backend && npx jest gymnast.dmt.test.js --no-coverage
  ```
  Expected: FAIL — `dmtApproved` undefined in response.

- [ ] **Step 11: Add dmtApproved to bookable-for-me select**

  In `backend/routes/gymnasts.js`, find the `GET /bookable-for-me` handler (around line 25-84). Locate both `select` clauses (one for self-gymnast, one for linked children). Add `dmtApproved: true` to each.

  The self-gymnast query select (look for the `isSelf` query):
  ```js
  dmtApproved: true,
  ```

  The linked-children query select (look for the guardians/children query):
  ```js
  dmtApproved: true,
  ```

- [ ] **Step 12: Run tests to confirm they pass**

  ```bash
  cd backend && npx jest gymnast.dmt.test.js --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 13: Run all backend tests to confirm no regressions**

  ```bash
  cd backend && npx jest --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 14: Commit**

  ```bash
  git add backend/routes/booking/templates.js backend/routes/booking/sessions.js backend/routes/gymnasts.js \
    backend/__tests__/booking.templates.test.js backend/__tests__/booking.sessions.type.test.js backend/__tests__/gymnast.dmt.test.js
  git commit -m "feat: add session type to templates/sessions routes and dmtApproved to bookable-for-me"
  ```

---

### Task 3: Backend — DMT approval endpoint + booking gate

**Files:**
- Modify: `backend/routes/gymnasts.js`
- Modify: `backend/routes/booking/bookings.js`
- Modify: `backend/__tests__/gymnast.dmt.test.js`
- Modify: `backend/__tests__/booking.bookings.test.js`

- [ ] **Step 1: Write failing tests for PATCH /:id/dmt-approval**

  Append to `backend/__tests__/gymnast.dmt.test.js`:
  ```js
  describe('PATCH /api/gymnasts/:id/dmt-approval', () => {
    let coach, coachToken;

    beforeAll(async () => {
      coach = await createParent(club, { role: 'COACH', email: `dmt-coach-${Date.now()}@test.tl` });
      coachToken = tokenFor(coach);
    });

    it('coach can approve a gymnast for DMT', async () => {
      // reset
      await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: false, dmtApprovedAt: null, dmtApprovedById: null } });

      const res = await request(app)
        .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ approved: true });

      expect(res.status).toBe(200);
      expect(res.body.dmtApproved).toBe(true);
      expect(res.body.dmtApprovedAt).toBeTruthy();
      expect(res.body.dmtApprovedById).toBe(coach.id);
    });

    it('coach can revoke DMT approval', async () => {
      // Set all three fields so the test verifies they are cleared
      await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: true, dmtApprovedAt: new Date(), dmtApprovedById: coach.id } });

      const res = await request(app)
        .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ approved: false });

      expect(res.status).toBe(200);
      expect(res.body.dmtApproved).toBe(false);
      expect(res.body.dmtApprovedAt).toBeNull();
      expect(res.body.dmtApprovedById).toBeNull();
    });

    it('parent cannot change DMT approval', async () => {
      const res = await request(app)
        .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
        .set('Authorization', `Bearer ${token}`)
        .send({ approved: true });

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
        .send({ approved: true });

      expect(res.status).toBe(401);
    });

    it('creates an audit log entry on approval', async () => {
      await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: false, dmtApprovedAt: null, dmtApprovedById: null } });

      await request(app)
        .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ approved: true });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'gymnast.dmt_approval' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(log.metadata).toMatchObject({ approved: true, gymnastId: gymnast.id });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd backend && npx jest gymnast.dmt.test.js --no-coverage
  ```
  Expected: FAIL — 404 (route not found).

- [ ] **Step 3: Implement PATCH /:id/dmt-approval**

  In `backend/routes/gymnasts.js`, add this endpoint after the existing `/:id/bg-number/verify` block (around line 235). This sub-path pattern follows the same convention as existing routes — no special ordering needed:

  ```js
  // PATCH /api/gymnasts/:id/dmt-approval  (coach/admin only)
  router.patch('/:id/dmt-approval', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
    const { id } = req.params;
    const { approved } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved must be a boolean' });
    }

    const gymnast = await prisma.gymnast.findFirst({
      where: { id, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    const data = approved
      ? { dmtApproved: true, dmtApprovedAt: new Date(), dmtApprovedById: req.user.id }
      : { dmtApproved: false, dmtApprovedAt: null, dmtApprovedById: null };

    const updated = await prisma.gymnast.update({ where: { id }, data });

    await audit(req, 'gymnast.dmt_approval', { approved, gymnastId: id });

    res.json(updated);
  });
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd backend && npx jest gymnast.dmt.test.js --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 5: Write failing tests for DMT booking gate**

  Append to `backend/__tests__/booking.bookings.test.js`:
  ```js
  describe('DMT booking gate', () => {
    let dmtClub, dmtParent, dmtToken, approvedGymnast, unapprovedGymnast;

    beforeAll(async () => {
      dmtClub = await createTestClub();
      dmtParent = await createParent(dmtClub);
      dmtToken = tokenFor(dmtParent);
      approvedGymnast = await createGymnast(dmtClub, dmtParent, { dmtApproved: true });
      unapprovedGymnast = await createGymnast(dmtClub, dmtParent);
    });

    it('POST / — blocks unapproved gymnast for DMT session', async () => {
      const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
      await createCredit(dmtParent, 1200); // enough to cover, eliminates Stripe

      const res = await request(testApp)
        .post('/api/booking/bookings')
        .set('Authorization', `Bearer ${dmtToken}`)
        .send({ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not approved for DMT/i);
    });

    it('POST / — allows approved gymnast for DMT session', async () => {
      const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
      await createCredit(dmtParent, 1200);

      const res = await request(testApp)
        .post('/api/booking/bookings')
        .set('Authorization', `Bearer ${dmtToken}`)
        .send({ sessionInstanceId: instance.id, gymnastIds: [approvedGymnast.id] });

      expect(res.status).toBe(200);
    });

    it('POST / — STANDARD session does not apply DMT gate', async () => {
      const { instance } = await createSession(dmtClub, undefined, { type: 'STANDARD' });
      await createCredit(dmtParent, 1200);

      const res = await request(testApp)
        .post('/api/booking/bookings')
        .set('Authorization', `Bearer ${dmtToken}`)
        .send({ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] });

      expect(res.status).toBe(200);
    });

    it('POST /batch — blocks unapproved gymnast for DMT session', async () => {
      const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
      await createCredit(dmtParent, 1200);

      const res = await request(testApp)
        .post('/api/booking/bookings/batch')
        .set('Authorization', `Bearer ${dmtToken}`)
        .send({ items: [{ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not approved for DMT/i);
    });

    it('POST /combined — blocks unapproved gymnast for DMT session', async () => {
      const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
      await createCredit(dmtParent, 1200);

      const res = await request(testApp)
        .post('/api/booking/bookings/combined')
        .set('Authorization', `Bearer ${dmtToken}`)
        .send({ sessions: [{ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] }], shopItems: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not approved for DMT/i);
    });
  });
  ```

  Note: this block needs `createCredit` added to the imports at the top of the file if not already present.
  Note: `testApp` is the correct variable name in `booking.bookings.test.js` (line 22: `const testApp = createTestApp()`), consistent with existing tests in that file.

- [ ] **Step 6: Run tests to confirm they fail**

  ```bash
  cd backend && npx jest booking.bookings.test.js --no-coverage -t "DMT booking gate"
  ```
  Expected: FAIL — 200s where 400s expected.

- [ ] **Step 7: Implement DMT check in bookings.js**

  In `backend/routes/booking/bookings.js`, add the DMT check to `POST /` after the existing age/BG number validation (around line 155-160, after the age check block):

  ```js
  // DMT approval check
  if (instance.template.type === 'DMT') {
    const gymnasts = await prisma.gymnast.findMany({
      where: { id: { in: gymnastIds } },
      select: { id: true, firstName: true, dmtApproved: true },
    });
    const blocked = gymnasts.filter(g => !g.dmtApproved);
    if (blocked.length > 0) {
      return res.status(400).json({
        error: `The following gymnasts are not approved for DMT: ${blocked.map(g => g.firstName).join(', ')}`,
      });
    }
  }
  ```

  Ensure `instance.template.type` is available — the existing query for POST / already includes `template` with at least `pricePerGymnast`; confirm the select includes `type` or fetch it. If the query does `include: { template: true }`, it will work. If it uses a partial select, add `type: true`.

  Add the same block to `POST /batch` inside the validation loop (same scope as `instance`, after the existing age/BG checks, around line 320-330).

  Add the same block to `POST /combined` inside the validation loop (around line 660-670).

  Do **not** add to `POST /admin-add` — intentionally excluded per spec.

- [ ] **Step 8: Run tests to confirm they pass**

  ```bash
  cd backend && npx jest booking.bookings.test.js --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 9: Run full test suite**

  ```bash
  cd backend && npx jest --no-coverage
  ```
  Expected: All pass.

- [ ] **Step 10: Commit**

  ```bash
  git add backend/routes/gymnasts.js backend/routes/booking/bookings.js \
    backend/__tests__/gymnast.dmt.test.js backend/__tests__/booking.bookings.test.js
  git commit -m "feat: add DMT approval endpoint and booking gate"
  ```

---

## Chunk 2: Frontend

### Task 4: Frontend — session type UI, admin DMT toggle, booking eligibility, calendar label

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`
- Modify: `frontend/src/pages/booking/admin/SessionTemplates.js`
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`
- Modify: `frontend/src/pages/booking/SessionDetail.js`
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

Frontend changes have no automated tests in this codebase. Verify manually by running the dev server and checking each UI surface.

- [ ] **Step 1: Add approveDmt to bookingApi.js**

  In `frontend/src/utils/bookingApi.js`, add to the `bookingApi` object alongside the other gymnast methods:
  ```js
  approveDmt: (gymnastId, approved) =>
    axios.patch(`/api/gymnasts/${gymnastId}/dmt-approval`, { approved }, { headers: getHeaders() }),
  ```

- [ ] **Step 2: Add type field to SessionTemplates.js**

  In `frontend/src/pages/booking/admin/SessionTemplates.js`:

  **EMPTY_FORM** — add `type: 'STANDARD'` to the initial form state.

  **openEdit(t)** — add `type: t.type` when populating the edit form.

  **buildPayload()** — add `type: form.type` to the payload object.

  **Form JSX** — after the capacity/price fields, add:
  ```jsx
  <label className="auth-label">Session type
    <select name="type" value={form.type} onChange={handleChange} className="auth-input">
      <option value="STANDARD">Standard</option>
      <option value="DMT">DMT</option>
    </select>
  </label>
  ```

  **Template list row** — in the row that shows slots and price, append the DMT label conditionally (only show if DMT, not for Standard):
  ```jsx
  {t.type === 'DMT' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--booking-accent)' }}>DMT</span>}
  ```

- [ ] **Step 3: Add DMT toggle to GymnastRow in AdminMembers.js**

  In `frontend/src/pages/booking/admin/AdminMembers.js`, locate the `GymnastRow` component (line 337).

  Add state for the DMT toggle:
  ```jsx
  const [dmtLoading, setDmtLoading] = useState(false);
  const [dmtError, setDmtError] = useState(null);
  ```

  Add a handler:
  ```jsx
  const handleDmtToggle = async () => {
    setDmtLoading(true);
    setDmtError(null);
    try {
      await bookingApi.approveDmt(g.id, !g.dmtApproved);
      onUpdated();
    } catch (err) {
      setDmtError(err.response?.data?.error || 'Failed to update DMT approval.');
    } finally {
      setDmtLoading(false);
    }
  };
  ```

  In the info list (the `<ul>` around line 429), add a DMT row after the BG insurance row:
  ```jsx
  <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
    <span style={keyStyle}>DMT</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {g.dmtApproved ? (
        <span style={{ color: 'var(--booking-success)' }}>
          ✓ Approved
          {g.dmtApprovedBy && (
            <span style={{ fontWeight: 400, color: 'var(--booking-text-muted)', marginLeft: '0.3rem' }}>
              by {g.dmtApprovedBy.firstName} {g.dmtApprovedBy.lastName}
              {g.dmtApprovedAt && ` on ${new Date(g.dmtApprovedAt).toLocaleDateString('en-GB')}`}
            </span>
          )}
        </span>
      ) : (
        <span style={{ color: 'var(--booking-text-muted)' }}>Not approved</span>
      )}
      <button
        className="bk-btn bk-btn--sm"
        style={{ fontSize: '0.75rem', border: '1px solid var(--booking-border)' }}
        disabled={dmtLoading}
        onClick={handleDmtToggle}
      >
        {g.dmtApproved ? 'Revoke' : 'Approve'}
      </button>
      {dmtError && <span style={{ color: 'var(--booking-danger)', fontSize: '0.75rem' }}>{dmtError}</span>}
    </span>
  </li>
  ```

  Note: `g.dmtApproved`, `g.dmtApprovedAt`, and `g.dmtApprovedBy` are available because Step 6 updates the backend query that populates `member.gymnasts`.

- [ ] **Step 4: Add DMT eligibility check to SessionDetail.js**

  In `frontend/src/pages/booking/SessionDetail.js`, find the gymnast selection section (around line 225-264) where gymnasts are rendered with checkboxes.

  When `session.type === 'DMT'` and the gymnast does not have `dmtApproved === true`, disable the gymnast's checkbox and show an inline message:

  ```jsx
  const isDmtSession = session?.type === 'DMT';
  ```

  In the gymnast rendering loop, add per-gymnast eligibility:
  ```jsx
  const dmtBlocked = isDmtSession && !g.dmtApproved;
  ```

  Disable the checkbox when blocked:
  ```jsx
  <input
    type="checkbox"
    disabled={dmtBlocked || /* existing disabled conditions */}
    ...
  />
  ```

  Show a message next to the gymnast name when blocked:
  ```jsx
  {dmtBlocked && (
    <span style={{ fontSize: '0.78rem', color: 'var(--booking-text-muted)', marginLeft: '0.4rem' }}>
      Not approved for DMT — speak to a coach.
    </span>
  )}
  ```

- [ ] **Step 5: Add DMT label to BookingCalendar.js**

  In `frontend/src/pages/booking/BookingCalendar.js`, find the day panel session list rendering (around line 134-144) where sessions are displayed with their time.

  Add the DMT label alongside the time display:
  ```jsx
  {session.type === 'DMT' && (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-accent)',
      border: '1px solid var(--booking-accent)', borderRadius: 3,
      padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
    }}>
      DMT
    </span>
  )}
  ```

- [ ] **Step 6: Update admin members backend to include dmtApprovedBy relation**

  The member detail endpoint is `GET /api/users/:userId` in `backend/routes/users.js` (line 286). It fetches gymnasts using `include: { consents: true }`. Because it uses `include` (not `select`), all scalar gymnast fields — including `dmtApproved`, `dmtApprovedAt`, and `dmtApprovedById` — are returned automatically once the schema migration runs.

  However, the approver's display name requires the `dmtApprovedBy` relation. Change line 294 from:
  ```js
  include: { consents: true },
  ```
  to:
  ```js
  include: {
    consents: true,
    dmtApprovedBy: { select: { firstName: true, lastName: true } },
  },
  ```

  This makes `g.dmtApprovedBy?.firstName` available in the frontend.

- [ ] **Step 7: Build the frontend and check for errors**

  ```bash
  cd frontend && npm run build 2>&1 | tail -20
  ```
  Expected: Compiled successfully with no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/src/utils/bookingApi.js \
    frontend/src/pages/booking/admin/SessionTemplates.js \
    frontend/src/pages/booking/admin/AdminMembers.js \
    frontend/src/pages/booking/SessionDetail.js \
    frontend/src/pages/booking/BookingCalendar.js \
    backend/routes/users.js
  git commit -m "feat: add session type UI, DMT approval toggle, and eligibility display"
  ```

---

## Manual Verification Checklist

After all tasks are complete:

- [ ] Admin can create a new template with type=DMT, and the list row shows "DMT"
- [ ] Existing templates show no type label (Standard is the default)
- [ ] Admin can toggle DMT approval for a gymnast in the Members page
- [ ] Parent booking a DMT session sees unapproved gymnasts greyed out with the "speak to a coach" message
- [ ] Approved gymnast can be selected and booked for a DMT session
- [ ] POST / returns 400 with a clear error if parent somehow submits an unapproved gymnast for DMT
- [ ] DMT sessions show the "DMT" pill in the booking calendar
- [ ] Standard sessions: no change to booking flow
