# Waitlist UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the waitlist system with email notifications, a 6hr exclusive/open offer split, booking route enforcement, inline booking for offered slots, and a My Waitlist page.

**Architecture:** The backend waitlist service and routes already exist. We add an `offerType` field (via two migrations), update `processWaitlist` to branch on session proximity, add email methods to `emailService`, patch the booking route to honour OFFERED status, then wire up the frontend.

**Tech Stack:** Express, Prisma 5, PostgreSQL, React 18, nodemailer

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/prisma/schema.prisma` | Modify | Add `WaitlistOfferType` enum + `offerType` field on `WaitlistEntry` |
| `backend/prisma/migrations/20260323100000_add_waitlist_offer_type_enum/migration.sql` | Create | `CREATE TYPE "WaitlistOfferType"` |
| `backend/prisma/migrations/20260323110000_add_waitlist_offer_type_column/migration.sql` | Create | `ALTER TABLE "waitlist_entries" ADD COLUMN "offerType"` |
| `backend/services/emailService.js` | Modify | Add `sendWaitlistOfferEmail` + `trySendWaitlistOffer` |
| `backend/services/waitlistService.js` | Modify | Update `processWaitlist` — 6hr branch, open offer logic, emails |
| `backend/__tests__/waitlistService.test.js` | Create | Unit tests for `processWaitlist` branching logic |
| `backend/routes/booking/bookings.js` | Modify | Capacity bypass for OFFERED users; post-booking cleanup |
| `backend/__tests__/booking.waitlist-bypass.test.js` | Create | Integration tests for OFFERED booking flow |
| `frontend/src/pages/booking/SessionDetail.js` | Modify | Inline booking flow when `waitlistEntry.status === 'OFFERED'` |
| `frontend/src/pages/booking/MyWaitlist.js` | Create | New page: WAITING + OFFERED entries with actions |
| `frontend/src/pages/booking/MyBookings.js` | Modify | Null-safe `offerExpiresAt`; add WAITING entries section |
| `frontend/src/App.js` | Modify | Add `/booking/my-waitlist` route |
| `frontend/src/components/AppLayout.js` | Modify | Add "My Waitlist" nav link under Booking dropdown |
| `frontend/src/pages/booking/HelpPage.js` | Modify | Add waitlist FAQ section |
| `frontend/src/pages/booking/admin/AdminHelpPage.js` | Modify | Add waitlist admin FAQ section |

---

## Task 1: Schema — add WaitlistOfferType enum and offerType column

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260323100000_add_waitlist_offer_type_enum/migration.sql`
- Create: `backend/prisma/migrations/20260323110000_add_waitlist_offer_type_column/migration.sql`

- [ ] **Step 1: Add enum and field to schema.prisma**

Find the `WaitlistEntry` model and `WaitlistStatus` enum. Add the new enum and field:

```prisma
enum WaitlistOfferType {
  EXCLUSIVE
  OPEN
}

model WaitlistEntry {
  id                String             @id @default(cuid())
  sessionInstanceId String
  userId            String
  status            WaitlistStatus     @default(WAITING)
  offerType         WaitlistOfferType?
  offerExpiresAt    DateTime?
  createdAt         DateTime           @default(now())
  sessionInstance   SessionInstance    @relation(fields: [sessionInstanceId], references: [id])
  user              User               @relation(fields: [userId], references: [id])

  @@unique([sessionInstanceId, userId])
  @@map("waitlist_entries")
}
```

- [ ] **Step 2: Create migration 1 — enum only**

```bash
mkdir -p backend/prisma/migrations/20260323100000_add_waitlist_offer_type_enum
```

File contents of `backend/prisma/migrations/20260323100000_add_waitlist_offer_type_enum/migration.sql`:
```sql
CREATE TYPE "WaitlistOfferType" AS ENUM ('EXCLUSIVE', 'OPEN');
```

- [ ] **Step 3: Create migration 2 — add column**

```bash
mkdir -p backend/prisma/migrations/20260323110000_add_waitlist_offer_type_column
```

File contents of `backend/prisma/migrations/20260323110000_add_waitlist_offer_type_column/migration.sql`:
```sql
ALTER TABLE "waitlist_entries" ADD COLUMN "offerType" "WaitlistOfferType";
```

- [ ] **Step 4: Apply migrations and regenerate client**

```bash
cd backend && npx prisma migrate deploy && npx prisma generate
```

Expected: migrations applied, client regenerated without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add WaitlistOfferType enum and offerType column"
```

---

## Task 2: emailService — waitlist offer emails

**Files:**
- Modify: `backend/services/emailService.js`

- [ ] **Step 1: Add `sendWaitlistOfferEmail` method**

Add before the closing `}` of the `EmailService` class (before `module.exports`):

```javascript
async sendWaitlistOfferEmail(email, firstName, sessionDate, startTime, endTime, offerType, offerExpiresAt) {
  const d = new Date(sessionDate);
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = `${startTime}–${endTime}`;

  const isOpen = offerType === 'OPEN';
  const subject = isOpen
    ? `Last-minute slot — ${dateStr} at ${startTime}`
    : `A slot has opened up — ${dateStr} at ${startTime}`;

  const expiryLine = offerExpiresAt
    ? `<p>It's being held for you until <strong>${new Date(offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>. Open the app to claim it.</p>`
    : `<p>Open the app to claim it — it's first come, first served.</p>`;

  const expiryText = offerExpiresAt
    ? `It's being held for you until ${new Date(offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Open the app to claim it.`
    : `Open the app to claim it — it's first come, first served.`;

  const intro = isOpen
    ? `<p>A spot has come up in your session on <strong>${dateStr} at ${timeStr}</strong>. Since it's close to session time, we've let everyone on the waitlist know.</p>`
    : `<p>A spot has become available in your session on <strong>${dateStr} at ${timeStr}</strong>.</p>`;

  const introText = isOpen
    ? `A spot has come up in your session on ${dateStr} at ${timeStr}. Since it's close to session time, we've let everyone on the waitlist know.`
    : `A spot has become available in your session on ${dateStr} at ${timeStr}.`;

  return this._send({
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject,
    html: brandedHtml(subject, `
      <p style="margin-top:0">Hi ${firstName},</p>
      ${intro}
      ${expiryLine}
      ${ctaButton(`${BASE_URL()}/booking`, 'Open the app')}
      ${muted('You can view your waitlist in My Bookings.')}
    `),
    text: `Hi ${firstName},\n\n${introText}\n\n${expiryText}`,
  }, { to: email, session: `${dateStr} ${timeStr}`, offerType });
}

async trySendWaitlistOffer(userId, sessionDate, startTime, endTime, offerType, offerExpiresAt, prisma) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, club: { select: { emailEnabled: true } } },
    });
    if (!user?.email || !user.club?.emailEnabled) return;
    await this.sendWaitlistOfferEmail(user.email, user.firstName, sessionDate, startTime, endTime, offerType, offerExpiresAt);
  } catch (err) {
    console.error('Waitlist offer email failed:', err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/emailService.js
git commit -m "feat: add waitlist offer email methods to emailService"
```

---

## Task 3: waitlistService — exclusive/open offer split

**Files:**
- Modify: `backend/services/waitlistService.js`

- [ ] **Step 1: Replace `processWaitlist` with the new branching version**

Replace the entire file contents:

```javascript
const { PrismaClient } = require('@prisma/client');
const emailService = require('./emailService');
const prisma = new PrismaClient();

const OFFER_WINDOW_HOURS = 2;
const OPEN_OFFER_THRESHOLD_HOURS = 6;

/**
 * After a cancellation frees a slot, offer it to the next person(s) on the waitlist.
 * >6hrs out: exclusive offer to the next person in queue.
 * ≤6hrs out: open offer to all waiting — first to book gets it.
 */
async function processWaitlist(sessionInstanceId) {
  const instance = await prisma.sessionInstance.findUnique({
    where: { id: sessionInstanceId },
    include: {
      template: { include: { club: true } },
      bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      waitlistEntries: {
        where: { status: 'WAITING' },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!instance || instance.cancelledAt) return;

  const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
  const capacity = instance.openSlotsOverride ?? instance.template.openSlots;

  if (bookedCount >= capacity) return; // still full
  if (instance.waitlistEntries.length === 0) return; // nobody waiting

  // Determine offer type based on session proximity
  const [sh, sm] = instance.template.startTime.split(':').map(Number);
  const sessionStart = new Date(instance.date);
  sessionStart.setHours(sh, sm, 0, 0);
  const hoursUntilSession = (sessionStart - Date.now()) / (1000 * 60 * 60);

  const { startTime, endTime } = instance.template;
  const emailEnabled = instance.template.club?.emailEnabled;

  if (hoursUntilSession > OPEN_OFFER_THRESHOLD_HOURS) {
    // Exclusive offer — next person in queue only
    const next = instance.waitlistEntries[0];
    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 60 * 60 * 1000);

    await prisma.waitlistEntry.update({
      where: { id: next.id },
      data: { status: 'OFFERED', offerType: 'EXCLUSIVE', offerExpiresAt },
    });

    if (emailEnabled) {
      emailService.trySendWaitlistOffer(
        next.userId, instance.date, startTime, endTime, 'EXCLUSIVE', offerExpiresAt, prisma
      );
    }
  } else {
    // Open offer — all waiting entries simultaneously
    const ids = instance.waitlistEntries.map(e => e.id);

    await prisma.waitlistEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: 'OFFERED', offerType: 'OPEN' },
    });

    if (emailEnabled) {
      for (const entry of instance.waitlistEntries) {
        emailService.trySendWaitlistOffer(
          entry.userId, instance.date, startTime, endTime, 'OPEN', null, prisma
        );
      }
    }
  }
}

/**
 * Expire stale exclusive offers and cascade to next in line.
 * Called by cron job every 15 minutes.
 * Open offers (offerExpiresAt = null) are never expired here.
 */
async function expireStaleOffers() {
  const stale = await prisma.waitlistEntry.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lt: new Date() } },
  });

  for (const entry of stale) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'EXPIRED' },
    });
    await processWaitlist(entry.sessionInstanceId);
  }
}

module.exports = { processWaitlist, expireStaleOffers };
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/waitlistService.js
git commit -m "feat: waitlistService — exclusive/open offer split based on 6hr threshold"
```

---

## Task 4: Tests for waitlistService

**Files:**
- Create: `backend/__tests__/waitlistService.test.js`

- [ ] **Step 1: Write tests**

```javascript
/**
 * Tests for waitlistService.processWaitlist
 * Verifies exclusive vs open offer branching based on session proximity.
 */
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createSession,
  createConfirmedBooking,
} = require('./helpers/seed');
const { processWaitlist } = require('../services/waitlistService');

let club, parentA, parentB, parentC, gymnastA, gymnastB;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parentA = await createParent(club);
  parentB = await createParent(club);
  parentC = await createParent(club);
  gymnastA = await createGymnast(club, parentA);
  gymnastB = await createGymnast(club, parentB);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

async function createFullSessionWithWaitlist(hoursFromNow, waitlistUserIds) {
  const sessionDate = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  // Use HH:MM for startTime matching the session date
  const hh = String(sessionDate.getHours()).padStart(2, '0');
  const mm = String(sessionDate.getMinutes()).padStart(2, '0');
  const startTime = `${hh}:${mm}`;

  const session = await createSession(club, sessionDate, { startTime, openSlots: 1 });
  await prisma.sessionInstance.update({
    where: { id: session.instance.id },
    data: { openSlotsOverride: 1 },
  });

  // Fill the session
  const filler = await createParent(club);
  const fillerGymnast = await createGymnast(club, filler);
  await createConfirmedBooking(filler, fillerGymnast, session.instance);

  // Add waitlist entries
  for (const userId of waitlistUserIds) {
    await prisma.waitlistEntry.create({
      data: { sessionInstanceId: session.instance.id, userId, status: 'WAITING' },
    });
  }

  return session.instance;
}

describe('processWaitlist — exclusive offer (>6hrs)', () => {
  it('sets OFFERED on the first WAITING entry only', async () => {
    const instance = await createFullSessionWithWaitlist(10, [parentA.id, parentB.id]);

    // Cancel the booking to free a slot, then call processWaitlist
    await prisma.booking.updateMany({
      where: { sessionInstanceId: instance.id },
      data: { status: 'CANCELLED' },
    });
    await processWaitlist(instance.id);

    const entries = await prisma.waitlistEntry.findMany({
      where: { sessionInstanceId: instance.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(entries[0].status).toBe('OFFERED');
    expect(entries[0].offerType).toBe('EXCLUSIVE');
    expect(entries[0].offerExpiresAt).not.toBeNull();
    expect(entries[1].status).toBe('WAITING');
    expect(entries[1].offerType).toBeNull();
  });
});

describe('processWaitlist — open offer (≤6hrs)', () => {
  it('sets OFFERED on ALL WAITING entries with no expiry', async () => {
    const instance = await createFullSessionWithWaitlist(3, [parentA.id, parentB.id, parentC.id]);

    await prisma.booking.updateMany({
      where: { sessionInstanceId: instance.id },
      data: { status: 'CANCELLED' },
    });
    await processWaitlist(instance.id);

    const entries = await prisma.waitlistEntry.findMany({
      where: { sessionInstanceId: instance.id },
    });

    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.status).toBe('OFFERED');
      expect(entry.offerType).toBe('OPEN');
      expect(entry.offerExpiresAt).toBeNull();
    }
  });
});

describe('processWaitlist — no action cases', () => {
  it('does nothing when session is still full', async () => {
    const session = await createSession(club);
    await prisma.sessionInstance.update({
      where: { id: session.instance.id },
      data: { openSlotsOverride: 1 },
    });
    const filler = await createParent(club);
    const fillerG = await createGymnast(club, filler);
    await createConfirmedBooking(filler, fillerG, session.instance);
    await prisma.waitlistEntry.create({
      data: { sessionInstanceId: session.instance.id, userId: parentA.id, status: 'WAITING' },
    });

    await processWaitlist(session.instance.id);

    const entry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: session.instance.id, userId: parentA.id },
    });
    expect(entry.status).toBe('WAITING');
  });

  it('does nothing when nobody is waiting', async () => {
    const session = await createSession(club);
    // No waitlist entries — should not throw
    await expect(processWaitlist(session.instance.id)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd backend && npx jest __tests__/waitlistService.test.js --forceExit
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/waitlistService.test.js
git commit -m "test: waitlistService exclusive/open offer branching"
```

---

## Task 5: bookings.js — capacity bypass for OFFERED users

**Files:**
- Modify: `backend/routes/booking/bookings.js`

- [ ] **Step 1: Add waitlistService require at the top of bookings.js**

`bookings.js` already imports `processWaitlist` from `waitlistService` at line 6. Confirm it's there — if not, add:

```javascript
const { processWaitlist } = require('../../services/waitlistService');
```

- [ ] **Step 2: Add OFFERED bypass before the capacity check**

In `POST /api/booking/bookings` (the `router.post('/', ...)` handler), find this block (around line 120):

```javascript
    // Check availability
    const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
    const activeCommitments = await prisma.commitment.count({
      where: { templateId: instance.templateId, status: 'ACTIVE' },
    });
    const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
    if (bookedCount + activeCommitments + gymnastIds.length > capacity) {
      return res.status(400).json({ error: 'Not enough slots available' });
    }
```

Replace with:

```javascript
    // Check availability — bypass if user has an active OFFERED waitlist entry
    const offeredEntry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId, userId: req.user.id, status: 'OFFERED' },
    });

    if (!offeredEntry) {
      const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
      const activeCommitments = await prisma.commitment.count({
        where: { templateId: instance.templateId, status: 'ACTIVE' },
      });
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      if (bookedCount + activeCommitments + gymnastIds.length > capacity) {
        return res.status(400).json({ error: 'Not enough slots available' });
      }
    }
```

- [ ] **Step 2: Add post-booking waitlist cleanup**

After the booking is successfully created and before the `emailService.trySendBookingReceipt` call, find the successful booking creation section. Add cleanup for the offered waitlist entry:

After the booking is confirmed/created, find the line `emailService.trySendBookingReceipt(...)` (around line 315) and add before it:

```javascript
    // If user had an OFFERED waitlist entry, mark it CLAIMED and expire others
    if (offeredEntry) {
      await prisma.waitlistEntry.update({
        where: { id: offeredEntry.id },
        data: { status: 'CLAIMED' },
      });
      // Expire any other OFFERED entries for this session (open offer case)
      await prisma.waitlistEntry.updateMany({
        where: {
          sessionInstanceId,
          status: 'OFFERED',
          id: { not: offeredEntry.id },
        },
        data: { status: 'EXPIRED' },
      });
      // Cascade to next WAITING person if any
      processWaitlist(sessionInstanceId).catch(err => console.error('Waitlist cascade failed:', err));
    }

- [ ] **Step 3: Commit**

```bash
git add backend/routes/booking/bookings.js
git commit -m "feat: honour OFFERED waitlist status in booking capacity check"
```

---

## Task 6: Integration tests for OFFERED booking flow

**Files:**
- Create: `backend/__tests__/booking.waitlist-bypass.test.js`

- [ ] **Step 1: Write tests**

```javascript
/**
 * Tests for booking route OFFERED waitlist bypass.
 */
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createSession,
  createConfirmedBooking,
  tokenFor,
} = require('./helpers/seed');

const app = createTestApp();

let club, parent, gymnast, otherParent, otherGymnast, fullSession;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  otherParent = await createParent(club);
  otherGymnast = await createGymnast(club, otherParent);

  // Full session: capacity 1
  fullSession = await createSession(club);
  await prisma.sessionInstance.update({
    where: { id: fullSession.instance.id },
    data: { openSlotsOverride: 1 },
  });
  await createConfirmedBooking(otherParent, otherGymnast, fullSession.instance);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/bookings — OFFERED waitlist bypass', () => {
  it('blocks booking a full session with no waitlist offer', async () => {
    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: fullSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough slots/i);
  });

  it('allows booking when user has an OFFERED waitlist entry', async () => {
    // Give parent an OFFERED entry
    await prisma.waitlistEntry.upsert({
      where: { sessionInstanceId_userId: { sessionInstanceId: fullSession.instance.id, userId: parent.id } },
      create: { sessionInstanceId: fullSession.instance.id, userId: parent.id, status: 'OFFERED', offerType: 'EXCLUSIVE' },
      update: { status: 'OFFERED', offerType: 'EXCLUSIVE' },
    });

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: fullSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(200);

    // Waitlist entry should be CLAIMED
    const entry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: fullSession.instance.id, userId: parent.id },
    });
    expect(entry.status).toBe('CLAIMED');
  });

  it('expires other OFFERED entries after a successful booking (open offer case)', async () => {
    // Set up two parents with OFFERED entries on the same session
    const thirdParent = await createParent(club);
    const thirdGymnast = await createGymnast(club, thirdParent);
    const session = await createSession(club);
    await prisma.sessionInstance.update({
      where: { id: session.instance.id },
      data: { openSlotsOverride: 1 },
    });
    await createConfirmedBooking(otherParent, otherGymnast, session.instance);

    await prisma.waitlistEntry.createMany({
      data: [
        { sessionInstanceId: session.instance.id, userId: parent.id, status: 'OFFERED', offerType: 'OPEN' },
        { sessionInstanceId: session.instance.id, userId: thirdParent.id, status: 'OFFERED', offerType: 'OPEN' },
      ],
    });

    // parent books — thirdParent's entry should be expired
    await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: session.instance.id, gymnastIds: [gymnast.id] });

    const thirdEntry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: session.instance.id, userId: thirdParent.id },
    });
    expect(thirdEntry.status).toBe('EXPIRED');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd backend && npx jest __tests__/booking.waitlist-bypass.test.js --forceExit
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/booking.waitlist-bypass.test.js
git commit -m "test: OFFERED waitlist bypass in booking route"
```

---

## Task 7: SessionDetail — inline booking for OFFERED state

**Files:**
- Modify: `frontend/src/pages/booking/SessionDetail.js`

The component already has `waitlistEntry` state and a `handleBook` function. The OFFERED section (inside `{!session.cancelledAt && session.availableSlots === 0 && ...}`) currently shows a message with no book button. Replace just the `OFFERED` branch:

- [ ] **Step 1: Replace the OFFERED JSX block**

Find this block (around line 212):
```jsx
          {waitlistEntry?.status === 'OFFERED' ? (
            <>
              <p className="session-detail__waitlist-offered">
                A slot is available for you! Claim it before{' '}
                {new Date(waitlistEntry.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
                Go back to the calendar and book this session to claim your slot.
              </p>
            </>
```

Replace with:
```jsx
          {waitlistEntry?.status === 'OFFERED' ? (
            <>
              <p className="session-detail__waitlist-offered">
                {waitlistEntry.offerType === 'OPEN'
                  ? "A slot has come up close to session time — we've let everyone on the waitlist know. First to book gets it."
                  : `A slot has been held for you until ${new Date(waitlistEntry.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`
                }
              </p>
```

Then find and **remove** this stale paragraph that appears just after (if present):
```jsx
              <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>
                Go back to the calendar and book this session to claim your slot.
              </p>
```

- [ ] **Step 2: Show gymnast selector and Book Now button for OFFERED users**

The normal booking section (`{!session.cancelledAt && session.availableSlots > 0 && ...}`) shows the gymnast selector and book button. We need the same to appear for OFFERED users.

Find the outer condition:
```jsx
      {!session.cancelledAt && session.availableSlots > 0 && (
```

Change it to:
```jsx
      {!session.cancelledAt && (session.availableSlots > 0 || waitlistEntry?.status === 'OFFERED') && (
```

This makes the gymnast selector and Book Now button appear for OFFERED users even when `availableSlots === 0`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: inline booking flow for OFFERED waitlist state in SessionDetail"
```

---

## Task 8: MyWaitlist page, route, and nav link

**Files:**
- Create: `frontend/src/pages/booking/MyWaitlist.js`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/AppLayout.js`

- [ ] **Step 1: Create MyWaitlist.js**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

export default function MyWaitlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    bookingApi.getMyWaitlist()
      .then(res => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleLeave = async (instanceId) => {
    if (!window.confirm('Leave this waitlist?')) return;
    setBusy(instanceId);
    try {
      await bookingApi.leaveWaitlist(instanceId);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="bk-center">Loading...</p>;

  return (
    <div className="bk-page bk-page--md">
      <h2>My Waitlist</h2>

      {entries.length === 0 && (
        <p className="bk-muted">You're not on any waitlists.</p>
      )}

      {entries.map(e => {
        const d = new Date(e.sessionInstance.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = `${e.sessionInstance.template.startTime}–${e.sessionInstance.template.endTime}`;
        const isOffered = e.status === 'OFFERED';

        return (
          <div
            key={e.id}
            className="bk-card"
            style={isOffered ? { borderColor: 'var(--booking-accent)', borderWidth: 2 } : undefined}
          >
            <strong>{dateStr} — {timeStr}</strong>

            {isOffered ? (
              <>
                <p style={{ color: 'var(--booking-accent)', fontWeight: 700, margin: '0.25rem 0' }}>
                  A slot is available!
                  {e.offerExpiresAt && (
                    <> Claim it before {new Date(e.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</>
                  )}
                </p>
                <button
                  className="bk-btn bk-btn--primary bk-btn--sm"
                  onClick={() => navigate(`/booking/session/${e.sessionInstanceId}`)}
                >
                  Book now
                </button>
              </>
            ) : (
              <>
                <p className="bk-muted" style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                  You're on the waitlist.
                </p>
                <button
                  className="bk-btn bk-btn--secondary bk-btn--sm"
                  onClick={() => handleLeave(e.sessionInstanceId)}
                  disabled={busy === e.sessionInstanceId}
                >
                  {busy === e.sessionInstanceId ? 'Leaving...' : 'Leave waitlist'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.js**

Find the line:
```jsx
            <Route path="my-bookings" element={<MyBookings />} />
```

Add the import at the top of App.js with the other booking imports:
```jsx
import MyWaitlist from './pages/booking/MyWaitlist';
```

Add the route after `my-bookings`:
```jsx
            <Route path="my-waitlist" element={<MyWaitlist />} />
```

- [ ] **Step 3: Add nav link to AppLayout.js (desktop and mobile)**

`AppLayout.js` has two nav blocks — desktop dropdown and mobile nav. Add "My Waitlist" to both.

Desktop — find:
```jsx
                  <NavLink to="/booking/my-bookings" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Bookings</NavLink>
```
Add after it:
```jsx
                  <NavLink to="/booking/my-waitlist" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>My Waitlist</NavLink>
```

Mobile — find the equivalent mobile `my-bookings` NavLink and add the same entry after it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/MyWaitlist.js frontend/src/App.js frontend/src/components/AppLayout.js
git commit -m "feat: My Waitlist page with WAITING/OFFERED entries and nav link"
```

---

## Task 9: MyBookings — null-safe offerExpiresAt

**Files:**
- Modify: `frontend/src/pages/booking/MyBookings.js`

The existing OFFERED display assumes `offerExpiresAt` is always set. Open offers have `null`. Fix the expiry line:

- [ ] **Step 1: Update the OFFERED section in MyBookings**

Find:
```jsx
            <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Offer expires at {new Date(e.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
```

Replace with:
```jsx
            {e.offerExpiresAt && (
              <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Offer expires at {new Date(e.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/booking/MyBookings.js
git commit -m "fix: null-safe offerExpiresAt for open waitlist offers in MyBookings"
```

---

## Task 10: Help pages

**Files:**
- Modify: `frontend/src/pages/booking/HelpPage.js`
- Modify: `frontend/src/pages/booking/admin/AdminHelpPage.js`

- [ ] **Step 1: Add waitlist section to HelpPage.js**

Read the file first to find the right place to insert (after the existing booking section). Add a new `<section>`:

```jsx
      <section style={{ marginBottom: '2rem' }}>
        <h3>Waitlist</h3>
        <p>If a session is full, you can join the waitlist. You'll be notified by email if a slot becomes available.</p>
        <p><strong>More than 6 hours before the session:</strong> slots are offered exclusively to the next person in the queue. You'll have 2 hours to claim it before it moves to the next person.</p>
        <p><strong>Within 6 hours of the session:</strong> any available slot is offered to everyone on the waitlist at the same time — first to book gets it.</p>
        <p>You can view and manage your waitlist entries under <strong>My Waitlist</strong> in the Booking menu.</p>
      </section>
```

- [ ] **Step 2: Add waitlist section to AdminHelpPage.js**

Read the file first. Add a new section:

```jsx
      <section style={{ marginBottom: '2rem' }}>
        <h3>Waitlist</h3>
        <p>When a booking is cancelled and the session is full, the system automatically offers the freed slot to the next person on the waitlist.</p>
        <p><strong>Exclusive offer (&gt;6hrs out):</strong> offered to the next person in queue only, with a 2-hour claim window. If they don't claim it, it cascades to the next person.</p>
        <p><strong>Open offer (≤6hrs out):</strong> offered to all waiting members simultaneously via email. First to book gets it.</p>
        <p>Members can view and leave their waitlist entries under My Waitlist. Waitlist status is visible on the session register.</p>
      </section>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/HelpPage.js frontend/src/pages/booking/admin/AdminHelpPage.js
git commit -m "docs: add waitlist FAQ to member and admin help pages"
```

---

## Task 11: Push

- [ ] **Push all commits**

```bash
git push
```
