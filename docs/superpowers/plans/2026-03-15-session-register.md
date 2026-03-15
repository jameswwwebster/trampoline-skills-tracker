# Session Attendance Register Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to mark attendance (PRESENT/ABSENT) on their phone during a session, with a full-screen mobile-optimised register page.

**Architecture:** New `Attendance` model in Prisma stores per-gymnast per-instance attendance. A new Express route file (`attendance.js`) exposes GET and POST endpoints that build the expected attendee list from confirmed bookings plus active commitments, then decorate with attendance status. The frontend has a dedicated full-screen `AdminRegister` page plus a smart "Register" nav link in `BookingLayout` that auto-navigates to any currently-active session.

**Tech Stack:** Node.js/Express, Prisma 5, PostgreSQL, React 18, React Router v6, Joi validation, axios

---

## Chunk 1: Data model

### Task 1: Add `Attendance` model and enum to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the `AttendanceStatus` enum and `Attendance` model**

Open `backend/prisma/schema.prisma`. Add the following after the last existing enum (search for the end of the enums block near the bottom of the file):

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
}
```

Add the following model after `model BookingLine`:

```prisma
model Attendance {
  id                String           @id @default(cuid())
  sessionInstance   SessionInstance  @relation(fields: [sessionInstanceId], references: [id], onDelete: Cascade)
  sessionInstanceId String
  gymnast           Gymnast          @relation(fields: [gymnastId], references: [id], onDelete: Cascade)
  gymnastId         String
  status            AttendanceStatus
  markedBy          User             @relation(fields: [markedById], references: [id])
  markedById        String
  markedAt          DateTime         @default(now())

  @@unique([sessionInstanceId, gymnastId])
  @@map("attendances")
}
```

Add back-relations. In `model SessionInstance`, add:

```prisma
  attendances    Attendance[]
```

In `model Gymnast`, add:

```prisma
  attendances    Attendance[]
```

In `model User`, add:

```prisma
  attendances    Attendance[]
```

- [ ] **Step 2: Create and apply the migration**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend
npx prisma migrate dev --name add_attendance
```

Expected: migration file created, applied to local DB, Prisma client regenerated.

- [ ] **Step 3: Verify schema compiles**

```bash
npx prisma validate
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Attendance model and AttendanceStatus enum"
```

---

## Chunk 2: Backend — attendance route

### Task 2: Write failing tests for the attendance API

**Files:**
- Create: `backend/__tests__/booking.attendance.test.js`

- [ ] **Step 1: Create the test file**

```js
// backend/__tests__/booking.attendance.test.js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, createConfirmedBooking, tokenFor } = require('./helpers/seed');

// Mount the attendance route on the test app — this will fail until the route exists
const app = createTestApp();

let club, otherClub, admin, adminToken, coach, coachToken, parent, gymnast1, gymnast2,
    template, instance, parentToken, otherAdmin, otherAdminToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  otherClub = await createTestClub();

  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `att-admin-${Date.now()}@test.tl` });
  coach = await createParent(club, { role: 'COACH', email: `att-coach-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `att-parent-${Date.now()}@test.tl` });
  otherAdmin = await createParent(otherClub, { role: 'CLUB_ADMIN', email: `att-other-${Date.now()}@test.tl` });

  adminToken = tokenFor(admin);
  coachToken = tokenFor(coach);
  parentToken = tokenFor(parent);
  otherAdminToken = tokenFor(otherAdmin);

  gymnast1 = await createGymnast(club, parent, { firstName: 'Alice', lastName: 'Smith' });
  gymnast2 = await createGymnast(club, parent, { firstName: 'Bob', lastName: 'Jones' });

  const sess = await createSession(club, new Date());
  template = sess.template;
  instance = sess.instance;
});

afterEach(async () => {
  await prisma.attendance.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.commitment.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function createCommitment(gymnast, tmpl, status = 'ACTIVE', startDate = null) {
  return prisma.commitment.create({
    data: {
      gymnastId: gymnast.id,
      templateId: tmpl.id,
      status,
      startDate,
      createdById: admin.id,
    },
  });
}

// ─── GET /api/booking/attendance/:instanceId ──────────────────────────────────

describe('GET /api/booking/attendance/:instanceId', () => {
  it('returns UNMARKED attendee from CONFIRMED booking', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ id: instance.id });
    expect(res.body.attendees).toHaveLength(1);
    expect(res.body.attendees[0]).toMatchObject({
      gymnastId: gymnast1.id,
      firstName: 'Alice',
      status: 'UNMARKED',
    });
  });

  it('returns UNMARKED attendee from ACTIVE commitment with no startDate', async () => {
    await createCommitment(gymnast1, template, 'ACTIVE', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
    expect(res.body.attendees[0].gymnastId).toBe(gymnast1.id);
    expect(res.body.attendees[0].status).toBe('UNMARKED');
  });

  it('returns UNMARKED attendee from ACTIVE commitment with startDate in the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await createCommitment(gymnast1, template, 'ACTIVE', yesterday);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
  });

  it('excludes commitment with startDate in the future', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await createCommitment(gymnast1, template, 'ACTIVE', tomorrow);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(0);
  });

  it('excludes PAUSED commitment gymnasts', async () => {
    await createCommitment(gymnast1, template, 'PAUSED', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(0);
  });

  it('deduplicates gymnast appearing in both booking and commitment', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await createCommitment(gymnast1, template, 'ACTIVE', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
  });

  it('returns PRESENT for gymnast with attendance record', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await prisma.attendance.create({
      data: {
        sessionInstanceId: instance.id,
        gymnastId: gymnast1.id,
        status: 'PRESENT',
        markedById: admin.id,
      },
    });

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].status).toBe('PRESENT');
  });

  it('returns ABSENT for gymnast with ABSENT attendance record', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await prisma.attendance.create({
      data: {
        sessionInstanceId: instance.id,
        gymnastId: gymnast1.id,
        status: 'ABSENT',
        markedById: admin.id,
      },
    });

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].status).toBe('ABSENT');
  });

  it('allows COACH to access', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
  });

  it('returns attendees sorted by firstName', async () => {
    await createConfirmedBooking(parent, gymnast1, instance); // Alice
    await createCommitment(gymnast2, template, 'ACTIVE', null); // Bob

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].firstName).toBe('Alice');
    expect(res.body.attendees[1].firstName).toBe('Bob');
  });

  it('returns 404 for instance from a different club', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`);

    expect(res.status).toBe(401);
  });

  it('returns 403 for PARENT role', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/booking/attendance/:instanceId ─────────────────────────────────

describe('POST /api/booking/attendance/:instanceId', () => {
  beforeEach(async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
  });

  it('creates PRESENT record for gymnast on list', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      gymnastId: gymnast1.id,
      firstName: 'Alice',
      status: 'PRESENT',
    });

    const record = await prisma.attendance.findUnique({
      where: { sessionInstanceId_gymnastId: { sessionInstanceId: instance.id, gymnastId: gymnast1.id } },
    });
    expect(record).not.toBeNull();
    expect(record.status).toBe('PRESENT');
    expect(record.markedById).toBe(admin.id);
  });

  it('upserts — second POST with ABSENT updates the record', async () => {
    await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'ABSENT' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ABSENT');

    const count = await prisma.attendance.count({
      where: { sessionInstanceId: instance.id, gymnastId: gymnast1.id },
    });
    expect(count).toBe(1);
  });

  it('returns 422 when gymnast is not on the expected list', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast2.id, status: 'PRESENT' });

    expect(res.status).toBe(422);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'MAYBE' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for instance from a different club', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for PARENT role', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Register the route in `create-test-app.js` (it will fail on missing module)**

Open `backend/__tests__/helpers/create-test-app.js`. Add this line inside `createTestApp()`, after the last `app.use(...)` call and before the error handler:

```js
  app.use('/api/booking/attendance', require('../../routes/booking/attendance'));
```

- [ ] **Step 3: Run tests to confirm they fail with module-not-found**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend
npx jest booking.attendance --no-coverage 2>&1 | head -30
```

Expected: `Cannot find module '../../routes/booking/attendance'`

### Task 3: Implement the attendance route

**Files:**
- Create: `backend/routes/booking/attendance.js`

- [ ] **Step 1: Create the route file**

```js
// backend/routes/booking/attendance.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// Shared: build the expected attendee list for a session instance.
// Returns array of { gymnastId, firstName, lastName } deduped + sorted by firstName.
async function buildExpectedList(instanceId, clubId) {
  const instance = await prisma.sessionInstance.findUnique({
    where: { id: instanceId },
    include: { template: true },
  });
  if (!instance || instance.template.clubId !== clubId) return null;

  // Source 1: gymnasts from CONFIRMED bookings
  const bookings = await prisma.booking.findMany({
    where: { sessionInstanceId: instanceId, status: 'CONFIRMED' },
    include: { lines: { include: { gymnast: true } } },
  });
  const fromBookings = bookings.flatMap(b =>
    b.lines.map(l => ({
      gymnastId: l.gymnast.id,
      firstName: l.gymnast.firstName,
      lastName: l.gymnast.lastName,
    }))
  );

  // Source 2: gymnasts with ACTIVE commitment for this template
  // where startDate is null OR <= start of today UTC
  const todayUtcStart = new Date();
  todayUtcStart.setUTCHours(0, 0, 0, 0);

  const commitments = await prisma.commitment.findMany({
    where: {
      templateId: instance.templateId,
      status: 'ACTIVE',
      OR: [
        { startDate: null },
        { startDate: { lte: todayUtcStart } },
      ],
    },
    include: { gymnast: true },
  });
  const fromCommitments = commitments.map(c => ({
    gymnastId: c.gymnast.id,
    firstName: c.gymnast.firstName,
    lastName: c.gymnast.lastName,
  }));

  // Deduplicate by gymnastId
  const seen = new Set();
  const all = [...fromBookings, ...fromCommitments].filter(g => {
    if (seen.has(g.gymnastId)) return false;
    seen.add(g.gymnastId);
    return true;
  });

  // Sort by firstName
  all.sort((a, b) => a.firstName.localeCompare(b.firstName));

  return { instance, list: all };
}

// GET /api/booking/attendance/:instanceId
router.get('/:instanceId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const result = await buildExpectedList(req.params.instanceId, req.user.clubId);
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const { instance, list } = result;

    // Fetch existing attendance records for this instance
    const records = await prisma.attendance.findMany({
      where: { sessionInstanceId: instance.id },
    });
    const statusMap = Object.fromEntries(records.map(r => [r.gymnastId, r.status]));

    const attendees = list.map(g => ({
      gymnastId: g.gymnastId,
      firstName: g.firstName,
      lastName: g.lastName,
      status: statusMap[g.gymnastId] || 'UNMARKED',
    }));

    res.json({
      session: {
        id: instance.id,
        date: instance.date,
        templateName: instance.template.type,
        startTime: instance.template.startTime,
        endTime: instance.template.endTime,
      },
      attendees,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/attendance/:instanceId
router.post('/:instanceId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      gymnastId: Joi.string().required(),
      status: Joi.string().valid('PRESENT', 'ABSENT').required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await buildExpectedList(req.params.instanceId, req.user.clubId);
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const { instance, list } = result;

    const onList = list.find(g => g.gymnastId === value.gymnastId);
    if (!onList) return res.status(422).json({ error: 'Gymnast is not expected at this session' });

    await prisma.attendance.upsert({
      where: {
        sessionInstanceId_gymnastId: {
          sessionInstanceId: instance.id,
          gymnastId: value.gymnastId,
        },
      },
      create: {
        sessionInstanceId: instance.id,
        gymnastId: value.gymnastId,
        status: value.status,
        markedById: req.user.id,
      },
      update: {
        status: value.status,
        markedById: req.user.id,
        markedAt: new Date(),
      },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'attendance.mark',
      entityType: 'Attendance',
      entityId: instance.id,
      metadata: { gymnastId: value.gymnastId, status: value.status, instanceId: instance.id },
    });

    res.json({
      gymnastId: onList.gymnastId,
      firstName: onList.firstName,
      lastName: onList.lastName,
      status: value.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register the route in `backend/server.js`**

Open `backend/server.js`. After the line:

```js
app.use('/api/booking/templates', require('./routes/booking/templates'));
```

Add:

```js
app.use('/api/booking/attendance', require('./routes/booking/attendance'));
```

- [ ] **Step 3: Run the tests**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend
npx jest booking.attendance --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add backend/routes/booking/attendance.js backend/__tests__/booking.attendance.test.js backend/__tests__/helpers/create-test-app.js backend/server.js
git commit -m "feat: add attendance GET and POST API routes with tests"
```

---

## Chunk 3: Frontend — API helpers and register page

### Task 4: Add `getAttendance` and `createAttendance` to `bookingApi.js`

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

- [ ] **Step 1: Add the two methods to the `bookingApi` object**

Open `frontend/src/utils/bookingApi.js`. Inside the `bookingApi` object (before the closing `};`), add after the `// Charges` section:

```js
  // Attendance register
  getAttendance: (instanceId) =>
    axios.get(`${API_URL}/booking/attendance/${instanceId}`, { headers: getHeaders() }),

  createAttendance: (instanceId, data) =>
    axios.post(`${API_URL}/booking/attendance/${instanceId}`, data, { headers: getHeaders() }),
```

- [ ] **Step 2: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add getAttendance and createAttendance to bookingApi"
```

### Task 5: Create the `AdminRegister` page

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminRegister.js`

This is a full-screen mobile-optimised page. Tapping a gymnast row cycles UNMARKED → PRESENT → ABSENT → UNMARKED and auto-saves each tap.

- [ ] **Step 1: Create the component**

```jsx
// frontend/src/pages/booking/admin/AdminRegister.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_CYCLE = { UNMARKED: 'PRESENT', PRESENT: 'ABSENT', ABSENT: 'UNMARKED' };

const STATUS_STYLE = {
  PRESENT: { background: '#d4edda', color: '#155724', border: '2px solid #28a745' },
  ABSENT:  { background: '#f8d7da', color: '#721c24', border: '2px solid #dc3545' },
  UNMARKED:{ background: 'var(--booking-bg-light)', color: 'var(--booking-text-muted)', border: '2px solid var(--booking-border)' },
};

const STATUS_LABEL = { PRESENT: 'Present', ABSENT: 'Absent', UNMARKED: 'Unmarked' };

function formatDate(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function AdminRegister() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [saving, setSaving] = useState({}); // { [gymnastId]: true }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getAttendance(instanceId)
      .then(res => {
        setSession(res.data.session);
        setAttendees(res.data.attendees);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Session not found.');
        } else {
          setError('Failed to load register.');
        }
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  const handleTap = useCallback(async (gymnast) => {
    const next = STATUS_CYCLE[gymnast.status];
    // Optimistically update
    setAttendees(prev =>
      prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: next } : a)
    );
    setSaving(s => ({ ...s, [gymnast.gymnastId]: true }));
    try {
      await bookingApi.createAttendance(instanceId, {
        gymnastId: gymnast.gymnastId,
        status: next === 'UNMARKED' ? 'ABSENT' : next, // UNMARKED not a valid POST value — treat cycle-back to UNMARKED as ABSENT
      });
    } catch (err) {
      // Revert on failure
      setAttendees(prev =>
        prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: gymnast.status } : a)
      );
    } finally {
      setSaving(s => ({ ...s, [gymnast.gymnastId]: false }));
    }
  }, [instanceId]);

  const presentCount = attendees.filter(a => a.status === 'PRESENT').length;
  const absentCount = attendees.filter(a => a.status === 'ABSENT').length;
  const unmarkedCount = attendees.filter(a => a.status === 'UNMARKED').length;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--booking-text-muted)' }}>
        Loading register...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <p className="bk-error">{error}</p>
        <button className="bk-btn" onClick={() => navigate('/booking/admin')}>Back to sessions</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', fontSize: '1.4rem',
            cursor: 'pointer', color: 'var(--booking-text-muted)', padding: '0.25rem',
          }}
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {session?.startTime}–{session?.endTime}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
            {formatDate(session?.date)}
          </p>
        </div>
      </div>

      {/* Summary counts */}
      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
        fontSize: '0.875rem',
      }}>
        <span style={{ color: '#155724' }}>{presentCount} present</span>
        <span style={{ color: '#721c24' }}>{absentCount} absent</span>
        <span style={{ color: 'var(--booking-text-muted)' }}>{unmarkedCount} unmarked</span>
      </div>

      {/* Attendee list */}
      {attendees.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No one is expected at this session.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {attendees.map(a => (
            <li
              key={a.gymnastId}
              onClick={() => !saving[a.gymnastId] && handleTap(a)}
              style={{
                ...STATUS_STYLE[a.status],
                borderRadius: 'var(--booking-radius)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: saving[a.gymnastId] ? 'wait' : 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                opacity: saving[a.gymnastId] ? 0.7 : 1,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                {a.firstName} {a.lastName}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                {saving[a.gymnastId] ? '...' : STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Note on the UNMARKED cycle: tapping back to UNMARKED sends `ABSENT` to the API (since the API only accepts PRESENT/ABSENT, not UNMARKED). If you want true "clear the mark" behaviour you can implement a DELETE endpoint later. For now the cycle is: tap once = PRESENT, tap twice = ABSENT, tap three times = ABSENT (no change). Adjust `STATUS_CYCLE` if desired — the simplest approach is to stop the cycle at ABSENT: `UNMARKED → PRESENT → ABSENT → ABSENT`.

Actually, to avoid confusion let's keep the cycle true to the spec (UNMARKED → PRESENT → ABSENT → UNMARKED) but recognise that cycling back to UNMARKED from ABSENT sends ABSENT again (no visual change from server's perspective, but the UI shows UNMARKED optimistically). Update the `handleTap` function to only POST when next !== 'UNMARKED':

Replace the `handleTap` function body in the file above with this version:

```js
  const handleTap = useCallback(async (gymnast) => {
    const next = STATUS_CYCLE[gymnast.status];
    // Optimistically update UI
    setAttendees(prev =>
      prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: next } : a)
    );
    // Only POST to API for PRESENT/ABSENT (not UNMARKED — API doesn't accept it)
    if (next === 'UNMARKED') return;
    setSaving(s => ({ ...s, [gymnast.gymnastId]: true }));
    try {
      await bookingApi.createAttendance(instanceId, {
        gymnastId: gymnast.gymnastId,
        status: next,
      });
    } catch {
      // Revert on failure
      setAttendees(prev =>
        prev.map(a => a.gymnastId === gymnast.gymnastId ? { ...a, status: gymnast.status } : a)
      );
    } finally {
      setSaving(s => ({ ...s, [gymnast.gymnastId]: false }));
    }
  }, [instanceId]);
```

Write the final file with the corrected `handleTap` (not the intermediate version).

- [ ] **Step 2: Register the route in `frontend/src/App.js`**

Open `frontend/src/App.js`. Add the import near the other admin imports:

```js
import AdminRegister from './pages/booking/admin/AdminRegister';
```

Add the route inside the `/booking` `<Route>` block, after `admin/charges`:

```jsx
<Route path="admin/register/:instanceId" element={<AdminRegister />} />
```

- [ ] **Step 3: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add frontend/src/pages/booking/admin/AdminRegister.js frontend/src/App.js
git commit -m "feat: add AdminRegister full-screen attendance page"
```

---

## Chunk 4: Frontend — "Open register" button and nav link

### Task 6: Add "Open register" button to the session detail panel in `BookingAdmin.js`

**Files:**
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

The session detail panel is the `SessionDetailPanel` component in this file. It renders the list of bookings and a manual add button. We need to add an "Open register" button that navigates to `/booking/admin/register/:instanceId`.

- [ ] **Step 1: Import `useNavigate` at the top of `BookingAdmin.js`**

The file already imports from React but uses no router hooks. Add:

```js
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add `useNavigate` call and "Open register" button inside `SessionDetailPanel`**

Find `function SessionDetailPanel(` in the file. Add `const navigate = useNavigate();` as the first line of the function body.

Then find the line:

```jsx
      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%' }}
        onClick={() => setShowManualAdd(v => !v)}
      >
        {showManualAdd ? 'Cancel' : '+ Add participant manually'}
      </button>
```

Add the "Open register" button **above** it:

```jsx
      <button
        className="bk-btn bk-btn--primary"
        style={{ width: '100%', marginBottom: '0.5rem' }}
        onClick={() => navigate(`/booking/admin/register/${selectedSession}`)}
      >
        Open register
      </button>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: add 'Open register' button to session detail panel"
```

### Task 7: Add "Register" nav link to `BookingLayout.js` with active-session detection

**Files:**
- Modify: `frontend/src/pages/booking/BookingLayout.js`

The "Register" link should:
- On load (for admin): fetch today's session instances and determine which are currently active (startTime − 15min ≤ now ≤ endTime)
- If exactly one is active: clicking navigates directly to `/booking/admin/register/:instanceId`
- If multiple active: clicking opens an inline picker
- If none active: clicking navigates to `/booking/admin` (the calendar)
- Visually highlighted (bold/accent) when any session is active

- [ ] **Step 1: Add state and effect for active sessions**

Open `frontend/src/pages/booking/BookingLayout.js`.

After the existing state declarations (around line 32), add:

```js
  const [activeSessions, setActiveSessions] = useState([]); // array of { id, startTime, endTime }
  const [showRegisterPicker, setShowRegisterPicker] = useState(false);
```

After the existing `useEffect` blocks, add a new effect that fetches today's sessions when the user is an admin:

```js
  useEffect(() => {
    if (!isAdmin) return;

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    bookingApi.getSessions(y, m)
      .then(res => {
        const todayStr = now.toISOString().split('T')[0];
        const todays = res.data.filter(s => {
          const d = new Date(s.date);
          return d.toISOString().split('T')[0] === todayStr;
        });

        // Parse HH:MM startTime/endTime and check active window: startTime - 15min <= now <= endTime
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const active = todays.filter(s => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          const startMins = sh * 60 + sm - 15;
          const endMins = eh * 60 + em;
          return nowMins >= startMins && nowMins <= endMins;
        });
        setActiveSessions(active);
      })
      .catch(() => {});
  }, [isAdmin]);
```

- [ ] **Step 2: Add the Register nav link and picker**

In the admin nav section of the JSX (inside `{isAdmin && (...)}`), find the line:

```jsx
              <NavLink to="/booking/admin/shop-orders" className="booking-layout__admin-link">Shop Orders</NavLink>
```

Add the Register link **before** it:

```jsx
              <div style={{ position: 'relative' }}>
                <button
                  className={`booking-layout__admin-link${activeSessions.length > 0 ? ' booking-layout__admin-link--active-register' : ''}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontWeight: activeSessions.length > 0 ? 700 : undefined,
                    color: activeSessions.length > 0 ? 'var(--booking-accent)' : undefined,
                  }}
                  onClick={() => {
                    setOpenDropdown(null);
                    if (activeSessions.length === 0) {
                      navigate('/booking/admin');
                    } else if (activeSessions.length === 1) {
                      navigate(`/booking/admin/register/${activeSessions[0].id}`);
                    } else {
                      setShowRegisterPicker(p => !p);
                    }
                  }}
                >
                  Register{activeSessions.length > 0 ? ` (${activeSessions.length})` : ''}
                </button>
                {showRegisterPicker && activeSessions.length > 1 && (
                  <div className="booking-layout__dropdown-menu" style={{ minWidth: '180px' }}>
                    {activeSessions.map(s => (
                      <button
                        key={s.id}
                        className="booking-layout__dropdown-item"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                        onClick={() => {
                          setShowRegisterPicker(false);
                          navigate(`/booking/admin/register/${s.id}`);
                        }}
                      >
                        {s.startTime}–{s.endTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git add frontend/src/pages/booking/BookingLayout.js
git commit -m "feat: add Register nav link with active-session detection to BookingLayout"
```

---

## Chunk 5: Final wiring check

### Task 8: Smoke test end-to-end

- [ ] **Step 1: Run all backend tests**

```bash
cd /Users/james/Documents/Projects/Experiments/life/backend
npx jest --no-coverage
```

Expected: all tests pass (including the new attendance tests).

- [ ] **Step 2: Start the dev servers and manual-test**

```bash
# Terminal 1 — backend
cd /Users/james/Documents/Projects/Experiments/life/backend
npm run dev

# Terminal 2 — frontend
cd /Users/james/Documents/Projects/Experiments/life/frontend
npm start
```

Manual test checklist:
- [ ] Log in as CLUB_ADMIN
- [ ] Navigate to `/booking/admin`, click a session, confirm "Open register" button appears
- [ ] Click "Open register" — verify it opens `/booking/admin/register/:instanceId`
- [ ] Tap a gymnast row — confirm it cycles UNMARKED → PRESENT → ABSENT → UNMARKED
- [ ] Verify PRESENT is green, ABSENT is red/muted, UNMARKED is grey
- [ ] Reload the page — confirm marks are persisted (loaded from API)
- [ ] When a session is active (within 15 min of start through end), confirm "Register" nav link appears highlighted
- [ ] When no session is active, clicking "Register" goes to admin calendar

- [ ] **Step 3: Push to remote**

```bash
cd /Users/james/Documents/Projects/Experiments/life
git push
```
