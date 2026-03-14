# Commitments Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce standing slot commitments that link gymnasts to session templates perpetually, with capacity and booking enforcement, admin UI, and membership-integrated creation.

**Architecture:** New `Commitment` model (gymnast → template, ACTIVE/PAUSED status) lives outside the per-instance `Booking` model. Session capacity is computed as `bookings + active commitments`. A new `/api/commitments` route handles CRUD. Membership creation atomically creates the initial commitments. The frontend adds commitment management to three existing admin components and a standing-slot indicator to `SessionDetail.js`.

**Tech Stack:** Node/Express + Prisma 5 + PostgreSQL (backend); React 18 (frontend); supertest + Jest (backend tests).

**Spec:** `docs/superpowers/specs/2026-03-14-commitments-phase2-design.md`

---

## Chunk 1: Database + Backend

### Task 1: Database Schema + Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: Add CommitmentStatus enum to schema**

Open `backend/prisma/schema.prisma`. After the `SessionType` enum, add:

```prisma
enum CommitmentStatus {
  ACTIVE
  PAUSED
}
```

- [ ] **Step 2: Add Commitment model**

After the `SessionTemplate` model, add:

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
  createdById  String
  createdBy    User             @relation("CommitmentCreatedBy", fields: [createdById], references: [id])
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@unique([gymnastId, templateId])
}
```

- [ ] **Step 3: Add reverse relations**

In the `Gymnast` model, add:
```prisma
commitments      Commitment[]
```

In the `SessionTemplate` model, add:
```prisma
commitments      Commitment[]
```

In the `User` model, add:
```prisma
commitmentsCreated  Commitment[]  @relation("CommitmentCreatedBy")
commitmentsPaused   Commitment[]  @relation("CommitmentPausedBy")
```

- [ ] **Step 4: Run migration**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx prisma migrate dev --name add_commitments
```

Expected: migration created and applied, `Prisma Client` regenerated.

- [ ] **Step 5: Update cleanDatabase() in db.js**

Open `backend/__tests__/helpers/db.js`. The `cleanDatabase()` function must delete `Commitment` rows before deleting gymnasts (Cascade handles gymnast deletion, but the `onDelete: Restrict` on the template FK means `sessionTemplate.deleteMany` will throw if commitments exist).

Add two deletions in the correct order:

**Before** `await prisma.gymnast.deleteMany({ where: { id: { in: testGymnastIds } } })` (line 47), add:
```js
await prisma.commitment.deleteMany({ where: { gymnastId: { in: testGymnastIds } } });
```

**Before** `await prisma.sessionTemplate.deleteMany(...)` (line 55), add:
```js
await prisma.commitment.deleteMany({ where: { template: { club: { name: 'Test Club TL' } } } });
```

- [ ] **Step 6: Verify**

```bash
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx prisma studio
```

Confirm `Commitment` table exists with all columns. Then close Studio.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/__tests__/helpers/db.js
git commit -m "feat: add Commitment model and CommitmentStatus enum; update cleanDatabase"
```

---

### Task 2: Commitments Route — Write Endpoints (POST, DELETE, PATCH)

**Files:**
- Create: `backend/routes/booking/commitments.js`
- Modify: `backend/server.js`
- Modify: `backend/__tests__/helpers/create-test-app.js`
- Create: `backend/__tests__/booking.commitments.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/booking.commitments.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, coach, coachToken, parent, parentToken, gymnast, template;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `commit-admin-${Date.now()}@test.tl` });
  coach = await createParent(club, { role: 'COACH', email: `commit-coach-${Date.now()}@test.tl` });
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  const sess = await createSession(club);
  template = sess.template;
  adminToken = tokenFor(admin);
  coachToken = tokenFor(coach);
  parentToken = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// Helper: create a commitment directly in DB for reuse across tests
async function seedCommitment(overrides = {}) {
  return prisma.commitment.create({
    data: {
      gymnastId: gymnast.id,
      templateId: template.id,
      createdById: coach.id,
      ...overrides,
    },
  });
}

describe('POST /api/commitments', () => {
  afterEach(async () => {
    await prisma.commitment.deleteMany({});
  });

  it('coach can create a commitment', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.createdById).toBe(coach.id);
  });

  it('returns 409 if commitment already exists', async () => {
    await seedCommitment();
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(409);
  });

  it('returns 404 if gymnast not in club', async () => {
    const otherClub = await createTestClub();
    const otherGymnast = await createGymnast(otherClub, parent);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: otherGymnast.id, templateId: template.id });

    expect(res.status).toBe(404);
  });

  it('returns 400 if template not in club', async () => {
    const otherClub = await createTestClub();
    const { template: otherTemplate } = await createSession(otherClub);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: otherTemplate.id });

    expect(res.status).toBe(400);
  });

  it('returns 403 if parent tries to create commitment', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(403);
  });

  it('creates an audit log entry', async () => {
    await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.create' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ gymnastId: gymnast.id, templateId: template.id });
  });
});

describe('DELETE /api/commitments/:id', () => {
  let commitment;
  beforeEach(async () => { commitment = await seedCommitment(); });
  afterEach(async () => { await prisma.commitment.deleteMany({}); });

  it('coach can delete a commitment', async () => {
    const res = await request(app)
      .delete(`/api/commitments/${commitment.id}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const found = await prisma.commitment.findUnique({ where: { id: commitment.id } });
    expect(found).toBeNull();
  });

  it('returns 404 for unknown commitment', async () => {
    const res = await request(app)
      .delete('/api/commitments/nonexistent-id')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/commitments/:id/status', () => {
  let commitment;
  beforeEach(async () => { commitment = await seedCommitment(); });
  afterEach(async () => { await prisma.commitment.deleteMany({}); });

  it('coach can pause a commitment', async () => {
    const res = await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAUSED');
    expect(res.body.pausedAt).toBeTruthy();
    expect(res.body.pausedById).toBe(coach.id);
  });

  it('coach can resume a commitment', async () => {
    // First pause it
    await prisma.commitment.update({
      where: { id: commitment.id },
      data: { status: 'PAUSED', pausedAt: new Date(), pausedById: coach.id },
    });

    const res = await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.pausedAt).toBeNull();
    expect(res.body.pausedById).toBeNull();
  });

  it('creates an audit log entry on status change', async () => {
    await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.status' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ status: 'PAUSED' });
  });
});
```

- [ ] **Step 2: Add route to create-test-app.js**

Open `backend/__tests__/helpers/create-test-app.js`. After the line `app.use('/api/booking/memberships', ...)`, add:

```js
app.use('/api/commitments', require('../../routes/booking/commitments'));
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.commitments.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL with `Cannot find module '../../routes/booking/commitments'`

- [ ] **Step 4: Create the commitments route**

Create `backend/routes/booking/commitments.js`:

```js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/commitments/mine?templateId=xxx — auth only, scoped to requesting user's gymnasts
// MUST be declared before GET /:id to avoid Express matching "mine" as an :id param
router.get('/mine', auth, async (req, res) => {
  try {
    const { templateId } = req.query;
    if (!templateId) return res.status(400).json({ error: 'templateId query param required' });

    // Support both PARENT (gymnasts linked via guardians) and GYMNAST (userId field)
    const myGymnasts = await prisma.gymnast.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { guardians: { some: { id: req.user.id } } },
        ],
      },
      select: { id: true },
    });
    const myGymnastIds = myGymnasts.map(g => g.id);

    const commitments = await prisma.commitment.findMany({
      where: { templateId, gymnastId: { in: myGymnastIds } },
      select: { gymnastId: true, status: true },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/commitments?templateId=xxx — admin/coach only
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { templateId } = req.query;
    if (!templateId) return res.status(400).json({ error: 'templateId query param required' });

    const commitments = await prisma.commitment.findMany({
      where: { templateId, gymnast: { clubId: req.user.clubId } },
      include: { gymnast: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/commitments/gymnast/:gymnastId — admin/coach only
router.get('/gymnast/:gymnastId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: req.params.gymnastId, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    const commitments = await prisma.commitment.findMany({
      where: { gymnastId: req.params.gymnastId },
      include: { template: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/commitments — admin/coach only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { gymnastId, templateId } = req.body;
    if (!gymnastId || !templateId) {
      return res.status(400).json({ error: 'gymnastId and templateId are required' });
    }

    // Validate gymnast belongs to caller's club
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: gymnastId, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    // Validate template belongs to caller's club
    const template = await prisma.sessionTemplate.findFirst({
      where: { id: templateId, clubId: req.user.clubId },
    });
    if (!template) return res.status(400).json({ error: 'Session template not found' });

    // Check for existing commitment (unique constraint)
    const existing = await prisma.commitment.findUnique({
      where: { gymnastId_templateId: { gymnastId, templateId } },
    });
    if (existing) return res.status(409).json({ error: 'Commitment already exists for this gymnast and template' });

    const commitment = await prisma.commitment.create({
      data: { gymnastId, templateId, createdById: req.user.id },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.create', entityType: 'Commitment', entityId: commitment.id,
      metadata: { gymnastId, templateId },
    });

    res.status(201).json(commitment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/commitments/:id — admin/coach only
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const commitment = await prisma.commitment.findUnique({
      where: { id: req.params.id },
      include: { gymnast: true },
    });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (commitment.gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    await prisma.commitment.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.delete', entityType: 'Commitment', entityId: req.params.id,
      metadata: { gymnastId: commitment.gymnastId, templateId: commitment.templateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/commitments/:id/status — admin/coach only
router.patch('/:id/status', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or PAUSED' });
    }

    const commitment = await prisma.commitment.findUnique({
      where: { id: req.params.id },
      include: { gymnast: true },
    });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (commitment.gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const data = status === 'PAUSED'
      ? { status: 'PAUSED', pausedAt: new Date(), pausedById: req.user.id }
      : { status: 'ACTIVE', pausedAt: null, pausedById: null };

    const updated = await prisma.commitment.update({ where: { id: req.params.id }, data });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.status', entityType: 'Commitment', entityId: req.params.id,
      metadata: { status, gymnastId: commitment.gymnastId, templateId: commitment.templateId },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 5: Mount route in server.js**

Open `backend/server.js`. After line `app.use('/api/booking/memberships', ...)`, add:

```js
app.use('/api/commitments', require('./routes/booking/commitments'));
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.commitments.test.js --no-coverage --runInBand 2>&1 | tail -25
```

Expected: all tests in `booking.commitments.test.js` PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/booking/commitments.js backend/server.js backend/__tests__/helpers/create-test-app.js backend/__tests__/booking.commitments.test.js
git commit -m "feat: add commitments route (POST, DELETE, PATCH /status) with tests"
```

---

### Task 3: Commitments Route — Read Endpoints Tests

**Files:**
- Modify: `backend/__tests__/booking.commitments.test.js`

- [ ] **Step 1: Add GET endpoint tests**

Append to `backend/__tests__/booking.commitments.test.js`:

```js
describe('GET /api/commitments?templateId=xxx', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('admin lists commitments for a template', async () => {
    const res = await request(app)
      .get(`/api/commitments?templateId=${template.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(commitment.id);
    expect(res.body[0].gymnast.firstName).toBeDefined();
  });

  it('returns 400 if templateId is absent', async () => {
    const res = await request(app)
      .get('/api/commitments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 403 for parent', async () => {
    const res = await request(app)
      .get(`/api/commitments?templateId=${template.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/commitments/gymnast/:gymnastId', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('admin lists commitments for a gymnast', async () => {
    const res = await request(app)
      .get(`/api/commitments/gymnast/${gymnast.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(commitment.id);
    expect(res.body[0].template.dayOfWeek).toBeDefined();
  });
});

describe('GET /api/commitments/mine?templateId=xxx', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('parent sees their gymnast commitment status', async () => {
    // gymnast is linked to parent via the guardians relation (createGymnast does this).
    // The /mine endpoint queries both userId and guardians, so parent role works via guardians.
    const res = await request(app)
      .get(`/api/commitments/mine?templateId=${template.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some(c => c.gymnastId === gymnast.id)).toBe(true);
    expect(res.body[0].status).toBe('ACTIVE');
  });

  it('returns 400 if templateId is absent', async () => {
    const res = await request(app)
      .get('/api/commitments/mine')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(400);
  });

  it('does not return commitments for other users gymnasts', async () => {
    const otherParent = await createParent(club, { email: `other-${Date.now()}@test.tl` });
    const otherToken = tokenFor(otherParent);

    const res = await request(app)
      .get(`/api/commitments/mine?templateId=${template.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.commitments.test.js --no-coverage --runInBand 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/booking.commitments.test.js
git commit -m "test: add GET endpoint tests for commitments route"
```

---

### Task 4: sessions.js — Active Commitments in Capacity

**Files:**
- Modify: `backend/routes/booking/sessions.js`
- Modify: `backend/__tests__/booking.sessions.type.test.js`

- [ ] **Step 1: Write failing tests**

Open `backend/__tests__/booking.sessions.type.test.js`. Append a new describe block:

```js
describe('Session capacity accounts for active commitments', () => {
  let club2, coach2, coachToken2, gymnast2, template2, instance2;

  beforeAll(async () => {
    club2 = await createTestClub();
    coach2 = await createParent(club2, { role: 'COACH', email: `cap-coach-${Date.now()}@test.tl` });
    coachToken2 = tokenFor(coach2);
    const parent2 = await createParent(club2);
    gymnast2 = await createGymnast(club2, parent2);
    ({ template: template2, instance: instance2 } = await createSession(club2));

    // Create an ACTIVE commitment — this should count against capacity
    await prisma.commitment.create({
      data: { gymnastId: gymnast2.id, templateId: template2.id, createdById: coach2.id },
    });
  });

  afterAll(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: template2.id } });
  });

  it('GET / includes activeCommitments in bookedCount', async () => {
    const { year, month } = (() => {
      const d = instance2.date;
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    })();

    const res = await request(app)
      .get(`/api/booking/sessions?year=${year}&month=${month}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.id === instance2.id);
    expect(sess).toBeDefined();
    expect(sess.bookedCount).toBe(1); // 0 bookings + 1 active commitment
    expect(sess.activeCommitments).toBe(1);
    expect(sess.availableSlots).toBe(template2.openSlots - 1);
  });

  it('GET /:instanceId includes activeCommitments and templateId', async () => {
    const res = await request(app)
      .get(`/api/booking/sessions/${instance2.id}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.status).toBe(200);
    expect(res.body.bookedCount).toBe(1);
    expect(res.body.activeCommitments).toBe(1);
    expect(res.body.templateId).toBe(template2.id);
  });

  it('paused commitment does not count against capacity', async () => {
    await prisma.commitment.updateMany({
      where: { templateId: template2.id },
      data: { status: 'PAUSED' },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance2.id}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.body.bookedCount).toBe(0);
    expect(res.body.activeCommitments).toBe(0);

    // Reset for other tests
    await prisma.commitment.updateMany({
      where: { templateId: template2.id },
      data: { status: 'ACTIVE' },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.sessions.type.test.js --no-coverage --runInBand 2>&1 | tail -20
```

Expected: FAIL — `activeCommitments` and `templateId` not in response.

- [ ] **Step 3: Update sessions.js GET /**

Open `backend/routes/booking/sessions.js`. The `GET /` handler currently has a synchronous `.map()` followed by `res.json(result)` (around lines 37-57). The map must become async because each iteration needs to await a DB query. Replace the entire map + res.json block:

```js
// The map callback must be async AND the whole thing wrapped in Promise.all.
// instance.templateId is a FK field already on the SessionInstance object — no schema change needed.
const result = await Promise.all(instances.map(async instance => {
  const confirmedBookings = instance.bookings;
  const bookingCount = confirmedBookings.reduce((sum, b) => sum + b.lines.length, 0);
  const activeCommitments = await prisma.commitment.count({
    where: { templateId: instance.templateId, status: 'ACTIVE' },
  });
  const bookedCount = bookingCount + activeCommitments;
  const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
  return {
    id: instance.id,
    date: instance.date,
    startTime: instance.template.startTime,
    endTime: instance.template.endTime,
    minAge: instance.template.minAge,
    capacity,
    bookedCount,
    activeCommitments,
    availableSlots: Math.max(0, capacity - bookedCount),
    cancelledAt: instance.cancelledAt,
    isBooked: confirmedBookings.some(b => b.userId === req.user.id),
    pricePerGymnast: instance.template.pricePerGymnast,
    type: instance.template.type,
    templateId: instance.templateId,
  };
}));

res.json(result);
```

Remove the old `res.json(result)` that was at the end of the original block if it's now duplicated.

- [ ] **Step 4: Update sessions.js GET /:instanceId**

In the `GET /:instanceId` handler, update the response object (around lines 100-116):

```js
// After: const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
// Add:
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
const totalBookedCount = bookedCount + activeCommitments;

// Update the res.json call:
res.json({
  id: instance.id,
  date: instance.date,
  startTime: instance.template.startTime,
  endTime: instance.template.endTime,
  minAge: instance.template.minAge,
  information: instance.template.information || null,
  capacity,
  bookedCount: totalBookedCount,
  activeCommitments,
  availableSlots: Math.max(0, capacity - totalBookedCount),
  cancelledAt: instance.cancelledAt,
  type: instance.template.type,
  templateId: instance.templateId,
  bookings: instance.bookings,
});
```

- [ ] **Step 5: Run tests**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.sessions.type.test.js --no-coverage --runInBand 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/sessions.js backend/__tests__/booking.sessions.type.test.js
git commit -m "feat: include active commitments in session capacity (sessions.js)"
```

---

### Task 5: bookings.js — Commitment Capacity + Block Check

**Files:**
- Modify: `backend/routes/booking/bookings.js`
- Modify: `backend/__tests__/booking.bookings.test.js`

- [ ] **Step 1: Write failing tests**

Open `backend/__tests__/booking.bookings.test.js`. Find the end of the file and append a new describe block:

```js
describe('Commitment enforcement in booking', () => {
  let club3, coach3, parent3, gymnast3, template3, instance3, coachToken3, parentToken3;

  beforeAll(async () => {
    club3 = await createTestClub();
    coach3 = await createParent(club3, { role: 'COACH', email: `bk-coach3-${Date.now()}@test.tl` });
    parent3 = await createParent(club3, { email: `bk-parent3-${Date.now()}@test.tl` });
    gymnast3 = await createGymnast(club3, parent3);
    ({ template: template3, instance: instance3 } = await createSession(club3));
    coachToken3 = tokenFor(coach3);
    parentToken3 = tokenFor(parent3);
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: template3.id } });
    await prisma.booking.deleteMany({ where: { sessionInstanceId: instance3.id } });
  });

  it('cannot book when capacity is full due to commitments', async () => {
    // Fill all slots with commitments
    const template3WithCapacity = await prisma.sessionTemplate.findUnique({ where: { id: template3.id } });
    for (let i = 0; i < template3WithCapacity.openSlots; i++) {
      const g = await createGymnast(club3, parent3);
      await prisma.commitment.create({ data: { gymnastId: g.id, templateId: template3.id, createdById: coach3.id } });
    }

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough slots/i);
  });

  it('gymnast with ACTIVE commitment cannot book the same template session', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast3.id, templateId: template3.id, createdById: coach3.id },
    });

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/standing slot/i);
  });

  it('gymnast with PAUSED commitment can book', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast3.id, templateId: template3.id, createdById: coach3.id, status: 'PAUSED' },
    });

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.bookings.test.js --no-coverage --runInBand 2>&1 | grep -E "FAIL|PASS|✓|✗|●" | tail -20
```

Expected: new tests FAIL.

- [ ] **Step 3: Update POST / capacity + block check**

Open `backend/routes/booking/bookings.js`. In the `POST /` handler, find the capacity check block (around lines 106-111):

```js
// OLD:
const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
if (bookedCount + gymnastIds.length > capacity) {
  return res.status(400).json({ error: 'Not enough slots available' });
}
```

Replace with:

```js
const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
const activeCommitments = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
if (bookedCount + activeCommitments + gymnastIds.length > capacity) {
  return res.status(400).json({ error: 'Not enough slots available' });
}
```

After the DMT check block (after the `if (instance.template.type === 'DMT')` block that returns on blocked gymnasts), add the commitment block check:

```js
// Commitment block check
const committedGymnasts = await prisma.commitment.findMany({
  where: { gymnastId: { in: gymnastIds }, templateId: instance.templateId, status: 'ACTIVE' },
  include: { gymnast: { select: { firstName: true } } },
});
if (committedGymnasts.length > 0) {
  const names = committedGymnasts.map(c => c.gymnast.firstName).join(', ');
  return res.status(400).json({
    error: `The following gymnasts already have a standing slot for this session: ${names}`,
  });
}
```

- [ ] **Step 4: Update POST /batch capacity + block check**

In the `POST /batch` handler, find the capacity check (around lines 309-313):

```js
// OLD:
const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
if (bookedCount + gymnastIds.length > capacity) {
  return res.status(400).json({ error: `Not enough slots available for session at ${instance.date} ${instance.template.startTime}` });
}
```

Replace with:

```js
const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
const activeCommitmentsCount = await prisma.commitment.count({
  where: { templateId: instance.templateId, status: 'ACTIVE' },
});
const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
if (bookedCount + activeCommitmentsCount + gymnastIds.length > capacity) {
  return res.status(400).json({ error: `Not enough slots available for session at ${instance.date} ${instance.template.startTime}` });
}
```

After the DMT check inside the batch loop (i.e., still inside the `for (const item of items)` loop, where `instance.templateId` refers to this specific item's template), add the commitment block check — scoped to this item's template:

```js
// Inside the for (const item of items) loop, after the DMT check:
const committedInBatch = await prisma.commitment.findMany({
  where: { gymnastId: { in: gymnastIds }, templateId: instance.templateId, status: 'ACTIVE' },
  include: { gymnast: { select: { firstName: true } } },
});
if (committedInBatch.length > 0) {
  const names = committedInBatch.map(c => c.gymnast.firstName).join(', ');
  return res.status(400).json({
    error: `The following gymnasts already have a standing slot for this session: ${names}`,
  });
}
```

This is per-item (scoped to `instance.templateId`) — not a cross-item check. Each item in the batch is validated independently.

- [ ] **Step 5: Update POST /combined capacity + block check**

In the `POST /combined` handler, find the capacity check (around lines 670-674). Apply the same two-part change: add `activeCommitmentsCount` to capacity check, then after the DMT check inside the `for (const item of sessions)` loop, add the per-item commitment block check (same pattern as Task 5 Step 4 — use `instance.templateId` for that specific session item).

- [ ] **Step 6: Run tests**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.bookings.test.js --no-coverage --runInBand 2>&1 | grep -E "FAIL|PASS|Tests:" | tail -10
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/booking/bookings.js backend/__tests__/booking.bookings.test.js
git commit -m "feat: enforce commitment capacity and block in bookings (POST, batch, combined)"
```

---

### Task 6: memberships.js — Atomic Commitment Creation

**Files:**
- Modify: `backend/routes/booking/memberships.js`
- Create: `backend/__tests__/booking.memberships.commitments.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/booking.memberships.commitments.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, parent, gymnast, template;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `mem-commit-admin-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `mem-commit-parent-${Date.now()}@test.tl` });
  gymnast = await createGymnast(club, parent);
  ({ template } = await createSession(club));
  adminToken = tokenFor(admin);
});

afterEach(async () => {
  await prisma.commitment.deleteMany({});
  await prisma.membership.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/memberships with templateIds', () => {
  const today = new Date().toISOString().split('T')[0];

  it('creates commitments atomically with membership', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: today,
        templateIds: [template.id],
      });

    expect(res.status).toBe(201);

    const commitments = await prisma.commitment.findMany({
      where: { gymnastId: gymnast.id, templateId: template.id },
    });
    expect(commitments).toHaveLength(1);
    expect(commitments[0].status).toBe('ACTIVE');
  });

  it('returns 400 if a templateId does not belong to the club', async () => {
    const otherClub = await createTestClub();
    const { template: otherTemplate } = await createSession(otherClub);

    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: today,
        templateIds: [otherTemplate.id],
      });

    expect(res.status).toBe(400);
    // No membership should have been created (atomic failure)
    const mem = await prisma.membership.findFirst({ where: { gymnastId: gymnast.id } });
    expect(mem).toBeNull();
  });

  it('returns 409 if gymnast already has a commitment to one of the templates', async () => {
    // Pre-create a commitment
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: template.id, createdById: admin.id },
    });

    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: today,
        templateIds: [template.id],
      });

    expect(res.status).toBe(409);
    // Only 1 commitment (the pre-existing one)
    const count = await prisma.commitment.count({ where: { gymnastId: gymnast.id } });
    expect(count).toBe(1);
  });

  it('creates membership without commitments when templateIds is empty', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: today,
        templateIds: [],
      });

    expect(res.status).toBe(201);
    const count = await prisma.commitment.count({ where: { gymnastId: gymnast.id } });
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.memberships.commitments.test.js --no-coverage --runInBand 2>&1 | tail -15
```

Expected: FAIL — templateIds not accepted.

- [ ] **Step 3: Update memberships.js POST /**

Open `backend/routes/booking/memberships.js`. Find the POST / handler (line 258).

**Update the Joi schema** to accept `templateIds`:

```js
// OLD:
const { error, value } = Joi.object({
  gymnastId: Joi.string().required(),
  monthlyAmount: Joi.number().integer().min(1).required(),
  startDate: Joi.date().required(),
}).validate(req.body);

// NEW:
const { error, value } = Joi.object({
  gymnastId: Joi.string().required(),
  monthlyAmount: Joi.number().integer().min(1).required(),
  startDate: Joi.date().required(),
  templateIds: Joi.array().items(Joi.string()).optional().default([]),
}).validate(req.body);
```

**Add template validation before the membership create** (after the `existing` membership check, before `const startDate = new Date(value.startDate)`):

```js
// Validate templateIds belong to this club and have no existing commitments
if (value.templateIds.length > 0) {
  const templates = await prisma.sessionTemplate.findMany({
    where: { id: { in: value.templateIds }, clubId: req.user.clubId },
  });
  if (templates.length !== value.templateIds.length) {
    return res.status(400).json({ error: 'One or more session templates not found' });
  }

  const existingCommitments = await prisma.commitment.findMany({
    where: { gymnastId: value.gymnastId, templateId: { in: value.templateIds } },
  });
  if (existingCommitments.length > 0) {
    return res.status(409).json({ error: 'Gymnast already has a commitment to one or more of these templates' });
  }
}
```

**Wrap membership creation and commitment creation in a transaction.** The existing code at line 293 does `const membership = await prisma.membership.create(...)`. Replace that single line with the transaction — the variable name `membership` stays the same so the `audit()` and `activateMembership()` calls below it are unaffected:

```js
// Replace:
//   const membership = await prisma.membership.create({ data: { ... }, include: { gymnast: true } });
// With:
const membership = await prisma.$transaction(async (tx) => {
  const created = await tx.membership.create({
    data: {
      gymnastId: value.gymnastId,
      clubId: req.user.clubId,
      monthlyAmount: value.monthlyAmount,
      status: 'SCHEDULED',
      startDate,
    },
    include: { gymnast: true },
  });

  for (const templateId of value.templateIds) {
    await tx.commitment.create({
      data: { gymnastId: value.gymnastId, templateId, createdById: req.user.id },
    });
  }

  return created;
});
// membership.id is now available — audit() and activateMembership() below use it unchanged.
```

- [ ] **Step 4: Run tests**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest booking.memberships.commitments.test.js --no-coverage --runInBand 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 5: Run full backend test suite to check nothing is broken**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest --no-coverage --runInBand 2>&1 | grep -E "Tests:|Test Suites:" | tail -5
```

Expected: all test suites PASS (or same failures as before this work).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/memberships.js backend/__tests__/booking.memberships.commitments.test.js
git commit -m "feat: create commitments atomically when starting a membership"
```

---

## Chunk 2: Frontend

### Task 7: bookingApi.js — New Commitment Methods

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

- [ ] **Step 1: Add commitment API methods**

Open `frontend/src/utils/bookingApi.js`. The file has `export const bookingApi = { ... }` (a named export object) starting at line 9. Add the 6 commitment methods **inside** that object, at the end before the closing `}`:

```js
// Inside the bookingApi object, before the closing }:
getCommitmentsForTemplate: (templateId) =>
  axios.get(`${API_URL}/commitments?templateId=${templateId}`, { headers: getHeaders() }),
getCommitmentsForGymnast: (gymnastId) =>
  axios.get(`${API_URL}/commitments/gymnast/${gymnastId}`, { headers: getHeaders() }),
getMyCommitmentsForTemplate: (templateId) =>
  axios.get(`${API_URL}/commitments/mine?templateId=${templateId}`, { headers: getHeaders() }),
createCommitment: (gymnastId, templateId) =>
  axios.post(`${API_URL}/commitments`, { gymnastId, templateId }, { headers: getHeaders() }),
updateCommitmentStatus: (commitmentId, status) =>
  axios.patch(`${API_URL}/commitments/${commitmentId}/status`, { status }, { headers: getHeaders() }),
deleteCommitment: (commitmentId) =>
  axios.delete(`${API_URL}/commitments/${commitmentId}`, { headers: getHeaders() }),
```

Note: `getTemplates` is a **separate named export** at line 208 (not on the bookingApi object) — import it as `import { bookingApi, getTemplates } from '...'` wherever you need both.

- [ ] **Step 2: Verify the file looks right**

```bash
grep -n "Commitments\|getCommitmentsForTemplate\|deleteCommitment" frontend/src/utils/bookingApi.js
```

Expected: all 6 new methods listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add commitment API methods to bookingApi.js"
```

---

### Task 8: AdminMemberships.js — Template Multi-Select

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMemberships.js`

- [ ] **Step 1: Add templates state**

Open `frontend/src/pages/booking/admin/AdminMemberships.js`.

Update the form initial state (line 15) to include `templateIds`:

```js
const [form, setForm] = useState({ gymnastId: '', monthlyAmount: '', startDate: '', templateIds: [] });
const [templates, setTemplates] = useState([]);
```

- [ ] **Step 2: Load templates**

`getTemplates` is a **named export** (not on the bookingApi object). Update the import at the top of the file:

```js
// Change:
import { bookingApi } from '../../../utils/bookingApi';
// To:
import { bookingApi, getTemplates } from '../../../utils/bookingApi';
```

Then update the `load` function to fetch templates:

```js
const load = () => {
  bookingApi.getMemberships().then(res => setMemberships(res.data));
  getTemplates().then(res => setTemplates(res.data));
  const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
  fetch(`${API_URL}/gymnasts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    .then(r => r.json()).then(data => setGymnasts(Array.isArray(data) ? data : data.gymnasts || []));
};
```

- [ ] **Step 3: Add templateIds to submit**

Update `handleSubmit` to include `templateIds`:

```js
const res = await bookingApi.createMembership({
  gymnastId: form.gymnastId,
  monthlyAmount: Math.round(parseFloat(form.monthlyAmount) * 100),
  startDate: form.startDate,
  templateIds: form.templateIds,
});
setForm({ gymnastId: '', monthlyAmount: '', startDate: '', templateIds: [] });
```

- [ ] **Step 4: Add template multi-select to form JSX**

After the start date field (after `</label>` for the start date input, before the error/submit area), add:

```jsx
<label className="bk-label">Standing slots
  <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
    {templates.filter(t => !t.isArchived).map(t => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const label = `${days[t.dayOfWeek]} ${t.startTime}–${t.endTime}`;
      const checked = form.templateIds.includes(t.id);
      return (
        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="auth-checkbox"
            checked={checked}
            onChange={() => setForm(f => ({
              ...f,
              templateIds: checked ? f.templateIds.filter(id => id !== t.id) : [...f.templateIds, t.id],
            }))}
          />
          {label}{t.type === 'DMT' ? ' · DMT' : ''}
        </label>
      );
    })}
    {templates.length === 0 && <span className="bk-muted" style={{ fontSize: '0.85rem' }}>No session templates found</span>}
  </div>
</label>
```

- [ ] **Step 5: Add frontend validation**

The backend accepts `templateIds: []` (flexibility for future programmatic use). The frontend enforces the UX requirement of at least one template. Add a check in `handleSubmit` before the API call:

```js
if (form.templateIds.length === 0) {
  setError('Please select at least one standing slot session.');
  setSubmitting(false);
  return;
}
```

This is intentional: UI is stricter than the API. Do not add server-side validation for this.

- [ ] **Step 6: Manual test**

Start the backend and frontend locally. Navigate to Admin → Memberships. Verify:
- Session template checkboxes appear in the form
- Submitting without selecting a template shows the validation error
- Submitting with templates selected creates both the membership and commits (verify in DB with `psql trampoline_tracker -c "SELECT * FROM commitments;"`)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMemberships.js
git commit -m "feat: add standing slots selection to membership creation form"
```

---

### Task 9: AdminMembers.js — Commitments Section

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

This task adds a "Commitments" section to the gymnast detail panel, following the same pattern as the DMT approval section already in the component.

- [ ] **Step 1: Add state for commitments in the gymnast row component**

Open `frontend/src/pages/booking/admin/AdminMembers.js`. Find the `GymnastRow` component (or the section where gymnast details are rendered). The DMT state is declared around line 343:

```js
const [dmtLoading, setDmtLoading] = useState(false);
const [dmtError, setDmtError] = useState(null);
```

Add below it:

```js
const [commitments, setCommitments] = useState(null); // null = not loaded yet
const [commitmentLoading, setCommitmentLoading] = useState(false);
const [commitmentError, setCommitmentError] = useState(null);
const [addingTemplateId, setAddingTemplateId] = useState('');
```

- [ ] **Step 2: Add loadCommitments function**

Alongside where gymnast detail data is loaded, add:

```js
const loadCommitments = async () => {
  setCommitmentLoading(true);
  try {
    const res = await bookingApi.getCommitmentsForGymnast(g.id);
    setCommitments(res.data);
  } catch {
    setCommitmentError('Failed to load commitments.');
  } finally {
    setCommitmentLoading(false);
  }
};
```

Call `loadCommitments()` when the gymnast panel is opened (in the same effect or handler that opens the detail panel).

- [ ] **Step 3: Add handleAddCommitment, handleToggleCommitmentStatus, handleDeleteCommitment**

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

const handleToggleCommitmentStatus = async (commitment) => {
  const newStatus = commitment.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  setCommitmentError(null);
  try {
    await bookingApi.updateCommitmentStatus(commitment.id, newStatus);
    await loadCommitments();
  } catch (err) {
    setCommitmentError(err.response?.data?.error || 'Failed to update commitment.');
  }
};

const handleDeleteCommitment = async (commitmentId) => {
  if (!window.confirm('Remove this standing slot?')) return;
  setCommitmentError(null);
  try {
    await bookingApi.deleteCommitment(commitmentId);
    await loadCommitments();
  } catch (err) {
    setCommitmentError(err.response?.data?.error || 'Failed to remove commitment.');
  }
};
```

- [ ] **Step 4: Add Commitments JSX section**

Find the DMT approval section JSX (around line 506). After that section's closing element, add:

```jsx
{/* Commitments section */}
<div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--booking-bg-light)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Standing slots</span>
    <button className="bk-btn bk-btn--sm" onClick={loadCommitments} disabled={commitmentLoading}>
      {commitments === null ? 'Load' : 'Refresh'}
    </button>
  </div>

  {commitmentLoading && <p className="bk-muted" style={{ fontSize: '0.85rem' }}>Loading...</p>}
  {commitmentError && <p className="bk-error" style={{ fontSize: '0.82rem' }}>{commitmentError}</p>}

  {commitments !== null && (
    <>
      {commitments.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>No commitments.</p>}
      {commitments.map(c => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const label = `${days[c.template.dayOfWeek]} ${c.template.startTime}–${c.template.endTime}`;
        return (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.875rem' }}>
            <span>
              {label}
              <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: c.status === 'ACTIVE' ? 'var(--booking-success)' : 'var(--booking-text-muted)', fontWeight: 600 }}>
                {c.status === 'ACTIVE' ? 'Active' : 'Paused'}
              </span>
            </span>
            <div className="bk-row" style={{ gap: '0.3rem' }}>
              <button className="bk-btn bk-btn--sm" onClick={() => handleToggleCommitmentStatus(c)}>
                {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </button>
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

      {/* Add commitment control — `templates` is passed as a prop from AdminMembers (see step below) */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select
          value={addingTemplateId}
          onChange={e => setAddingTemplateId(e.target.value)}
          className="bk-input"
          style={{ fontSize: '0.85rem', flex: 1 }}
        >
          <option value="">Add standing slot...</option>
          {(templates || []).filter(t => !t.isArchived && !commitments.some(c => c.templateId === t.id)).map(t => {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return <option key={t.id} value={t.id}>{days[t.dayOfWeek]} {t.startTime}–{t.endTime}{t.type === 'DMT' ? ' · DMT' : ''}</option>;
          })}
        </select>
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
</div>
```

The `templates` variable used in the JSX above must come from the parent `AdminMembers` component. `getTemplates` is a named export — not on `bookingApi`. Load it at the `AdminMembers` component level:

**In `AdminMembers.js` top-level import**, add `getTemplates` to the import:
```js
import { bookingApi, getTemplates } from '../../../utils/bookingApi';
```

**In `AdminMembers`** (the parent component), add state and load:
```js
const [templates, setTemplates] = useState([]);

useEffect(() => {
  getTemplates().then(r => setTemplates(r.data)).catch(() => {});
}, []);
```

**Pass `templates` as a prop** into the gymnast detail component (whatever function/component renders the gymnast panel). If the gymnast detail is rendered inline in `AdminMembers`, `templates` is already in scope. If it's a child component (`GymnastRow` or similar), add `templates` as a prop:
```jsx
<GymnastRow key={g.id} g={g} templates={templates} ... />
```

And receive it in the function signature:
```js
function GymnastRow({ g, templates, ... }) { ... }
```

- [ ] **Step 5: Manual test**

Navigate to Admin → Members. Open a gymnast. Click "Load" on the Standing slots section. Verify you can add, pause, resume, and remove commitments.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: add commitments section to gymnast admin panel"
```

---

### Task 10: SessionDetail.js — Standing Slot Indicator

**Files:**
- Modify: `frontend/src/pages/booking/SessionDetail.js`

**Depends on:** Chunk 1 Task 4 — which adds `templateId` to the `GET /api/booking/sessions/:instanceId` response. Confirm Task 4 is complete before this task.

- [ ] **Step 1: Add commitment state**

Open `frontend/src/pages/booking/SessionDetail.js`. After the existing state declarations (around line 26), add:

```js
const [myCommitments, setMyCommitments] = useState([]); // [{ gymnastId, status }]
```

- [ ] **Step 2: Load my commitments when session loads**

In the `useEffect` that loads the session (around line 33), after `setSession(sessRes.data)`, add a call to load commitments once the session templateId is known:

```js
.then(([sessRes, credRes, waitRes]) => {
  setSession(sessRes.data);
  // Load my commitments for this session's template
  if (sessRes.data.templateId) {
    bookingApi.getMyCommitmentsForTemplate(sessRes.data.templateId)
      .then(r => setMyCommitments(r.data))
      .catch(() => {});
  }
  // ... rest of existing logic
```

- [ ] **Step 3: Add standing slot check in the gymnast list**

In the gymnast selection list (around line 225 where `bookableGymnasts.map(g => {` is), add a commitment check alongside the existing `dmtBlocked` check:

```js
const isDmtSession = session?.type === 'DMT';
const dmtBlocked = isDmtSession && !g.dmtApproved;
const myCommitment = myCommitments.find(c => c.gymnastId === g.id);
const hasActiveCommitment = myCommitment?.status === 'ACTIVE';
const blocked = bgBlocked || dmtBlocked || hasActiveCommitment;
```

- [ ] **Step 4: Show standing slot message**

In the same gymnast row JSX, after the existing `{dmtBlocked && ...}` message, add:

```jsx
{hasActiveCommitment && (
  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--booking-success)', fontWeight: 500 }}>
    Standing slot — you're already booked for this session.
  </p>
)}
```

- [ ] **Step 5: Manual test**

Log in as a parent whose gymnast has an active commitment to a session template. Navigate to that session in the booking calendar. Verify:
- The gymnast shows "Standing slot — you're already booked for this session."
- The checkbox/booking control is disabled for that gymnast
- A paused commitment shows normal booking controls

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: show standing slot indicator in session detail for committed gymnasts"
```

---

### Task 11: BookingAdmin.js — Standing Slots in Session Panel

**Files:**
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

**Depends on:** Chunk 1 Task 4 — which adds `templateId` and `activeCommitments` to the `GET /api/booking/sessions/:instanceId` response. Confirm Task 4 is complete before this task.

- [ ] **Step 1: Add commitments state to SessionDetailPanel**

Open `frontend/src/pages/booking/admin/BookingAdmin.js`. Find `SessionDetailPanel` (around line 169). Add state:

```js
const [standingSlots, setStandingSlots] = useState(null);
const [slotsLoading, setSlotsLoading] = useState(false);
```

- [ ] **Step 2: Load commitments when panel opens**

`SessionDetailPanel` receives `sessionDetail` as a prop. Add a `useEffect` to load commitments when `sessionDetail.templateId` changes. The dependency array `[sessionDetail?.templateId]` ensures it re-runs whenever a different session is selected:

```js
useEffect(() => {
  if (!sessionDetail?.templateId) return;
  setSlotsLoading(true);
  setStandingSlots(null);
  bookingApi.getCommitmentsForTemplate(sessionDetail.templateId)
    .then(r => setStandingSlots(r.data))
    .catch(() => setStandingSlots([]))
    .finally(() => setSlotsLoading(false));
}, [sessionDetail?.templateId]); // re-runs when admin opens a different session
```

- [ ] **Step 3: Update the capacity header**

Find the capacity header in `SessionDetailPanel` (around line 207 where `{totalGymnasts} booked` and `{capacity - totalGymnasts} remaining` are rendered):

The `sessionDetail` now returns `activeCommitments`. Update the display to show the breakdown:

```jsx
<span>{totalGymnasts} booked</span>
<span>
  {(sessionDetail.activeCommitments ?? 0) > 0
    ? `${capacity - totalGymnasts - sessionDetail.activeCommitments} remaining (${sessionDetail.activeCommitments} standing)`
    : `${capacity - totalGymnasts} remaining`}
</span>
```

Also update the progress bar calculation to include `activeCommitments`:

```js
const totalFilled = totalGymnasts + (sessionDetail.activeCommitments ?? 0);
// Use totalFilled in place of totalGymnasts in the bar width and color calculations
```

- [ ] **Step 4: Add Standing Slots section to the panel**

In the `bk-card` div that contains the "Attendees" section (around line 226), add a "Standing slots" section before it:

```jsx
{/* Standing slots */}
{(slotsLoading || (standingSlots && standingSlots.length > 0)) && (
  <div className="bk-card" style={{ marginBottom: '1rem' }}>
    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>
      Standing slots ({standingSlots?.length ?? '…'})
    </h4>
    {slotsLoading && <p className="bk-muted" style={{ margin: 0 }}>Loading...</p>}
    {standingSlots?.map(c => (
      <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--booking-bg-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem' }}>
          {c.gymnast.firstName} {c.gymnast.lastName}
          {c.status === 'PAUSED' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--booking-text-muted)' }}>(Paused)</span>}
        </span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Manual test**

Log in as admin. Open a session that has gymnasts with commitments to that template. Verify:
- "Standing slots" section appears above "Attendees"
- The capacity header shows the commitment count breakdown (e.g. "5 remaining (3 standing)")
- Paused commitments are labelled "(Paused)"

- [ ] **Step 6: Run all backend tests one final time**

```bash
cd backend
DATABASE_URL="postgresql://james@localhost:5432/trampoline_tracker" npx jest --no-coverage --runInBand 2>&1 | grep -E "Tests:|Test Suites:" | tail -5
```

Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: show standing slots in admin session panel with capacity breakdown"
```
