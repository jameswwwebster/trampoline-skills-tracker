# Membership & Standing Slots Rework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `startDate` to commitments so that slots assigned during membership scheduling activate only from the membership's start date, and flatten the admin member detail view so membership management and standing slots are always visible.

**Architecture:** New nullable `Commitment.startDate DateTime?` column (null = active immediately); both capacity queries in `sessions.js` and both cap-count queries in `commitments.js` gain a `startDate` filter to exclude future-dated slots; `AdminMembers.js` `GymnastRow` is restructured from a two-panel (always-visible info + collapsible details) layout into a single flat card body with the membership and slots section always visible.

**Tech Stack:** Express + Prisma 5 + PostgreSQL; React 18; Jest + Supertest for backend tests

---

## Chunk 1: Backend

### Task 1: Schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_commitment_start_date/migration.sql`

- [ ] **Step 1: Add `startDate` field to the `Commitment` model in `schema.prisma`**

  In `backend/prisma/schema.prisma`, inside `model Commitment { ... }`, add one line after `pausedById String?`:

  ```prisma
  startDate    DateTime?
  ```

  Full model after change:
  ```prisma
  model Commitment {
    id           String           @id @default(cuid())
    gymnast      Gymnast          @relation(fields: [gymnastId], references: [id], onDelete: Cascade)
    gymnastId    String
    template     SessionTemplate  @relation(fields: [templateId], references: [id], onDelete: Restrict)
    templateId   String
    status       CommitmentStatus @default(ACTIVE)
    pausedAt     DateTime?
    pausedById   String?
    pausedBy     User?            @relation("CommitmentPausedBy", fields: [pausedById], references: [id])
    startDate    DateTime?
    createdById  String
    createdBy    User             @relation("CommitmentCreatedBy", fields: [createdById], references: [id])
    createdAt    DateTime         @default(now())
    updatedAt    DateTime         @updatedAt

    @@unique([gymnastId, templateId])
  }
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  cd backend && npx prisma migrate dev --name add_commitment_start_date
  ```

  Expected: Prisma creates a migration file and applies `ALTER TABLE "Commitment" ADD COLUMN "startDate" TIMESTAMP(3);`

- [ ] **Step 3: Verify the migration SQL**

  Check the generated file in `backend/prisma/migrations/<timestamp>_add_commitment_start_date/migration.sql` — it should contain:

  ```sql
  ALTER TABLE "Commitment" ADD COLUMN "startDate" TIMESTAMP(3);
  ```

- [ ] **Step 4: Commit**

  ```bash
  cd backend && git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat: add startDate to Commitment model"
  ```

---

### Task 2: sessions.js — exclude future-dated commitments from capacity counts

**Files:**
- Modify: `backend/routes/booking/sessions.js:40-42,126-128`
- Test: `backend/__tests__/booking.commitments.test.js`

Both `GET /` (month view) and `GET /:instanceId` (single session) handlers contain an identical `prisma.commitment.count` query. Both must be updated to exclude commitments whose `startDate` is in the future.

- [ ] **Step 1: Write the failing tests**

  Add a new `describe('session capacity with future-dated commitments')` block to `backend/__tests__/booking.commitments.test.js`:

  ```js
  describe('session capacity with future-dated commitments', () => {
    // app, adminToken, gymnast, template, admin, request, prisma all defined in outer scope

    afterEach(async () => {
      await prisma.commitment.deleteMany({});
    });

    it('GET /api/booking/sessions: future-dated ACTIVE commitment does not reduce available slots', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: tomorrow,
        },
      });

      const now = new Date();
      const res = await request(app)
        .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const session = res.body.find(s => s.templateId === template.id);
      expect(session).toBeDefined();
      expect(session.activeCommitments).toBe(0);
    });

    it('GET /api/booking/sessions: today-dated ACTIVE commitment reduces available slots', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: today,
        },
      });

      const now = new Date();
      const res = await request(app)
        .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const session = res.body.find(s => s.templateId === template.id);
      expect(session.activeCommitments).toBe(1);
    });

    it('GET /api/booking/sessions: past-dated ACTIVE commitment reduces available slots', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: yesterday,
        },
      });

      const now = new Date();
      const res = await request(app)
        .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const session = res.body.find(s => s.templateId === template.id);
      expect(session.activeCommitments).toBe(1);
    });

    it('GET /api/booking/sessions: null startDate ACTIVE commitment reduces available slots (backwards compat)', async () => {
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: null,
        },
      });

      const now = new Date();
      const res = await request(app)
        .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const session = res.body.find(s => s.templateId === template.id);
      expect(session.activeCommitments).toBe(1);
    });

    it('GET /api/booking/sessions/:instanceId: future-dated ACTIVE commitment does not reduce available slots', async () => {
      const instance = await prisma.sessionInstance.findFirst({
        where: { templateId: template.id },
      });
      if (!instance) return; // skip if no instance seeded

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: tomorrow,
        },
      });

      const res = await request(app)
        .get(`/api/booking/sessions/${instance.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activeCommitments).toBe(0);
    });

    it('GET /api/booking/sessions/:instanceId: today-dated ACTIVE commitment reduces available slots', async () => {
      const instance = await prisma.sessionInstance.findFirst({
        where: { templateId: template.id },
      });
      if (!instance) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.commitment.create({
        data: {
          gymnastId: gymnast.id,
          templateId: template.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: today,
        },
      });

      const res = await request(app)
        .get(`/api/booking/sessions/${instance.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activeCommitments).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd backend && npx jest booking.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: up to six new tests fail (the `/:instanceId` tests may silently skip if no session instance is seeded — that is acceptable).

- [ ] **Step 3: Update `GET /` in sessions.js (line 40-42)**

  Replace:
  ```js
  const activeCommitments = await prisma.commitment.count({
    where: { templateId: instance.templateId, status: 'ACTIVE' },
  });
  ```

  With:
  ```js
  const today = new Date(); // current timestamp — intentional: any midnight startDate is always lte now
  const activeCommitments = await prisma.commitment.count({
    where: {
      templateId: instance.templateId,
      status: 'ACTIVE',
      OR: [{ startDate: null }, { startDate: { lte: today } }],
    },
  });
  ```

- [ ] **Step 4: Update `GET /:instanceId` in sessions.js (line 126-128)**

  Replace:
  ```js
  const activeCommitments = await prisma.commitment.count({
    where: { templateId: instance.templateId, status: 'ACTIVE' },
  });
  ```

  With:
  ```js
  const today = new Date(); // current timestamp — intentional: any midnight startDate is always lte now
  const activeCommitments = await prisma.commitment.count({
    where: {
      templateId: instance.templateId,
      status: 'ACTIVE',
      OR: [{ startDate: null }, { startDate: { lte: today } }],
    },
  });
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  cd backend && npx jest booking.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  cd backend && git add routes/booking/sessions.js __tests__/booking.commitments.test.js
  git commit -m "feat: exclude future-dated commitments from session capacity counts"
  ```

---

### Task 3: commitments.js — SCHEDULED membership guard, startDate param, cap count fixes

**Files:**
- Modify: `backend/routes/booking/commitments.js:83-134,198-213`
- Test: `backend/__tests__/booking.commitments.test.js`

Three changes in `POST /`:
1. Extend membership guard to allow `SCHEDULED` status.
2. Accept and store `startDate` in the create call.
3. Exclude future-dated commitments from the competitive-slots cap count.

One change in `PATCH /:id/status`:
4. Exclude future-dated commitments from the re-activation cap count.

- [ ] **Step 1: Write the failing tests**

  Add to `describe('POST /api/commitments')` in `booking.commitments.test.js`:

  ```js
  it('succeeds with a SCHEDULED membership', async () => {
    // createGymnast sets bgNumberStatus: 'VERIFIED' by default — required for POST /api/commitments
    const scheduledGymnast = await createGymnast(club, parent);
    // Create a scheduled membership (future startDate avoids Stripe activation)
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await prisma.membership.create({
      data: {
        gymnastId: scheduledGymnast.id,
        clubId: club.id,
        monthlyAmount: 5000,
        status: 'SCHEDULED',
        startDate: new Date(futureDate),
      },
    });

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: scheduledGymnast.id, templateId: template.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('stores startDate when provided', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id, startDate: futureDate });

    expect(res.status).toBe(201);
    expect(res.body.startDate).toBeDefined();
    expect(new Date(res.body.startDate).toISOString().split('T')[0]).toBe(futureDate);
  });
  ```

  > **Cleanup note:** The outer `describe('POST /api/commitments')` already has `afterEach(() => prisma.commitment.deleteMany({}))` at lines 42-44, which clears all commitments between tests. The two new tests below rely on this — no additional cleanup is needed.

  > **Note:** The existing test `'returns 422 if gymnast has no active membership'` (line ~93 in the file) already covers the "no membership → 422" path. After the guard change it continues to cover both "no membership" and "membership is CANCELLED/PAUSED" cases. No new test is needed for that branch.

  Add a new describe block for the cap count:

  ```js
  describe('POST /api/commitments competitive slots cap', () => {
    let capTemplate;

    beforeAll(async () => {
      const sess = await createSession(club, null, { competitiveSlots: 1 });
      capTemplate = sess.template;
    });

    afterEach(async () => {
      await prisma.commitment.deleteMany({ where: { templateId: capTemplate.id } });
    });

    it('future-dated ACTIVE commitment does not count toward competitive slots cap', async () => {
      // Seed one future-dated ACTIVE commitment — cap should not be considered reached
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const otherGymnast = await createGymnast(club, parent);
      await prisma.commitment.create({
        data: {
          gymnastId: otherGymnast.id,
          templateId: capTemplate.id,
          createdById: admin.id,
          status: 'ACTIVE',
          startDate: tomorrow,
        },
      });

      // gymnast still has no commitment to capTemplate; try to add
      const res = await request(app)
        .post('/api/commitments')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ gymnastId: gymnast.id, templateId: capTemplate.id });

      // cap is 1, future-dated slot doesn't count — should succeed as ACTIVE not WAITLISTED
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
    });
  });
  ```

  > **Note on `createSession` override:** `createSession(club, date, templateOverrides)` in `backend/__tests__/helpers/seed.js` already accepts `templateOverrides`. Confirm the signature before running.

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd backend && npx jest booking.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: the new tests fail.

- [ ] **Step 3: Extend membership guard in `POST /` (lines 95-101)**

  Replace:
  ```js
  // Validate gymnast has an active membership
  const activeMembership = await prisma.membership.findFirst({
    where: { gymnastId, status: 'ACTIVE' },
  });
  if (!activeMembership) {
    return res.status(422).json({ error: `${gymnast.firstName} must have an active membership to be given a standing slot` });
  }
  ```

  With:
  ```js
  // Validate gymnast has an active or scheduled membership
  const activeMembership = await prisma.membership.findFirst({
    where: { gymnastId, status: { in: ['ACTIVE', 'SCHEDULED'] } },
  });
  if (!activeMembership) {
    return res.status(422).json({ error: `${gymnast.firstName} must have an active or scheduled membership to be given a standing slot` });
  }
  ```

- [ ] **Step 4: Accept `startDate` from request body in `POST /` (line 83)**

  Replace:
  ```js
  const { gymnastId, templateId } = req.body;
  if (!gymnastId || !templateId) {
    return res.status(400).json({ error: 'gymnastId and templateId are required' });
  }
  ```

  With:
  ```js
  const { gymnastId, templateId, startDate } = req.body;
  if (!gymnastId || !templateId) {
    return res.status(400).json({ error: 'gymnastId and templateId are required' });
  }
  ```

- [ ] **Step 5: Exclude future-dated commitments from the cap count in `POST /` (lines 123-130)**

  Replace:
  ```js
  if (template.competitiveSlots !== null) {
    const activeCount = await prisma.commitment.count({
      where: { templateId, status: 'ACTIVE' },
    });
    if (activeCount >= template.competitiveSlots) {
      commitmentStatus = 'WAITLISTED';
    }
  }
  ```

  With:
  ```js
  if (template.competitiveSlots !== null) {
    const today = new Date();
    const activeCount = await prisma.commitment.count({
      where: {
        templateId,
        status: 'ACTIVE',
        OR: [{ startDate: null }, { startDate: { lte: today } }],
      },
    });
    if (activeCount >= template.competitiveSlots) {
      commitmentStatus = 'WAITLISTED';
    }
  }
  ```

- [ ] **Step 6: Store `startDate` in the create call in `POST /` (line 132-134)**

  Replace:
  ```js
  const commitment = await prisma.commitment.create({
    data: { gymnastId, templateId, createdById: req.user.id, status: commitmentStatus },
  });
  ```

  With:
  ```js
  const commitment = await prisma.commitment.create({
    data: {
      gymnastId,
      templateId,
      createdById: req.user.id,
      status: commitmentStatus,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
    },
  });
  ```

- [ ] **Step 7: Write the failing test for the `PATCH /:id/status` cap fix**

  Add to the `describe('POST /api/commitments competitive slots cap')` block:

  ```js
  it('PATCH /:id/status: future-dated ACTIVE commitment does not block reactivation of a WAITLISTED slot', async () => {
    // Seed a future-dated ACTIVE commitment occupying the cap slot
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const otherGymnast = await createGymnast(club, parent);
    await prisma.commitment.create({
      data: {
        gymnastId: otherGymnast.id,
        templateId: capTemplate.id,
        createdById: admin.id,
        status: 'ACTIVE',
        startDate: tomorrow,
      },
    });

    // Seed a WAITLISTED commitment for gymnast
    const waitlisted = await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: capTemplate.id,
        createdById: admin.id,
        status: 'WAITLISTED',
      },
    });

    // Try to promote the waitlisted slot — should succeed since future-dated slot doesn't count
    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });
  ```

  Run to verify it fails:
  ```bash
  cd backend && npx jest booking.commitments --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 8: Exclude future-dated commitments from cap count in `PATCH /:id/status` (lines 203-213)**

  Replace:
  ```js
  if (template && template.competitiveSlots !== null) {
    const activeCount = await prisma.commitment.count({
      where: { templateId: commitment.templateId, status: 'ACTIVE' },
    });
    if (activeCount >= template.competitiveSlots) {
      const msg = current === 'WAITLISTED'
        ? 'No competitive slot available'
        : 'Competitive slots are full — promote a waitlisted gymnast first or increase the cap';
      return res.status(422).json({ error: msg });
    }
  }
  ```

  With:
  ```js
  if (template && template.competitiveSlots !== null) {
    const today = new Date();
    const activeCount = await prisma.commitment.count({
      where: {
        templateId: commitment.templateId,
        status: 'ACTIVE',
        OR: [{ startDate: null }, { startDate: { lte: today } }],
      },
    });
    if (activeCount >= template.competitiveSlots) {
      const msg = current === 'WAITLISTED'
        ? 'No competitive slot available'
        : 'Competitive slots are full — promote a waitlisted gymnast first or increase the cap';
      return res.status(422).json({ error: msg });
    }
  }
  ```

- [ ] **Step 9: Run tests to verify they pass**

  ```bash
  cd backend && npx jest booking.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 10: Commit**

  ```bash
  cd backend && git add routes/booking/commitments.js __tests__/booking.commitments.test.js
  git commit -m "feat: extend commitment creation to SCHEDULED memberships, store startDate, fix cap counts"
  ```

---

### Task 4: memberships.js — pass startDate to atomic commitment creation

**Files:**
- Modify: `backend/routes/booking/memberships.js:323-327`
- Test: `backend/__tests__/booking.memberships.commitments.test.js`

When a membership is created with `templateIds`, the commitments are created inside a `prisma.$transaction`. They must inherit the membership's `startDate`.

- [ ] **Step 1: Write the failing test**

  Add to `describe('POST /api/booking/memberships with templateIds')` in `booking.memberships.commitments.test.js`:

  ```js
  it('commitments inherit membership startDate', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 4000,
        startDate: futureDate,
        templateIds: [template.id],
      });

    expect(res.status).toBe(201);

    const commitments = await prisma.commitment.findMany({
      where: { gymnastId: gymnast.id, templateId: template.id },
    });
    expect(commitments).toHaveLength(1);
    expect(commitments[0].startDate).not.toBeNull();
    expect(new Date(commitments[0].startDate).toISOString().split('T')[0]).toBe(futureDate);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd backend && npx jest booking.memberships.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: new test fails (`commitments[0].startDate` is null).

- [ ] **Step 3: Update the `tx.commitment.create` call in `memberships.js` (lines 323-327)**

  Replace:
  ```js
  for (const templateId of value.templateIds) {
    await tx.commitment.create({
      data: { gymnastId: value.gymnastId, templateId, createdById: req.user.id },
    });
  }
  ```

  With:
  ```js
  for (const templateId of value.templateIds) {
    await tx.commitment.create({
      data: {
        gymnastId: value.gymnastId,
        templateId,
        createdById: req.user.id,
        startDate: new Date(value.startDate),
      },
    });
  }
  ```

  `value.startDate` is always present — the membership Joi schema declares `startDate: Joi.date().required()`, so the unconditional `new Date(value.startDate)` is safe.

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  cd backend && npx jest booking.memberships.commitments --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 5: Run full backend test suite**

  ```bash
  cd backend && npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  cd backend && git add routes/booking/memberships.js __tests__/booking.memberships.commitments.test.js
  git commit -m "feat: pass membership startDate to atomic commitment creation"
  ```

---

## Chunk 2: Frontend

### Task 5: bookingApi.js — update createCommitment signature

**Files:**
- Modify: `frontend/src/utils/bookingApi.js:206-207`

- [ ] **Step 1: Update `createCommitment` to accept a data object**

  In `frontend/src/utils/bookingApi.js`, replace line 206-207:
  ```js
  createCommitment: (gymnastId, templateId) =>
    axios.post(`${API_URL}/commitments`, { gymnastId, templateId }, { headers: getHeaders() }),
  ```

  With:
  ```js
  createCommitment: (data) =>
    axios.post(`${API_URL}/commitments`, data, { headers: getHeaders() }),
  ```

- [ ] **Step 2: Confirm no other call sites outside AdminMembers.js**

  ```bash
  cd frontend && grep -r "createCommitment" src/
  ```

  Expected: only `bookingApi.js` definition and `AdminMembers.js` usage. The call site in `AdminMembers.js` will be updated in Task 6.

- [ ] **Step 3: Commit**

  ```bash
  cd frontend && git add src/utils/bookingApi.js
  git commit -m "feat: change createCommitment to accept data object"
  ```

---

### Task 6: AdminMembers.js — rework GymnastRow

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

This is the largest change. `GymnastRow` is restructured: the `detailsOpen` state and Details toggle are removed; commitments auto-load on mount; health notes and emergency contact full details move into the always-visible info list; `GymnastMembership` and `RemoveChild` move into the card body; the slots section only appears when a membership exists; the add-slot form gets a date input; "Starts [date]" badges appear on future-dated slots.

Manual verification is required (see Testing section in the spec).

- [ ] **Step 1: Remove `detailsOpen` state (line 338) and add `addingStartDate` state**

  Remove:
  ```js
  const [detailsOpen, setDetailsOpen] = useState(false);
  ```

  Before the `useState` calls, move the `membership` computation (currently at line 428) to be the very first statement inside `GymnastRow`, before any hooks:
  ```js
  const membership = memberships.find(m => m.gymnastId === g.id && m.status !== 'CANCELLED') ?? null;
  ```

  Then add a new `addingStartDate` state (after the existing state declarations):
  ```js
  const defaultStartDate =
    membership?.status === 'SCHEDULED' && membership?.startDate
      ? new Date(membership.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const [addingStartDate, setAddingStartDate] = useState(defaultStartDate);
  ```

  > **Note:** `useState(defaultStartDate)` only uses its argument as the *initial* value — it does not re-sync if membership later transitions from `SCHEDULED` to `ACTIVE`. This is intentional: `onRefresh` triggers a parent re-render that re-mounts the component, resetting the state naturally. Do not add a `useEffect` to sync it.

  Remove the now-duplicate `const membership = ...` that was at line 428 (after hooks).

- [ ] **Step 2: Auto-load commitments on mount**

  Add a `useEffect` import at the top of the file if not already imported (it should be — React is already imported).

  After the `loadCommitments` function definition, add:
  ```js
  useEffect(() => {
    loadCommitments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  ```

- [ ] **Step 3: Update `handleAddCommitment` to pass the data object**

  Replace:
  ```js
  const handleAddCommitment = async () => {
    if (!addingTemplateId) return;
    setCommitmentError(null);
    try {
      await bookingApi.createCommitment(g.id, addingTemplateId);
      setAddingTemplateId('');
      await loadCommitments();
    } catch (err) {
      setCommitmentError(err.response?.data?.error || 'Failed to add commitment.');
    }
  };
  ```

  With:
  ```js
  const handleAddCommitment = async () => {
    if (!addingTemplateId) return;
    setCommitmentError(null);
    try {
      await bookingApi.createCommitment({ gymnastId: g.id, templateId: addingTemplateId, startDate: addingStartDate });
      setAddingTemplateId('');
      await loadCommitments();
    } catch (err) {
      setCommitmentError(err.response?.data?.error || 'Failed to add commitment.');
    }
  };
  ```

- [ ] **Step 4: Replace brief emergency contact summary with full details in info list**

  Find and replace (lines 581-589):
  ```jsx
  {/* Emergency contact (adult participants only) */}
  {g.isSelf && (
    <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
      <span style={keyStyle}>Emergency contact</span>
      {g.emergencyContactName
        ? <span style={{ color: 'var(--booking-success)' }}>✓ On file</span>
        : <span style={{ color: 'var(--booking-danger)' }}>✗ Missing</span>}
    </li>
  )}
  ```

  With (full details + health notes, both added to the list):
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
  {/* Emergency contact (adult participants only) — full details */}
  {g.isSelf && (
    <li style={{ ...infoItemStyle, borderBottom: 'none' }}>
      <span style={keyStyle}>Emergency contact</span>
      <span style={{ textAlign: 'right' }}>
        {g.emergencyContactName
          ? <>
              <span style={{ fontWeight: 500 }}>{g.emergencyContactName}</span>
              {g.emergencyContactRelationship && <span style={{ color: 'var(--booking-text-muted)' }}> ({g.emergencyContactRelationship})</span>}
              {g.emergencyContactPhone && <><br /><a href={`tel:${g.emergencyContactPhone}`} style={{ color: 'var(--booking-accent)' }}>{g.emergencyContactPhone}</a></>}
            </>
          : <span style={{ color: 'var(--booking-danger)' }}>✗ Missing</span>}
      </span>
    </li>
  )}
  ```

- [ ] **Step 5: Replace the standing slots section (lines 592-656) with the new flat "Membership & slots" section**

  The standing slots section (currently lines 592-656) includes:
  - A "Standing slots" title + Load/Refresh button
  - The commitments list
  - The add-slot selector + Add button

  Replace this entire block with:

  ```jsx
  {/* Membership & slots */}
  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--booking-bg-light)' }}>
    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--booking-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
      Membership &amp; slots
    </span>

    {/* Membership management (inline — no border/margin wrapper) */}
    <GymnastMembership gymnast={g} membership={membership} onRefresh={onUpdated} />

    {/* Slots list — only when membership exists */}
    {membership && (
      <>
        {commitmentLoading && <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>Loading...</p>}
        {commitmentError && <p style={{ color: 'var(--booking-danger)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{commitmentError}</p>}
        {commitments !== null && (
          <>
            {commitments.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 0' }}>No standing slots.</p>}
            {commitments.map(c => {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const label = `${days[c.template.dayOfWeek]} ${c.template.startTime}–${c.template.endTime}`;
              const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
              const startsBadge = isFuture
                ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.875rem' }}>
                  <span>
                    {label}
                    {isFuture ? (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#1565c0', background: '#e3f2fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Starts {startsBadge}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: c.status === 'ACTIVE' ? 'var(--booking-success)' : c.status === 'WAITLISTED' ? '#e67e22' : 'var(--booking-text-muted)', fontWeight: 600 }}>
                        {c.status === 'ACTIVE' ? 'Active' : c.status === 'WAITLISTED' ? 'Waitlisted' : 'Paused'}
                      </span>
                    )}
                  </span>
                  <div className="bk-row" style={{ gap: '0.3rem' }}>
                    {c.status !== 'WAITLISTED' && !isFuture && (
                      <button className="bk-btn bk-btn--sm" onClick={() => handleToggleCommitmentStatus(c)}>
                        {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                      onClick={() => handleDeleteCommitment(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Add slot form */}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={addingTemplateId}
                onChange={e => setAddingTemplateId(e.target.value)}
                className="bk-input"
                style={{ fontSize: '0.85rem', flex: 1 }}
              >
                <option value="">Add standing slot...</option>
                {(templates || []).filter(t => t.isActive && !commitments.some(c => c.templateId === t.id)).map(t => {
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return <option key={t.id} value={t.id}>{days[t.dayOfWeek]} {t.startTime}–{t.endTime}{t.type === 'DMT' ? ' · DMT' : ' · Trampoline'}</option>;
                })}
              </select>
              <input
                type="date"
                className="bk-input"
                value={addingStartDate}
                onChange={e => setAddingStartDate(e.target.value)}
                style={{ fontSize: '0.85rem', width: '130px' }}
              />
              <button
                className="bk-btn bk-btn--sm bk-btn--primary"
                disabled={!addingTemplateId}
                onClick={handleAddCommitment}
              >
                Add
              </button>
            </div>
          </>
        )}
      </>
    )}
  </div>
  ```

- [ ] **Step 6: Remove the BG action bar placement (it stays), remove the Details expander and its contents (lines 663-703)**

  Delete the entire block from `{/* Details expander */}` through its closing `)}`:

  ```jsx
  {/* Details expander */}
  <button
    onClick={() => setDetailsOpen(v => !v)}
    ...
  >
    ...
  </button>

  {detailsOpen && (
    <div ...>
      {/* Emergency contact details */}
      ...
      {/* Health notes */}
      ...
      {/* Membership management */}
      <GymnastMembership gymnast={g} membership={membership} onRefresh={onUpdated} />
      {/* Remove child */}
      {!g.isSelf && <RemoveChild gymnast={g} onUpdated={onUpdated} />}
    </div>
  )}
  ```

  Then add `RemoveChild` below the membership & slots section (after the closing `</div>` of the Membership & slots block):

  ```jsx
  {/* Remove gymnast */}
  {!g.isSelf && (
    <div style={{ marginTop: '0.75rem' }}>
      <RemoveChild gymnast={g} onUpdated={onUpdated} />
    </div>
  )}
  ```

  Also delete any remaining `detailsLabel` variable (used by the removed Details button).

- [ ] **Step 7: Restructure `GymnastMembership` render — flat flex row + remove `borderTop`**

  The spec requires the membership row to be a single flex line: summary text left-aligned, action buttons right-aligned. The current layout has status badge + amount on the right of a header row, with buttons stacked below. Replace the entire `return (...)` block inside `GymnastMembership` (lines 769-863) with:

  ```jsx
  return (
    <div>
      {membership && membership.status !== 'CANCELLED' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>
              {membership.status === 'ACTIVE' && (
                <>Active since <strong>{new Date(membership.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
              {membership.status === 'PAUSED' && (
                <>Paused · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
              {membership.status === 'SCHEDULED' && (
                <>Scheduled — starts <strong>{new Date(membership.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> · £{(membership.monthlyAmount / 100).toFixed(2)}/mo</>
              )}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              {membership.status === 'ACTIVE' && (
                <button className="bk-btn bk-btn--sm" disabled={saving}
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => handleStatus('PAUSED')}>Pause</button>
              )}
              {membership.status === 'PAUSED' && (
                <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
                  onClick={() => handleStatus('ACTIVE')}>Resume</button>
              )}
              {membership.status !== 'SCHEDULED' && (
                <button className="bk-btn bk-btn--sm" disabled={saving}
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => { setEditAmount((membership.monthlyAmount / 100).toFixed(2)); setShowEditAmount(v => !v); }}>
                  Edit amount
                </button>
              )}
              <button className="bk-btn bk-btn--sm" disabled={saving}
                style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                onClick={async () => {
                  if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
                  setSaving(true);
                  try { await bookingApi.deleteMembership(membership.id); onRefresh(); }
                  catch (err) { setError(err.response?.data?.error || 'Failed to cancel.'); setSaving(false); }
                }}>Cancel</button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)' }}>No membership</span>
          {!showForm && (
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowForm(true)}>+ Add monthly membership</button>
          )}
        </div>
      )}

      {error && <p className="bk-error" style={{ marginTop: '0.3rem' }}>{error}</p>}

      {membership && showEditAmount && (
        // existing edit-amount form — unchanged
        <div style={{ marginTop: '0.5rem' }}>
          <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>New monthly amount (£)
            <input type="number" step="0.01" min="0.01" className="bk-input"
              value={editAmount} onChange={e => setEditAmount(e.target.value)}
              style={{ marginTop: '0.2rem' }} />
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
              onClick={() => handleEditAmount('create_prorations')}>Apply now (pro-rata)</button>
            <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving}
              onClick={() => handleEditAmount('none')}>Apply from next month</button>
            <button className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowEditAmount(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        // existing add-membership form — unchanged
        <form onSubmit={handleCreate} style={{ marginTop: '0.5rem' }}>
          <div className="bk-grid-2">
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Monthly amount (£)
              <input type="number" step="0.01" min="0.01" className="bk-input"
                value={form.monthlyAmount}
                onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
            <label className="bk-label" style={{ fontWeight: 'normal', fontSize: '0.82rem' }}>Start date
              <input type="date" className="bk-input"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                required style={{ marginTop: '0.2rem' }} />
            </label>
          </div>
          <div className="bk-row" style={{ gap: '0.3rem' }}>
            <button type="submit" disabled={saving} className="bk-btn bk-btn--sm bk-btn--primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }}
              onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
  ```

  > **Key changes:** outer wrapper `borderTop` removed; status+amount and buttons merged into one `space-between` flex row; "Edit amount" hidden for `SCHEDULED` memberships; button label shortened from "Cancel membership" to "Cancel"; "No membership" + Add button shown in same flex row.

- [ ] **Step 8: Verify the page renders correctly in the browser**

  Manually verify all cases from the spec:
  - Gymnast with active membership: membership row visible; slots list below; no Details toggle visible
  - Gymnast with scheduled membership: "SCHEDULED" status; slots show "Starts [date]" badge; no Pause button on future-dated slots
  - Gymnast with no membership: membership section shows; no slots list shown
  - Health notes and emergency contact visible in info list (no expand needed)
  - Remove gymnast button visible below membership & slots section (for non-isSelf gymnasts)
  - "Add slot" form: date defaults correctly for active vs scheduled membership
  - Future-dated slot: badge shown; no Pause button; Remove button present

- [ ] **Step 9: Commit**

  ```bash
  cd frontend && git add src/pages/booking/admin/AdminMembers.js
  git commit -m "feat: flatten GymnastRow, auto-load commitments, add startDate to add-slot form"
  ```

---

### Task 7: SessionTemplates.js + BookingAdmin.js — "Starts [date]" badges

**Files:**
- Modify: `frontend/src/pages/booking/admin/SessionTemplates.js:418-425`
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js:248-257`

- [ ] **Step 1: Add "Starts [date]" badge in `SessionTemplates.js` active commitments list**

  Find the active commitments row (currently at line ~418-425):
  ```jsx
  {active.map(c => (
    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
      <span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <button className="bk-btn bk-btn--sm" onClick={() => handlePauseCommitment(t.id, c.id)}>Pause</button>
        <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
      </div>
    </div>
  ))}
  ```

  Replace with:
  ```jsx
  {active.map(c => {
    const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
    const startsBadge = isFuture
      ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return (
      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
        <span>
          {c.gymnast.firstName} {c.gymnast.lastName}
          {isFuture && (
            <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#1565c0', background: '#e3f2fd', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              Starts {startsBadge}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {!isFuture && <button className="bk-btn bk-btn--sm" onClick={() => handlePauseCommitment(t.id, c.id)}>Pause</button>}
          <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
        </div>
      </div>
    );
  })}
  ```

  > **Note:** The Pause button is omitted for future-dated active commitments (UI-only guard, consistent with `AdminMembers.js`). No structural change to the Active / Paused / Waitlist grouping.

- [ ] **Step 2: Add "Starts [date]" badge in `BookingAdmin.js` standing slots list**

  Find the standing slots row (currently at line ~248-257):
  ```jsx
  {!slotsLoading && standingSlots && standingSlots.filter(c => c.status !== 'WAITLISTED').map(c => (
    <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--booking-bg-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.9rem' }}>{c.gymnast.firstName} {c.gymnast.lastName}</span>
      {c.status === 'PAUSED' && (
        <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'var(--booking-text-muted)' }}>
          Paused
        </span>
      )}
    </div>
  ))}
  ```

  Replace with:
  ```jsx
  {!slotsLoading && standingSlots && standingSlots.filter(c => c.status !== 'WAITLISTED').map(c => {
    const isFuture = c.status === 'ACTIVE' && c.startDate && new Date(c.startDate) > new Date();
    const startsBadge = isFuture
      ? new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;
    return (
      <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--booking-bg-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem' }}>{c.gymnast.firstName} {c.gymnast.lastName}</span>
        {isFuture ? (
          <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', fontWeight: 600 }}>
            Starts {startsBadge}
          </span>
        ) : c.status === 'PAUSED' ? (
          <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'var(--booking-text-muted)' }}>
            Paused
          </span>
        ) : null}
      </div>
    );
  })}
  ```

- [ ] **Step 3: Verify both views show badges correctly in the browser**

  - Open `SessionTemplates.js` view — active commitments with future `startDate` show "Starts [date]" badge; Pause button absent
  - Open `BookingAdmin.js` session detail — future-dated active commitments show "Starts [date]" badge inline

- [ ] **Step 4: Run full backend test suite to confirm no regressions**

  ```bash
  cd backend && npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd frontend && git add src/pages/booking/admin/SessionTemplates.js src/pages/booking/admin/BookingAdmin.js
  git commit -m "feat: show Starts [date] badge for future-dated commitments in template and session views"
  ```

---

## Testing Checklist

After completing all tasks, verify manually:

- [ ] Session capacity unaffected by future-dated commitments (create a future-dated slot and confirm the session still shows full availability)
- [ ] Admin member view: no "Details" toggle; all info (health notes, emergency contact) visible without expanding
- [ ] Gymnast with active membership: slots list visible; "Add slot" date defaults to today
- [ ] Gymnast with scheduled membership: "SCHEDULED" badge; slots show "Starts [date]"; no Pause button on future slots; "Add slot" date defaults to membership startDate
- [ ] Gymnast with no membership: no slots section shown
- [ ] Future-dated slot: "Starts [date]" badge; no Pause button; Remove button present
- [ ] "Starts [date]" badge appears in SessionTemplates.js and BookingAdmin.js
- [ ] All 172+ backend tests pass
