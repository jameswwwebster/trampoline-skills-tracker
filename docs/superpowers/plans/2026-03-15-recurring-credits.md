# Recurring Credits Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to configure a fixed monthly credit for any member that is issued immediately on setup and then automatically on the 1st of each month until cancelled or an optional end date is reached.

**Architecture:** New `RecurringCredit` model holds the rule; existing `Credit` model is reused for each issuance. A new backend route file handles CRUD, exporting a `processRecurringCredits` helper for the monthly cron. The frontend adds a form + table to the existing AdminCredits page.

**Tech Stack:** Express, Prisma 5, PostgreSQL, node-cron, React 18, axios

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/prisma/schema.prisma` | Add `RecurringCredit` model + back-relations on `User` and `Club` |
| Create | `backend/prisma/migrations/20260315150000_add_recurring_credits/migration.sql` | DDL for new table |
| Create | `backend/routes/booking/recurringCredits.js` | GET / POST / DELETE handlers + exported `processRecurringCredits` |
| Modify | `backend/server.js` | Mount route; add monthly cron |
| Create | `backend/__tests__/booking.recurringCredits.test.js` | All backend tests |
| Modify | `frontend/src/utils/bookingApi.js` | Add `getRecurringCredits`, `createRecurringCredit`, `deleteRecurringCredit` |
| Modify | `frontend/src/pages/booking/admin/AdminCredits.js` | Add recurring credits form + active-rules table |

---

## Chunk 1: Backend

### Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260315150000_add_recurring_credits/migration.sql`

- [ ] **Step 1: Add `RecurringCredit` model to `backend/prisma/schema.prisma`**

  Append the new model **before** the first `enum` block (after `model Attendance`). Also add back-relations to the existing `User` and `Club` models.

  In `model User` (around line 65, after the `attendances` line), add:
  ```prisma
    recurringCredits         RecurringCredit[]
    createdRecurringCredits  RecurringCredit[]  @relation("RecurringCreditCreatedBy")
  ```

  In `model Club` (around line 148, after the `charges` line), add:
  ```prisma
    recurringCredits  RecurringCredit[]
  ```

  Append this new model after the `model Attendance` block (near the end of the file, before the enums):
  ```prisma
  model RecurringCredit {
    id            String    @id @default(cuid())
    club          Club      @relation(fields: [clubId], references: [id])
    clubId        String
    user          User      @relation(fields: [userId], references: [id])
    userId        String
    amountPence   Int
    endDate       DateTime?
    isActive      Boolean   @default(true)
    lastIssuedAt  DateTime?
    createdBy     User      @relation("RecurringCreditCreatedBy", fields: [createdById], references: [id])
    createdById   String
    createdAt     DateTime  @default(now())
    updatedAt     DateTime  @updatedAt

    @@map("recurring_credits")
  }
  ```

- [ ] **Step 2: Create the migration SQL file**

  Create file `backend/prisma/migrations/20260315150000_add_recurring_credits/migration.sql` with:
  ```sql
  CREATE TABLE "recurring_credits" (
    "id"           TEXT NOT NULL,
    "clubId"       TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "amountPence"  INTEGER NOT NULL,
    "endDate"      TIMESTAMP(3),
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "lastIssuedAt" TIMESTAMP(3),
    "createdById"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_credits_pkey" PRIMARY KEY ("id")
  );

  ALTER TABLE "recurring_credits"
    ADD CONSTRAINT "recurring_credits_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "clubs"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;

  ALTER TABLE "recurring_credits"
    ADD CONSTRAINT "recurring_credits_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;

  ALTER TABLE "recurring_credits"
    ADD CONSTRAINT "recurring_credits_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  ```

- [ ] **Step 3: Apply the migration**

  ```bash
  cd backend && npx prisma migrate dev --name add_recurring_credits
  ```

  Expected: migration applied, Prisma client regenerated. If Prisma asks to create the migration, answer yes. If the migration file already exists, it will be used as-is.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/
  git commit -m "feat: add RecurringCredit Prisma model and migration"
  ```

---

### Task 2: Backend route

**Files:**
- Create: `backend/routes/booking/recurringCredits.js`

- [ ] **Step 1: Create the route file**

  Create `backend/routes/booking/recurringCredits.js`:

  ```js
  // backend/routes/booking/recurringCredits.js
  const express = require('express');
  const { PrismaClient } = require('@prisma/client');
  const { auth, requireRole } = require('../../middleware/auth');
  const Joi = require('joi');
  const { audit } = require('../../services/auditLogService');
  const emailService = require('../../services/emailService');

  const router = express.Router();
  const prisma = new PrismaClient();

  /** Last millisecond of the current calendar month in UTC. */
  function endOfMonthUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  function formatRule(rule, user) {
    return {
      id: rule.id,
      userId: rule.userId,
      userName: `${user.firstName} ${user.lastName}`,
      amountPence: rule.amountPence,
      endDate: rule.endDate ?? null,
      lastIssuedAt: rule.lastIssuedAt ?? null,
      createdAt: rule.createdAt,
    };
  }

  // GET /api/booking/recurring-credits
  router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
    try {
      const rules = await prisma.recurringCredit.findMany({
        where: { clubId: req.user.clubId, isActive: true },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(rules.map(r => formatRule(r, r.user)));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/booking/recurring-credits
  const createSchema = Joi.object({
    userId: Joi.string().required(),
    amountPence: Joi.number().integer().min(1).required(),
    endDate: Joi.string().isoDate().optional(),
  });

  router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      // Validate endDate is not in the past
      if (value.endDate) {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        if (new Date(value.endDate) < startOfToday) {
          return res.status(400).json({ error: 'endDate must be today or in the future' });
        }
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: value.userId, clubId: req.user.clubId, isArchived: false },
        include: { club: { select: { emailEnabled: true } } },
      });
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      const expiresAt = endOfMonthUtc();

      const rule = await prisma.recurringCredit.create({
        data: {
          clubId: req.user.clubId,
          userId: value.userId,
          amountPence: value.amountPence,
          endDate: value.endDate ? new Date(value.endDate) : null,
          createdById: req.user.id,
        },
      });

      await prisma.credit.create({
        data: { userId: value.userId, amount: value.amountPence, expiresAt },
      });

      const updatedRule = await prisma.recurringCredit.update({
        where: { id: rule.id },
        data: { lastIssuedAt: new Date() },
      });

      await audit({
        userId: req.user.id,
        clubId: req.user.clubId,
        action: 'recurringCredit.create',
        entityType: 'RecurringCredit',
        entityId: rule.id,
        metadata: { targetUserId: value.userId, amountPence: value.amountPence },
      });

      if (targetUser.club.emailEnabled) {
        await emailService.sendCreditAssignedEmail(
          targetUser.email,
          targetUser.firstName,
          value.amountPence,
          expiresAt,
        );
      }

      res.status(201).json(formatRule(updatedRule, targetUser));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/booking/recurring-credits/:id
  router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
    try {
      const rule = await prisma.recurringCredit.findFirst({
        where: { id: req.params.id, clubId: req.user.clubId },
      });
      if (!rule) return res.status(404).json({ error: 'Rule not found' });

      await prisma.recurringCredit.update({
        where: { id: rule.id },
        data: { isActive: false },
      });

      await audit({
        userId: req.user.id,
        clubId: req.user.clubId,
        action: 'recurringCredit.cancel',
        entityType: 'RecurringCredit',
        entityId: rule.id,
        metadata: { targetUserId: rule.userId },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  /**
   * Issued recurring credits for all eligible active rules.
   * Exported for testing and called by the monthly cron.
   * @param {PrismaClient} [db] - optional Prisma client override (for tests)
   * @returns {Promise<number>} number of credits issued
   */
  async function processRecurringCredits(db) {
    const client = db || prisma;
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const rules = await client.recurringCredit.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            isArchived: true,
            club: { select: { emailEnabled: true } },
          },
        },
      },
    });

    let issued = 0;
    for (const rule of rules) {
      try {
        if (rule.user.isArchived) continue;
        if (rule.endDate && rule.endDate < startOfToday) continue;
        if (rule.lastIssuedAt && rule.lastIssuedAt >= startOfMonth) continue;

        const expiresAt = endOfMonthUtc();

        await client.credit.create({
          data: { userId: rule.userId, amount: rule.amountPence, expiresAt },
        });
        await client.recurringCredit.update({
          where: { id: rule.id },
          data: { lastIssuedAt: now },
        });

        if (rule.user.club.emailEnabled) {
          await emailService.sendCreditAssignedEmail(
            rule.user.email,
            rule.user.firstName,
            rule.amountPence,
            expiresAt,
          );
        }

        issued++;
      } catch (err) {
        console.error(`Recurring credit error for rule ${rule.id}:`, err);
      }
    }

    console.log(`Issued ${issued} recurring credit(s)`);
    return issued;
  }

  module.exports = router;
  module.exports.processRecurringCredits = processRecurringCredits;
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/routes/booking/recurringCredits.js
  git commit -m "feat: add recurring credits route and processRecurringCredits helper"
  ```

---

### Task 3: Backend tests

**Files:**
- Create: `backend/__tests__/booking.recurringCredits.test.js`

Look at `backend/__tests__/booking.charges.test.js` for the test file structure pattern (supertest, createTestApp, seed helpers, beforeAll/afterAll, afterEach cleanup).

Look at `backend/__tests__/helpers/seed.js` for available helpers: `createTestClub`, `createParent`, `tokenFor`.

- [ ] **Step 1: Create the test file**

  Create `backend/__tests__/booking.recurringCredits.test.js`:

  ```js
  // backend/__tests__/booking.recurringCredits.test.js
  const request = require('supertest');
  const { createTestApp } = require('./helpers/create-test-app');
  const { prisma, cleanDatabase } = require('./helpers/db');
  const { createTestClub, createParent, tokenFor } = require('./helpers/seed');
  const { processRecurringCredits } = require('../routes/booking/recurringCredits');

  const app = createTestApp();

  let club, otherClub, admin, adminToken, parent, parentToken, otherAdmin, otherAdminToken;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    otherClub = await createTestClub();
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `rc-admin-${Date.now()}@test.tl` });
    parent = await createParent(club, { email: `rc-parent-${Date.now()}@test.tl` });
    otherAdmin = await createParent(otherClub, { role: 'CLUB_ADMIN', email: `rc-other-${Date.now()}@test.tl` });
    adminToken = tokenFor(admin);
    parentToken = tokenFor(parent);
    otherAdminToken = tokenFor(otherAdmin);
  });

  afterEach(async () => {
    await prisma.credit.deleteMany({});
    await prisma.recurringCredit.deleteMany({});
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ── POST ──────────────────────────────────────────────────────────────────────

  describe('POST /api/booking/recurring-credits', () => {
    it('creates rule and issues a Credit expiring end of current month', async () => {
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amountPence: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(parent.id);
      expect(res.body.amountPence).toBe(1000);
      expect(res.body.lastIssuedAt).not.toBeNull();

      // Credit record should exist
      const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
      expect(credits).toHaveLength(1);
      expect(credits[0].amount).toBe(1000);

      // expiresAt should be last second of current month
      const exp = new Date(credits[0].expiresAt);
      const now = new Date();
      expect(exp.getUTCMonth()).toBe(now.getUTCMonth());
      expect(exp.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(exp.getUTCHours()).toBe(23);
      expect(exp.getUTCMinutes()).toBe(59);
    });

    it('returns 400 for past endDate', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amountPence: 1000, endDate: pastDate.toISOString().split('T')[0] });
      expect(res.status).toBe(400);
    });

    it('returns 404 for archived user', async () => {
      const archived = await createParent(club, {
        email: `rc-archived-${Date.now()}@test.tl`,
        isArchived: true,
      });
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: archived.id, amountPence: 1000 });
      expect(res.status).toBe(404);
    });

    it('returns 404 for user in different club', async () => {
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: otherAdmin.id, amountPence: 1000 });
      expect(res.status).toBe(404);
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .send({ userId: parent.id, amountPence: 1000 });
      expect(res.status).toBe(401);
    });

    it('returns 403 for parent role', async () => {
      const res = await request(app)
        .post('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ userId: parent.id, amountPence: 1000 });
      expect(res.status).toBe(403);
    });
  });

  // ── GET ───────────────────────────────────────────────────────────────────────

  describe('GET /api/booking/recurring-credits', () => {
    it('returns active rules for the club with userName', async () => {
      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 500,
          createdById: admin.id,
          isActive: true,
        },
      });

      const res = await request(app)
        .get('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].userName).toBe(`${parent.firstName} ${parent.lastName}`);
      expect(res.body[0].amountPence).toBe(500);
    });

    it('excludes cancelled (isActive: false) rules', async () => {
      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 500,
          createdById: admin.id,
          isActive: false,
        },
      });

      const res = await request(app)
        .get('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('admin from different club sees empty array (club scoping)', async () => {
      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 500,
          createdById: admin.id,
          isActive: true,
        },
      });

      const res = await request(app)
        .get('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${otherAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/booking/recurring-credits');
      expect(res.status).toBe(401);
    });

    it('returns 403 for parent role', async () => {
      const res = await request(app)
        .get('/api/booking/recurring-credits')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE ────────────────────────────────────────────────────────────────────

  describe('DELETE /api/booking/recurring-credits/:id', () => {
    it('sets isActive = false; associated Credit is unchanged', async () => {
      // Seed a rule with an issued credit
      const rule = await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 800,
          createdById: admin.id,
          isActive: true,
        },
      });
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const credit = await prisma.credit.create({
        data: { userId: parent.id, amount: 800, expiresAt },
      });

      const res = await request(app)
        .delete(`/api/booking/recurring-credits/${rule.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = await prisma.recurringCredit.findUnique({ where: { id: rule.id } });
      expect(updated.isActive).toBe(false);

      // Credit record untouched
      const stillThere = await prisma.credit.findUnique({ where: { id: credit.id } });
      expect(stillThere).not.toBeNull();
      expect(stillThere.amount).toBe(800);
    });

    it('returns 404 for rule in different club', async () => {
      const rule = await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 800,
          createdById: admin.id,
          isActive: true,
        },
      });

      const res = await request(app)
        .delete(`/api/booking/recurring-credits/${rule.id}`)
        .set('Authorization', `Bearer ${otherAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).delete('/api/booking/recurring-credits/fakeid');
      expect(res.status).toBe(401);
    });

    it('returns 403 for parent role', async () => {
      const rule = await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 800,
          createdById: admin.id,
          isActive: true,
        },
      });
      const res = await request(app)
        .delete(`/api/booking/recurring-credits/${rule.id}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Cron helper ───────────────────────────────────────────────────────────────

  describe('processRecurringCredits', () => {
    it('issues credit for active rule where lastIssuedAt is in previous month', async () => {
      const lastMonth = new Date();
      lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 1200,
          createdById: admin.id,
          isActive: true,
          lastIssuedAt: lastMonth,
        },
      });

      const issued = await processRecurringCredits(prisma);
      expect(issued).toBe(1);

      const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
      expect(credits).toHaveLength(1);
      expect(credits[0].amount).toBe(1200);
    });

    it('skips rule where endDate is in the past', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 1200,
          createdById: admin.id,
          isActive: true,
          endDate: yesterday,
        },
      });

      const issued = await processRecurringCredits(prisma);
      expect(issued).toBe(0);

      const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
      expect(credits).toHaveLength(0);
    });

    it('skips rule where lastIssuedAt is already in the current month (idempotent)', async () => {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: parent.id,
          amountPence: 1200,
          createdById: admin.id,
          isActive: true,
          lastIssuedAt: startOfMonth,
        },
      });

      const issued = await processRecurringCredits(prisma);
      expect(issued).toBe(0);
    });

    it('skips rule where user is archived', async () => {
      const archivedUser = await createParent(club, {
        email: `rc-arch2-${Date.now()}@test.tl`,
        isArchived: true,
      });

      await prisma.recurringCredit.create({
        data: {
          clubId: club.id,
          userId: archivedUser.id,
          amountPence: 1200,
          createdById: admin.id,
          isActive: true,
        },
      });

      const issued = await processRecurringCredits(prisma);
      expect(issued).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they pass**

  ```bash
  cd backend && npx jest booking.recurringCredits --testTimeout=30000 --forceExit 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/__tests__/booking.recurringCredits.test.js
  git commit -m "test: add recurring credits backend tests"
  ```

---

### Task 4: Mount route and add cron

**Files:**
- Modify: `backend/server.js`

The existing credits route is mounted at line ~179. The monthly cron should follow the pattern of the other cron jobs already in server.js.

- [ ] **Step 1: Mount the route in `backend/server.js`**

  Find this line:
  ```js
  app.use('/api/booking/credits', require('./routes/booking/credits'));
  ```

  Add after it:
  ```js
  app.use('/api/booking/recurring-credits', require('./routes/booking/recurringCredits'));
  ```

- [ ] **Step 2: Add the monthly cron in `backend/server.js`**

  Find the last cron job in the file (the BG number digest at `30 7 * * *` or new member digest at `0 8 * * *`). After it, add:

  ```js
  // Recurring credits — runs at 09:00 UTC on the 1st of every month
  cron.schedule('0 9 1 * *', async () => {
    try {
      const { processRecurringCredits } = require('./routes/booking/recurringCredits');
      await processRecurringCredits();
    } catch (err) {
      console.error('Recurring credits cron error:', err);
    }
  });
  ```

- [ ] **Step 3: Verify the server still starts (smoke test)**

  ```bash
  cd backend && node -e "require('./server'); setTimeout(() => process.exit(0), 2000)" 2>&1 | grep -E "error|Error|listening|started" | head -5
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/server.js
  git commit -m "feat: mount recurring-credits route and add monthly cron"
  ```

---

## Chunk 2: Frontend

### Task 5: bookingApi additions

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

The file exports a `bookingApi` object. All entries follow the pattern `methodName: (...) => axios.verb(url, [data,] { headers: getHeaders() })`. Add the three new methods inside the object, after the existing `deleteAttendance` entry (last method before the closing `}`).

- [ ] **Step 1: Add the three methods to `bookingApi` in `frontend/src/utils/bookingApi.js`**

  Find this block near the end of the `bookingApi` object:
  ```js
    deleteAttendance: (instanceId, gymnastId) =>
      axios.delete(`${API_URL}/booking/attendance/${instanceId}/${gymnastId}`, { headers: getHeaders() }),
  };
  ```

  Replace with:
  ```js
    deleteAttendance: (instanceId, gymnastId) =>
      axios.delete(`${API_URL}/booking/attendance/${instanceId}/${gymnastId}`, { headers: getHeaders() }),

    // Recurring credits
    getRecurringCredits: () =>
      axios.get(`${API_URL}/booking/recurring-credits`, { headers: getHeaders() }),

    createRecurringCredit: (data) =>
      axios.post(`${API_URL}/booking/recurring-credits`, data, { headers: getHeaders() }),

    deleteRecurringCredit: (id) =>
      axios.delete(`${API_URL}/booking/recurring-credits/${id}`, { headers: getHeaders() }),
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/utils/bookingApi.js
  git commit -m "feat: add recurring credits API methods to bookingApi"
  ```

---

### Task 6: AdminCredits.js — recurring credits section

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminCredits.js`

The current page has a one-time credit assignment form. Add a **Recurring credits** section below it. The section has two parts: (1) an always-visible add form, (2) a table shown only when rules exist.

The existing page already loads `users` from `getAllCredits()`. The members `<select>` should use a separate members list from `getMembers()` (which returns `[{ id, firstName, lastName, ... }]`).

- [ ] **Step 1: Rewrite `AdminCredits.js` to add the recurring credits section**

  The full updated file:

  ```jsx
  import React, { useState, useEffect } from 'react';
  import { bookingApi } from '../../../utils/bookingApi';
  import '../booking-shared.css';

  function formatDate(iso) {
    if (!iso) return 'Indefinite';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  export default function AdminCredits() {
    // ── One-time credits ──────────────────────────────────────────────────────
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState({ amount: '', expiresInDays: 90 });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    // ── Recurring credits ─────────────────────────────────────────────────────
    const [members, setMembers] = useState([]);
    const [rules, setRules] = useState([]);
    const [rcForm, setRcForm] = useState({ userId: '', amount: '', endDate: '' });
    const [rcSubmitting, setRcSubmitting] = useState(false);
    const [rcError, setRcError] = useState(null);

    const loadCredits = () =>
      bookingApi.getAllCredits()
        .then(r => setUsers(r.data))
        .finally(() => setLoading(false));

    const loadRecurring = () =>
      bookingApi.getRecurringCredits()
        .then(r => setRules(r.data))
        .catch(() => {});

    useEffect(() => {
      loadCredits();
      loadRecurring();
      bookingApi.getMembers()
        .then(r => setMembers(r.data))
        .catch(() => {});
    }, []);

    const handleAssign = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        await bookingApi.assignCredit({
          userId: selected.id,
          amount: Math.round(parseFloat(form.amount) * 100),
          expiresInDays: parseInt(form.expiresInDays),
        });
        setSelected(null);
        setForm({ amount: '', expiresInDays: 90 });
        loadCredits();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to assign credit.');
      } finally {
        setSubmitting(false);
      }
    };

    const handleAddRecurring = async (e) => {
      e.preventDefault();
      setRcSubmitting(true);
      setRcError(null);
      try {
        const payload = {
          userId: rcForm.userId,
          amountPence: Math.round(parseFloat(rcForm.amount) * 100),
        };
        if (rcForm.endDate) payload.endDate = rcForm.endDate;
        await bookingApi.createRecurringCredit(payload);
        setRcForm({ userId: '', amount: '', endDate: '' });
        loadRecurring();
      } catch (err) {
        setRcError(err.response?.data?.error || 'Failed to create recurring credit.');
      } finally {
        setRcSubmitting(false);
      }
    };

    const handleCancelRule = async (id) => {
      if (!window.confirm('Cancel this recurring credit? Future credits will no longer be issued.')) return;
      try {
        await bookingApi.deleteRecurringCredit(id);
        loadRecurring();
      } catch {
        alert('Failed to cancel rule.');
      }
    };

    const filtered = users.filter(u =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <p className="bk-center">Loading...</p>;

    return (
      <div className="bk-page bk-page--lg">
        <h2>Credits</h2>

        {selected && (
          <div className="bk-form-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>
              Assign credit to {selected.firstName} {selected.lastName}
            </h3>
            <form onSubmit={handleAssign}>
              <div className="bk-grid-2">
                <label className="bk-label">Amount (£)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="bk-input"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                    style={{ marginTop: '0.25rem' }}
                  />
                </label>
                <label className="bk-label">Expires after (days)
                  <input
                    type="number"
                    min="1"
                    className="bk-input"
                    value={form.expiresInDays}
                    onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
                    required
                    style={{ marginTop: '0.25rem' }}
                  />
                </label>
              </div>
              {error && <p className="bk-error">{error}</p>}
              <div className="bk-row">
                <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
                  {submitting ? 'Assigning...' : 'Assign credit'}
                </button>
                <button type="button" className="bk-btn" style={{ border: '1px solid var(--booking-border)' }} onClick={() => setSelected(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <input
          className="bk-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '1rem' }}
        />

        <table className="bk-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ textAlign: 'right' }}>Credits</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td className="bk-muted" style={{ fontSize: '0.85rem' }}>{u.email}</td>
                <td style={{ textAlign: 'right' }}>
                  {u.totalCredits > 0 ? (
                    <strong style={{ color: 'var(--booking-accent)' }}>
                      £{(u.totalCredits / 100).toFixed(2)}
                    </strong>
                  ) : (
                    <span className="bk-muted">—</span>
                  )}
                </td>
                <td>
                  <button
                    className="bk-btn bk-btn--sm bk-btn--primary"
                    onClick={() => setSelected(u)}
                  >
                    Assign credit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="bk-center">No users found.</td></tr>
            )}
          </tbody>
        </table>

        {/* ── Recurring credits ────────────────────────────────────────────── */}
        <h2 style={{ marginTop: '2.5rem' }}>Recurring credits</h2>

        <div className="bk-form-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Add recurring credit</h3>
          <form onSubmit={handleAddRecurring}>
            <div className="bk-grid-2">
              <label className="bk-label">Member
                <select
                  className="bk-input"
                  value={rcForm.userId}
                  onChange={e => setRcForm(f => ({ ...f, userId: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                >
                  <option value="">Select member…</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </label>
              <label className="bk-label">Monthly amount (£)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="bk-input"
                  value={rcForm.amount}
                  onChange={e => setRcForm(f => ({ ...f, amount: e.target.value }))}
                  required
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
              <label className="bk-label">End date (optional)
                <input
                  type="date"
                  className="bk-input"
                  value={rcForm.endDate}
                  onChange={e => setRcForm(f => ({ ...f, endDate: e.target.value }))}
                  style={{ marginTop: '0.25rem' }}
                />
              </label>
            </div>
            {rcError && <p className="bk-error">{rcError}</p>}
            <button type="submit" disabled={rcSubmitting} className="bk-btn bk-btn--primary" style={{ marginTop: '0.5rem' }}>
              {rcSubmitting ? 'Saving…' : 'Add recurring credit'}
            </button>
          </form>
        </div>

        {rules.length > 0 && (
          <table className="bk-table">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ textAlign: 'right' }}>Monthly amount</th>
                <th>End date</th>
                <th>Last issued</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td>{r.userName}</td>
                  <td style={{ textAlign: 'right' }}>£{(r.amountPence / 100).toFixed(2)}</td>
                  <td>{formatDate(r.endDate)}</td>
                  <td>{r.lastIssuedAt ? formatDate(r.lastIssuedAt) : '—'}</td>
                  <td>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ border: '1px solid var(--booking-border)' }}
                      onClick={() => handleCancelRule(r.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/pages/booking/admin/AdminCredits.js
  git commit -m "feat: add recurring credits section to AdminCredits page"
  ```

---

### Task 7: Final test run + push

- [ ] **Step 1: Run the full backend test suite**

  ```bash
  cd backend && npx jest --testTimeout=30000 --forceExit 2>&1 | tail -15
  ```

  Expected: all tests pass (205+ tests). If failures exist, fix before pushing.

- [ ] **Step 2: Push to remote**

  ```bash
  git push
  ```
