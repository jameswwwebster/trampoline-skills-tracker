# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web Push notifications so coaches receive a "session starting in 5 minutes" notification on devices where the app is installed as a PWA.

**Architecture:** Native Web Push (VAPID) using the `web-push` npm package on the backend. Subscriptions and per-type preferences stored in Postgres. A cron job running every minute finds sessions starting in 5 minutes and pushes to all subscribed coaches. A service worker on the frontend receives background push events. All authenticated users can subscribe; the backend filters recipients by role and preference at send time.

**Tech Stack:** `web-push` (backend push), Browser Push API + Service Worker (frontend), Prisma + PostgreSQL (storage), `node-cron` (already used), `supertest` + `jest` (tests)

---

## File Structure

**New files:**
- `backend/services/pushNotificationService.js` — VAPID init, `sendToCoaches`, `getUKHHMM`
- `backend/routes/push.js` — subscribe/unsubscribe/preferences/vapid-key endpoints
- `backend/__tests__/push.routes.test.js` — route integration tests
- `backend/__tests__/push.service.test.js` — unit test for `sendToCoaches`
- `frontend/public/manifest.json` — PWA manifest
- `frontend/public/service-worker.js` — push + notificationclick handlers
- `frontend/src/hooks/usePushNotifications.js` — subscription lifecycle hook
- `frontend/src/components/PushNotificationSettings.js` — UI component

**Modified files:**
- `backend/prisma/schema.prisma` — add `PushNotificationType` enum, `PushSubscription`, `PushNotificationPreference` models; add relations to `User`
- `backend/server.js` — mount `/api/push` routes + add session-reminder cron job
- `backend/__tests__/helpers/create-test-app.js` — mount `/api/push` routes
- `backend/__tests__/helpers/seed.js` — add `createCoach` helper
- `backend/__tests__/helpers/db.js` — clean push tables in `cleanDatabase`
- `frontend/public/index.html` — add `<link rel="manifest">`
- `frontend/src/index.js` — register service worker
- `frontend/src/pages/Profile.js` — add Notifications tab with `PushNotificationSettings`

---

## Task 1: Install web-push

**Files:**
- Modify: `backend/package.json` (via npm)

- [ ] **Step 1: Install the package**

```bash
cd backend && npm install web-push
```

Expected: `web-push` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
cd backend && git add package.json package-lock.json
git commit -m "chore: install web-push"
```

---

## Task 2: Generate VAPID keys and add to environment files

VAPID keys authenticate your server to browser push services. Generated once; never rotate unless absolutely necessary.

**Files:**
- Modify: `backend/.env` (you do this manually — never commit `.env`)
- Modify: `backend/.env.test`

- [ ] **Step 1: Generate keys**

```bash
cd backend && npx web-push generate-vapid-keys
```

Expected output (values will differ):
```
=======================================
Public Key:
BNcRdreALRFXTkOOUHK1EtK2wtq...

Private Key:
your-private-key-here
=======================================
```

- [ ] **Step 2: Add to `backend/.env`**

Add these three lines (use the values from Step 1):
```
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:admin@trampoline.life
```

- [ ] **Step 3: Add test values to `backend/.env.test`**

Add the same keys from Step 1 to `.env.test` (the test suite needs them to start the service):
```
VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:admin@trampoline.life
```

- [ ] **Step 4: Commit**

```bash
git add backend/.env.test
git commit -m "chore: add VAPID keys to test env"
```

---

## Task 3: Schema changes

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the enum and models**

At the end of `backend/prisma/schema.prisma`, before the closing of the file, add:

```prisma
enum PushNotificationType {
  SESSION_REMINDER
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@map("push_subscriptions")
}

model PushNotificationPreference {
  userId           String
  notificationType PushNotificationType
  enabled          Boolean              @default(true)
  user             User                 @relation(fields: [userId], references: [id])

  @@id([userId, notificationType])
  @@map("push_notification_preferences")
}
```

- [ ] **Step 2: Add back-relations to the User model**

Inside the `model User { ... }` block, add these two lines alongside the other relation fields (after `namedContactsCreated` is a good place):

```prisma
  pushSubscriptions            PushSubscription[]
  pushNotificationPreferences  PushNotificationPreference[]
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_push_notifications
```

Expected: migration file created, schema applied to dev DB, Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add push subscription and preference schema"
```

---

## Task 4: Update test cleanDatabase to include push tables

**Files:**
- Modify: `backend/__tests__/helpers/db.js`

- [ ] **Step 1: Add push table cleanup**

In `cleanDatabase()`, add these two lines before the `await prisma.user.deleteMany(...)` line:

```js
  await prisma.pushNotificationPreference.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: testUserIds } } });
```

- [ ] **Step 2: Commit**

```bash
git add backend/__tests__/helpers/db.js
git commit -m "test: clean push tables in cleanDatabase"
```

---

## Task 5: Add createCoach helper to seed

**Files:**
- Modify: `backend/__tests__/helpers/seed.js`

- [ ] **Step 1: Add the helper**

After the `createParent` function, add:

```js
async function createCoach(club, overrides = {}) {
  const unique = Date.now() + Math.random().toString(36).slice(2, 7);
  return prisma.user.create({
    data: {
      email: `coach-${unique}@test.tl`,
      phone: '07700900001',
      password: HASHED_PASSWORD,
      firstName: 'Test',
      lastName: 'Coach',
      role: 'COACH',
      clubId: club.id,
      ...overrides,
    },
  });
}
```

- [ ] **Step 2: Export it**

Add `createCoach` to the `module.exports` object at the bottom.

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/helpers/seed.js
git commit -m "test: add createCoach seed helper"
```

---

## Task 6: Implement pushNotificationService

**Files:**
- Create: `backend/services/pushNotificationService.js`

- [ ] **Step 1: Write the failing unit test first**

Create `backend/__tests__/push.service.test.js`:

```js
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const { sendToCoaches, getUKHHMM } = require('../services/pushNotificationService');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createCoach } = require('./helpers/seed');

jest.mock('web-push');

describe('getUKHHMM', () => {
  it('formats a Date as HH:MM in Europe/London time', () => {
    // 2024-01-15 17:00:00 UTC = 17:00 GMT (winter, no DST offset)
    const date = new Date('2024-01-15T17:00:00Z');
    expect(getUKHHMM(date)).toBe('17:00');
  });

  it('applies BST offset in summer', () => {
    // 2024-07-15 16:00:00 UTC = 17:00 BST
    const date = new Date('2024-07-15T16:00:00Z');
    expect(getUKHHMM(date)).toBe('17:00');
  });
});

describe('sendToCoaches', () => {
  let club, coach;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    coach = await createCoach(club);
    await prisma.pushSubscription.create({
      data: {
        userId: coach.id,
        endpoint: 'https://push.example.com/sub/abc123',
        p256dh: 'fake-p256dh',
        auth: 'fake-auth',
      },
    });
    await prisma.pushNotificationPreference.create({
      data: { userId: coach.id, notificationType: 'SESSION_REMINDER', enabled: true },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    webpush.sendNotification.mockReset();
    webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  it('calls sendNotification for a subscribed coach', async () => {
    await sendToCoaches(club.id, 'SESSION_REMINDER', { title: 'Test', body: 'Body' });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/sub/abc123', keys: { p256dh: 'fake-p256dh', auth: 'fake-auth' } },
      JSON.stringify({ title: 'Test', body: 'Body' })
    );
  });

  it('does not call sendNotification when preference is disabled', async () => {
    await prisma.pushNotificationPreference.update({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
      data: { enabled: false },
    });
    await sendToCoaches(club.id, 'SESSION_REMINDER', { title: 'Test', body: 'Body' });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    // restore
    await prisma.pushNotificationPreference.update({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
      data: { enabled: true },
    });
  });

  it('deletes stale subscription on 410', async () => {
    const err = new Error('Gone');
    err.statusCode = 410;
    webpush.sendNotification.mockRejectedValue(err);
    await sendToCoaches(club.id, 'SESSION_REMINDER', { title: 'Test', body: 'Body' });
    const sub = await prisma.pushSubscription.findUnique({
      where: { endpoint: 'https://push.example.com/sub/abc123' },
    });
    expect(sub).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest __tests__/push.service.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../services/pushNotificationService'`

- [ ] **Step 3: Implement the service**

Create `backend/services/pushNotificationService.js`:

```js
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Returns the current time in Europe/London formatted as "HH:MM".
 * Handles BST/GMT automatically.
 * @param {Date} date
 * @returns {string} e.g. "17:00"
 */
function getUKHHMM(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns { gte, lt } for today's date in Europe/London — handles the midnight
 * edge case during BST where UTC date !== UK calendar date.
 * @param {Date} now
 * @returns {{ gte: Date, lt: Date }}
 */
function getUKDateBounds(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const day = parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value;
  const year = parts.find(p => p.type === 'year').value;

  const gte = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

/**
 * Send a push notification to all coaches in the given club who have the
 * specified notification type enabled (or have no preference row for it —
 * absence defaults to enabled).
 *
 * Stale subscriptions (410/404) are silently removed.
 *
 * @param {string} clubId
 * @param {'SESSION_REMINDER'} notificationType
 * @param {{ title: string, body: string, url?: string }} payload
 */
async function sendToCoaches(clubId, notificationType, payload) {
  // Find all COACH users in this club who have a subscription
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        clubId,
        role: 'COACH',
      },
    },
    include: {
      user: {
        include: {
          pushNotificationPreferences: {
            where: { notificationType },
          },
        },
      },
    },
  });

  const payloadStr = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      // Absence of a preference row defaults to enabled
      const pref = sub.user.pushNotificationPreferences[0];
      if (pref && !pref.enabled) return;

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`Push send failed for subscription ${sub.id}:`, err.message);
        }
      }
    })
  );
}

module.exports = { sendToCoaches, getUKHHMM, getUKDateBounds };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest __tests__/push.service.test.js --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/services/pushNotificationService.js backend/__tests__/push.service.test.js
git commit -m "feat: add pushNotificationService with sendToCoaches and UK timezone helpers"
```

---

## Task 7: Implement push routes

**Files:**
- Create: `backend/routes/push.js`

- [ ] **Step 1: Write the failing route tests**

Create `backend/__tests__/push.routes.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createCoach, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, coach, coachToken, parent, parentToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  coach = await createCoach(club);
  parent = await createParent(club);
  coachToken = tokenFor(coach);
  parentToken = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.pushNotificationPreference.deleteMany({ where: { userId: coach.id } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: [coach.id, parent.id] } } });
});

describe('GET /api/push/vapid-public-key', () => {
  it('returns the VAPID public key', async () => {
    const res = await request(app).get('/api/push/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
  });
});

describe('POST /api/push/subscribe', () => {
  it('stores a subscription and creates default preferences', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'key1', auth: 'auth1' },
      });

    expect(res.status).toBe(200);

    const sub = await prisma.pushSubscription.findUnique({
      where: { endpoint: 'https://push.example.com/abc' },
    });
    expect(sub).not.toBeNull();
    expect(sub.userId).toBe(coach.id);

    const pref = await prisma.pushNotificationPreference.findUnique({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
    });
    expect(pref).not.toBeNull();
    expect(pref.enabled).toBe(true);
  });

  it('upserts when the same endpoint subscribes again', async () => {
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ endpoint: 'https://push.example.com/dup', keys: { p256dh: 'k1', auth: 'a1' } });

    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ endpoint: 'https://push.example.com/dup', keys: { p256dh: 'k2', auth: 'a2' } });

    expect(res.status).toBe(200);
    const subs = await prisma.pushSubscription.findMany({ where: { endpoint: 'https://push.example.com/dup' } });
    expect(subs).toHaveLength(1);
    expect(subs[0].p256dh).toBe('k2');
  });

  it('returns 400 if endpoint is missing', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ keys: { p256dh: 'k', auth: 'a' } });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .send({ endpoint: 'https://push.example.com/x', keys: { p256dh: 'k', auth: 'a' } });
    expect(res.status).toBe(401);
  });

  it('works for any role (parent can subscribe)', async () => {
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ endpoint: 'https://push.example.com/parent', keys: { p256dh: 'k', auth: 'a' } });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/push/subscribe', () => {
  it('removes the subscription', async () => {
    await prisma.pushSubscription.create({
      data: { userId: coach.id, endpoint: 'https://push.example.com/del', p256dh: 'k', auth: 'a' },
    });

    const res = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ endpoint: 'https://push.example.com/del' });

    expect(res.status).toBe(200);
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://push.example.com/del' } });
    expect(sub).toBeNull();
  });

  it('returns 404 if not found', async () => {
    const res = await request(app)
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ endpoint: 'https://push.example.com/nonexistent' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .delete('/api/push/subscribe')
      .send({ endpoint: 'https://push.example.com/x' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/push/preferences', () => {
  beforeEach(async () => {
    await prisma.pushNotificationPreference.upsert({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
      update: { enabled: true },
      create: { userId: coach.id, notificationType: 'SESSION_REMINDER', enabled: true },
    });
  });

  it('updates the enabled flag', async () => {
    const res = await request(app)
      .patch('/api/push/preferences')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ notificationType: 'SESSION_REMINDER', enabled: false });

    expect(res.status).toBe(200);
    const pref = await prisma.pushNotificationPreference.findUnique({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
    });
    expect(pref.enabled).toBe(false);
  });

  it('returns 400 for unknown notification type', async () => {
    const res = await request(app)
      .patch('/api/push/preferences')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ notificationType: 'NONEXISTENT', enabled: false });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/push/preferences')
      .send({ notificationType: 'SESSION_REMINDER', enabled: false });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && npx jest __tests__/push.routes.test.js --no-coverage
```

Expected: FAIL — routes not mounted yet.

- [ ] **Step 3: Create `backend/routes/push.js`**

```js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { auth } = require('../middleware/auth');

const prisma = new PrismaClient();

const VALID_TYPES = ['SESSION_REMINDER'];

const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
});

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post('/subscribe', auth, async (req, res) => {
  const { error, value } = subscribeSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: value.endpoint },
      update: { p256dh: value.keys.p256dh, auth: value.keys.auth, userId: req.user.id },
      create: {
        userId: req.user.id,
        endpoint: value.endpoint,
        p256dh: value.keys.p256dh,
        auth: value.keys.auth,
      },
    });

    // Create default preference rows for any type that doesn't have one yet
    await Promise.all(
      VALID_TYPES.map((notificationType) =>
        prisma.pushNotificationPreference.upsert({
          where: { userId_notificationType: { userId: req.user.id, notificationType } },
          update: {},
          create: { userId: req.user.id, notificationType, enabled: true },
        })
      )
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/push/subscribe
router.delete('/subscribe', auth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  try {
    await prisma.pushSubscription.delete({ where: { endpoint } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subscription not found' });
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/push/preferences
router.patch('/preferences', auth, async (req, res) => {
  const { notificationType, enabled } = req.body;

  if (!VALID_TYPES.includes(notificationType)) {
    return res.status(400).json({ error: `Unknown notification type: ${notificationType}` });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  try {
    await prisma.pushNotificationPreference.upsert({
      where: { userId_notificationType: { userId: req.user.id, notificationType } },
      update: { enabled },
      create: { userId: req.user.id, notificationType, enabled },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Preferences error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount the routes in `create-test-app.js`**

Add this line to `backend/__tests__/helpers/create-test-app.js` alongside the other route mounts:

```js
  app.use('/api/push', require('../../routes/push'));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npx jest __tests__/push.routes.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/push.js backend/__tests__/push.routes.test.js backend/__tests__/helpers/create-test-app.js
git commit -m "feat: add push notification routes (subscribe, unsubscribe, preferences, vapid-key)"
```

---

## Task 8: Mount push routes and add session-reminder cron in server.js

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Add the import near the top of server.js**

After the existing route imports (around line 30), add:

```js
const pushRoutes = require('./routes/push');
const { sendToCoaches, getUKHHMM, getUKDateBounds } = require('./services/pushNotificationService');
```

- [ ] **Step 2: Mount the route**

After the existing route mounts (find the block where other `app.use('/api/...')` calls live), add:

```js
app.use('/api/push', pushRoutes);
```

- [ ] **Step 3: Add the session-reminder cron job**

At the end of the cron jobs section in server.js (after the last `cron.schedule(...)`), add:

```js
// Session reminder push notifications — runs every minute
// Sends to all subscribed coaches 5 minutes before a session starts
// TODO: use club.timezone when multi-timezone support is needed
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const in5 = new Date(now.getTime() + 5 * 60 * 1000);
    const targetTime = getUKHHMM(in5);
    const { gte, lt } = getUKDateBounds(in5);

    const instances = await prisma.sessionInstance.findMany({
      where: {
        date: { gte, lt },
        cancelledAt: null,
        template: { startTime: targetTime },
      },
      include: { template: true },
    });

    for (const instance of instances) {
      await sendToCoaches(instance.template.clubId, 'SESSION_REMINDER', {
        title: 'Session starting in 5 minutes',
        body: "Don't forget to take the register!",
        url: '/booking/admin',
      });
    }
  } catch (err) {
    console.error('Session reminder push error:', err);
  }
});
```

- [ ] **Step 4: Start the server and verify no startup errors**

```bash
cd backend && node server.js
```

Expected: server starts without errors, no crash on the new cron or route.

Stop the server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js
git commit -m "feat: mount push routes and add session-reminder cron job"
```

---

## Task 9: PWA manifest and index.html

**Files:**
- Create: `frontend/public/manifest.json`
- Modify: `frontend/public/index.html`

- [ ] **Step 1: Create `frontend/public/manifest.json`**

```json
{
  "name": "Trampoline Life",
  "short_name": "TL",
  "description": "Trampoline and DMT club management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/favicon-root.png",
      "sizes": "any",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Link the manifest from `frontend/public/index.html`**

Inside the `<head>` block, add this line after the existing `<link rel="apple-touch-icon">`:

```html
    <link rel="manifest" href="/manifest.json" />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/manifest.json frontend/public/index.html
git commit -m "feat: add PWA manifest"
```

---

## Task 10: Service worker

**Files:**
- Create: `frontend/public/service-worker.js`
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Create `frontend/public/service-worker.js`**

```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Trampoline Life', {
      body: data.body || '',
      icon: '/favicon-root.png',
      badge: '/favicon-root.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => 'focus' in c);
        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }
        return clients.openWindow(url);
      })
  );
});
```

- [ ] **Step 2: Register the service worker in `frontend/src/index.js`**

After the `root.render(...)` call, add:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/service-worker.js frontend/src/index.js
git commit -m "feat: add service worker for push notifications"
```

---

## Task 11: usePushNotifications hook

**Files:**
- Create: `frontend/src/hooks/usePushNotifications.js`

- [ ] **Step 1: Create the hook**

```js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Converts a base64url-encoded VAPID public key to the Uint8Array
 * format required by pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Manages the Web Push subscription lifecycle and per-type preferences.
 *
 * Returns:
 *  - supported: boolean — false on browsers that don't support push
 *  - permissionState: 'default' | 'granted' | 'denied'
 *  - isSubscribed: boolean
 *  - preferences: { SESSION_REMINDER: boolean }
 *  - subscribe(): Promise<void>
 *  - unsubscribe(): Promise<void>
 *  - updatePreference(type, enabled): Promise<void>
 */
export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permissionState, setPermissionState] = useState(
    supported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState({ SESSION_REMINDER: true });
  const [loading, setLoading] = useState(false);

  // On mount, check if there is already an active subscription
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [supported]);

  // Fetch current preferences from the server when subscribed
  useEffect(() => {
    if (!isSubscribed) return;
    axios
      .get('/api/push/preferences')
      .then((res) => setPreferences(res.data))
      .catch(() => {});
  }, [isSubscribed]);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== 'granted') return;

      const { data } = await axios.get('/api/push/vapid-public-key');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await axios.post('/api/push/subscribe', sub.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await axios.delete('/api/push/subscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreference = useCallback(async (type, enabled) => {
    try {
      await axios.patch('/api/push/preferences', { notificationType: type, enabled });
      setPreferences((prev) => ({ ...prev, [type]: enabled }));
    } catch (err) {
      console.error('Preference update error:', err);
    }
  }, []);

  return {
    supported,
    permissionState,
    isSubscribed,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreference,
  };
}
```

**Note:** The hook calls `GET /api/push/preferences` — add this route to `backend/routes/push.js`:

```js
// GET /api/push/preferences — returns { SESSION_REMINDER: true/false }
router.get('/preferences', auth, async (req, res) => {
  try {
    const prefs = await prisma.pushNotificationPreference.findMany({
      where: { userId: req.user.id },
    });
    const result = {};
    for (const p of prefs) {
      result[p.notificationType] = p.enabled;
    }
    res.json(result);
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

Add this route before the `module.exports` in `backend/routes/push.js`. (Place it between the VAPID key route and the subscribe route.)

- [ ] **Step 2: Add a test for GET /preferences to `backend/__tests__/push.routes.test.js`**

Add this describe block at the end of `push.routes.test.js`, before the final closing:

```js
describe('GET /api/push/preferences', () => {
  beforeEach(async () => {
    await prisma.pushNotificationPreference.upsert({
      where: { userId_notificationType: { userId: coach.id, notificationType: 'SESSION_REMINDER' } },
      update: { enabled: true },
      create: { userId: coach.id, notificationType: 'SESSION_REMINDER', enabled: true },
    });
  });

  it('returns the preferences map', async () => {
    const res = await request(app)
      .get('/api/push/preferences')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.status).toBe(200);
    expect(res.body.SESSION_REMINDER).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/push/preferences');
    expect(res.status).toBe(401);
  });
});
```

Run the route tests to confirm they still pass:

```bash
cd backend && npx jest __tests__/push.routes.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePushNotifications.js backend/routes/push.js backend/__tests__/push.routes.test.js
git commit -m "feat: add usePushNotifications hook and GET /preferences route"
```

---

## Task 12: PushNotificationSettings component

**Files:**
- Create: `frontend/src/components/PushNotificationSettings.js`

- [ ] **Step 1: Create the component**

```js
import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const NOTIFICATION_LABELS = {
  SESSION_REMINDER: 'Session reminders — notified 5 minutes before a session starts',
};

export default function PushNotificationSettings() {
  const {
    supported,
    permissionState,
    isSubscribed,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreference,
  } = usePushNotifications();

  if (!supported) {
    return (
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Push Notifications</h3>

      {permissionState === 'denied' && (
        <p style={{ color: '#b00', fontSize: '0.9rem' }}>
          Notifications are blocked. To enable them, update the permission in your browser or device settings.
        </p>
      )}

      {permissionState !== 'denied' && !isSubscribed && (
        <div>
          <p style={{ color: '#444', fontSize: '0.9rem' }}>
            Get notified about upcoming sessions and club updates.
          </p>
          <button onClick={subscribe} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable notifications'}
          </button>
        </div>
      )}

      {isSubscribed && (
        <div>
          <p style={{ color: '#006600', fontSize: '0.9rem' }}>Notifications enabled.</p>
          <button onClick={unsubscribe} disabled={loading} style={{ marginBottom: '1rem' }}>
            {loading ? 'Disabling...' : 'Disable notifications'}
          </button>

          <div>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Notification types</strong>
            {Object.entries(NOTIFICATION_LABELS).map(([type, label]) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preferences[type] !== false}
                  onChange={(e) => updatePreference(type, e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PushNotificationSettings.js
git commit -m "feat: add PushNotificationSettings component"
```

---

## Task 13: Add Notifications tab to Profile page

**Files:**
- Modify: `frontend/src/pages/Profile.js`

- [ ] **Step 1: Import the component**

At the top of `frontend/src/pages/Profile.js`, add:

```js
import PushNotificationSettings from '../components/PushNotificationSettings';
```

- [ ] **Step 2: Add 'notifications' to the tab list**

The Profile page renders tabs via `activeTab` state. Find where the tab buttons are rendered (look for the `profile` and `password` tab buttons) and add a Notifications tab button alongside them:

```jsx
<button
  onClick={() => setActiveTab('notifications')}
  className={activeTab === 'notifications' ? 'active' : ''}
>
  Notifications
</button>
```

- [ ] **Step 3: Add the tab panel**

Find where the `profile` and `password` tab content is conditionally rendered and add:

```jsx
{activeTab === 'notifications' && (
  <div>
    <PushNotificationSettings />
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Profile.js
git commit -m "feat: add Notifications tab to Profile page"
```

---

## Task 14: Run all backend tests

- [ ] **Step 1: Run the full test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass. If any unrelated test fails, investigate before proceeding.

- [ ] **Step 2: Push to remote**

```bash
git push
```

---

## Verification checklist

After deploying, manually verify:

- [ ] On Chrome/Edge desktop: visit the app → Profile → Notifications → "Enable notifications" → grant permission → browser shows a notification subscription prompt → check the subscription appears in the DB: `SELECT * FROM push_subscriptions;`
- [ ] Add a `SessionInstance` with `startTime` = 5 minutes from now and verify a push arrives on the subscribed device
- [ ] Toggle "Session reminders" off → verify `push_notification_preferences` row has `enabled = false` → no push sent
- [ ] On iOS (16.4+): add app to Home Screen first, then open from Home Screen → Notifications tab → enable → grant permission
- [ ] Verify the notification tap opens `/booking/admin`
