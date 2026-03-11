# Messaging & Member Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build bulk email campaigns with targeting and scheduling, automated notification crons, and a member lifecycle system that warns and deletes inactive members with a summary record.

**Architecture:** New `Message` / `MessageRecipient` / `ArchivedMemberSummary` Prisma models. A `recipientResolver` service turns filter JSON into user arrays. A `messageSender` service does the actual send loop. Cron jobs handle scheduled campaigns, inactivity, session reminders, and membership payment reminders. Frontend gets an AdminMessages page and an AdminRemovedMembers page. Club settings gains three automation toggles.

**Tech Stack:** Node/Express, Prisma 5, node-cron, existing emailService (Gmail SMTP), React 18

---

## Key files to understand first

- `backend/prisma/schema.prisma` — all models live here
- `backend/server.js` — cron jobs registered here; routes mounted here
- `backend/services/emailService.js` — `emailService.sendEmail({ to, subject, html })` sends one email; respects `emailEnabled` on club
- `backend/routes/booking/memberships.js` — example of a well-structured route file
- `frontend/src/utils/bookingApi.js` — all API calls go through here; use `getHeaders()` for auth
- `frontend/src/pages/booking/admin/AdminMembers.js` — reference for admin page structure and styling (bk- CSS classes)
- `frontend/src/App.js` — frontend routes registered here

---

## Task 1: Schema — new models and Club automation fields

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260310000002_add_messaging/migration.sql`

**Step 1: Add enums and models to schema.prisma**

Add these enums after the existing enums at the bottom of the file:

```prisma
enum MessageStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  FAILED
}

enum MessageRecipientStatus {
  PENDING
  SENT
  FAILED
}

enum DeletionReason {
  INACTIVITY
  MANUAL
}
```

Add these models before the closing of the file:

```prisma
model Message {
  id              String             @id @default(cuid())
  clubId          String
  authorId        String
  subject         String
  htmlBody        String
  status          MessageStatus      @default(DRAFT)
  scheduledAt     DateTime?
  sentAt          DateTime?
  recipientFilter Json
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  club            Club               @relation(fields: [clubId], references: [id])
  author          User               @relation(fields: [authorId], references: [id])
  recipients      MessageRecipient[]

  @@map("messages")
}

model MessageRecipient {
  id        String                 @id @default(cuid())
  messageId String
  userId    String
  email     String
  status    MessageRecipientStatus @default(PENDING)
  error     String?
  sentAt    DateTime?
  message   Message                @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@map("message_recipients")
}

model ArchivedMemberSummary {
  id               String         @id @default(cuid())
  clubId           String
  firstName        String
  lastName         String
  totalAmountPaid  Int
  sessionsAttended Int
  membershipCount  Int
  deletionReason   DeletionReason
  deletedBy        String?
  deletedAt        DateTime       @default(now())
  club             Club           @relation(fields: [clubId], references: [id])

  @@map("archived_member_summaries")
}
```

Add to the `Club` model (after `emailEnabled Boolean @default(false)`):

```prisma
  sessionReminderEnabled    Boolean @default(true)
  membershipReminderEnabled Boolean @default(true)
  inactivityWarningEnabled  Boolean @default(true)
  messages                  Message[]
  archivedMemberSummaries   ArchivedMemberSummary[]
```

Add to the `User` model (after `auditLogs AuditLog[]`):

```prisma
  authoredMessages  Message[]
```

**Step 2: Create the migration file**

Create `backend/prisma/migrations/20260310000002_add_messaging/migration.sql`:

```sql
-- New enums
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "MessageRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "DeletionReason" AS ENUM ('INACTIVITY', 'MANUAL');

-- Club automation flags
ALTER TABLE "clubs" ADD COLUMN "sessionReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clubs" ADD COLUMN "membershipReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "clubs" ADD COLUMN "inactivityWarningEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Messages
CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "recipientFilter" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Message recipients
CREATE TABLE "message_recipients" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "MessageRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "message_recipients_pkey" PRIMARY KEY ("id")
);

-- Archived member summaries
CREATE TABLE "archived_member_summaries" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "totalAmountPaid" INTEGER NOT NULL,
  "sessionsAttended" INTEGER NOT NULL,
  "membershipCount" INTEGER NOT NULL,
  "deletionReason" "DeletionReason" NOT NULL,
  "deletedBy" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "archived_member_summaries_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "messages" ADD CONSTRAINT "messages_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "archived_member_summaries" ADD CONSTRAINT "archived_member_summaries_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Step 3: Regenerate Prisma client**

```bash
cd backend && npx prisma generate
```

Expected: `✔ Generated Prisma Client`

**Step 4: Apply migration to test DB**

```bash
DATABASE_URL="postgresql://james@localhost:5432/trampoline_test" npx prisma migrate deploy
```

**Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260310000002_add_messaging/
git commit -m "feat: add Message, MessageRecipient, ArchivedMemberSummary schema"
```

---

## Task 2: Recipient resolver service

**Files:**
- Create: `backend/services/recipientResolver.js`

This service takes a `recipientFilter` JSON and a `clubId`, and returns an array of `{ id, email, firstName }` user objects. It is used both for previewing recipients and for resolving them at send time.

**Step 1: Create the service**

```js
// backend/services/recipientResolver.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Resolve a recipientFilter JSON into an array of { id, email, firstName } objects.
 * Only returns users with a non-null email.
 *
 * Filter shapes:
 *   { type: 'all' }
 *   { type: 'role', role: 'PARENT' | 'COACH' }
 *   { type: 'session', instanceId: string }
 *   { type: 'active_membership' }
 *   { type: 'expiring_credits', withinDays: number }
 *   { type: 'no_upcoming_bookings', withinDays: number }
 *   { type: 'adhoc', userIds: string[] }
 *   { operator: 'AND' | 'OR', filters: Filter[] }
 */
async function resolveRecipients(filter, clubId) {
  const users = await _resolve(filter, clubId);
  // Deduplicate by id, ensure email present
  const seen = new Set();
  return users.filter(u => {
    if (!u.email || seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

async function _resolve(filter, clubId) {
  const now = new Date();

  if (filter.operator === 'AND' || filter.operator === 'OR') {
    const sets = await Promise.all(filter.filters.map(f => _resolve(f, clubId)));
    if (filter.operator === 'AND') {
      // Intersection: users present in all sets
      const idSets = sets.map(s => new Set(s.map(u => u.id)));
      return sets[0].filter(u => idSets.every(s => s.has(u.id)));
    } else {
      // Union
      const all = sets.flat();
      const seen = new Set();
      return all.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    }
  }

  const baseWhere = { clubId, isArchived: false, email: { not: null } };

  switch (filter.type) {
    case 'all':
      return prisma.user.findMany({ where: baseWhere, select: { id: true, email: true, firstName: true } });

    case 'role':
      return prisma.user.findMany({
        where: { ...baseWhere, role: filter.role },
        select: { id: true, email: true, firstName: true },
      });

    case 'session': {
      const bookings = await prisma.booking.findMany({
        where: { sessionInstanceId: filter.instanceId, status: 'CONFIRMED' },
        select: { user: { select: { id: true, email: true, firstName: true, clubId: true, isArchived: true } } },
      });
      return bookings
        .map(b => b.user)
        .filter(u => u.clubId === clubId && !u.isArchived && u.email);
    }

    case 'active_membership': {
      const memberships = await prisma.membership.findMany({
        where: { clubId, status: { in: ['ACTIVE', 'SCHEDULED'] } },
        include: { gymnast: { include: { guardians: { where: { isArchived: false }, select: { id: true, email: true, firstName: true } } } } },
      });
      const users = memberships.flatMap(m => m.gymnast.guardians);
      const seen = new Set();
      return users.filter(u => { if (!u.email || seen.has(u.id)) return false; seen.add(u.id); return true; });
    }

    case 'expiring_credits': {
      const cutoff = new Date(now.getTime() + (filter.withinDays || 30) * 24 * 60 * 60 * 1000);
      const credits = await prisma.credit.findMany({
        where: {
          usedAt: null,
          expiresAt: { lte: cutoff, gt: now },
          user: { clubId, isArchived: false },
        },
        select: { user: { select: { id: true, email: true, firstName: true } } },
      });
      const users = credits.map(c => c.user).filter(u => u.email);
      const seen = new Set();
      return users.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    }

    case 'no_upcoming_bookings': {
      const cutoff = new Date(now.getTime() + (filter.withinDays || 30) * 24 * 60 * 60 * 1000);
      const usersWithBookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          sessionInstance: { date: { gte: now, lte: cutoff } },
          user: { clubId, isArchived: false },
        },
        select: { userId: true },
      });
      const bookedIds = new Set(usersWithBookings.map(b => b.userId));
      const allUsers = await prisma.user.findMany({
        where: baseWhere,
        select: { id: true, email: true, firstName: true },
      });
      return allUsers.filter(u => !bookedIds.has(u.id));
    }

    case 'adhoc':
      return prisma.user.findMany({
        where: { id: { in: filter.userIds || [] }, clubId, isArchived: false, email: { not: null } },
        select: { id: true, email: true, firstName: true },
      });

    default:
      return [];
  }
}

module.exports = { resolveRecipients };
```

**Step 2: Commit**

```bash
git add backend/services/recipientResolver.js
git commit -m "feat: add recipient resolver service"
```

---

## Task 3: Message sending service

**Files:**
- Create: `backend/services/messageSender.js`

This service takes a `messageId`, resolves recipients, sends emails via `emailService`, and records per-recipient status. Used by both the API (immediate send) and the cron (scheduled send).

**Step 1: Create the service**

```js
// backend/services/messageSender.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailService = require('./emailService');
const { resolveRecipients } = require('./recipientResolver');

async function sendMessage(messageId) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { club: true },
  });
  if (!message) throw new Error(`Message ${messageId} not found`);
  if (!message.club.emailEnabled) {
    await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED', sentAt: new Date() } });
    return { sent: 0, failed: 0, skipped: 'email disabled' };
  }

  // Mark as SENDING
  await prisma.message.update({ where: { id: messageId }, data: { status: 'SENDING' } });

  // Resolve recipients
  const users = await resolveRecipients(message.recipientFilter, message.clubId);

  // Create recipient rows
  await prisma.messageRecipient.createMany({
    data: users.map(u => ({ messageId, userId: u.id, email: u.email, status: 'PENDING' })),
    skipDuplicates: true,
  });

  let sent = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await emailService.sendEmail({
        to: u.email,
        subject: message.subject,
        html: message.htmlBody,
      });
      await prisma.messageRecipient.updateMany({
        where: { messageId, userId: u.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      await prisma.messageRecipient.updateMany({
        where: { messageId, userId: u.id },
        data: { status: 'FAILED', error: err.message },
      });
      failed++;
    }
  }

  const finalStatus = sent === 0 && failed > 0 ? 'FAILED' : 'SENT';
  await prisma.message.update({
    where: { id: messageId },
    data: { status: finalStatus, sentAt: new Date() },
  });

  return { sent, failed };
}

module.exports = { sendMessage };
```

**Step 2: Commit**

```bash
git add backend/services/messageSender.js
git commit -m "feat: add message sender service"
```

---

## Task 4: Messages API route

**Files:**
- Create: `backend/routes/messages.js`
- Modify: `backend/server.js`

**Step 1: Create the route**

```js
// backend/routes/messages.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { auth, requireRole } = require('../middleware/auth');
const { resolveRecipients } = require('../services/recipientResolver');
const { sendMessage } = require('../services/messageSender');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

// GET /api/messages — list all campaigns for the club
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { clubId: req.user.clubId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = messages.map(m => ({
      id: m.id,
      subject: m.subject,
      status: m.status,
      scheduledAt: m.scheduledAt,
      sentAt: m.sentAt,
      author: m.author,
      recipientCount: m._count.recipients,
      createdAt: m.createdAt,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/:id — get campaign detail with recipient stats
router.get('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { firstName: true, lastName: true } },
        recipients: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/preview-recipients — resolve filter without saving
router.post('/preview-recipients', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { recipientFilter } = req.body;
    if (!recipientFilter) return res.status(400).json({ error: 'recipientFilter required' });
    const users = await resolveRecipients(recipientFilter, req.user.clubId);
    res.json({ count: users.length, users: users.map(u => ({ id: u.id, firstName: u.firstName, email: u.email })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const messageSchema = Joi.object({
  subject: Joi.string().min(1).max(200).required(),
  htmlBody: Joi.string().min(1).required(),
  recipientFilter: Joi.object().required(),
  scheduledAt: Joi.date().iso().optional().allow(null),
});

// POST /api/messages — create draft or schedule
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const status = value.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    const message = await prisma.message.create({
      data: {
        clubId: req.user.clubId,
        authorId: req.user.id,
        subject: value.subject,
        htmlBody: value.htmlBody,
        recipientFilter: value.recipientFilter,
        status,
        scheduledAt: value.scheduledAt || null,
      },
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/messages/:id — update draft or reschedule
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Cannot edit a message that has been sent' });
    }

    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const status = value.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: { ...value, status },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:id/send — send immediately
router.post('/:id/send', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Message has already been sent' });
    }

    const result = await sendMessage(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/messages/:id — delete draft only
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Cannot delete a sent message' });
    }
    await prisma.message.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/archived-members — view ArchivedMemberSummary records
router.get('/archived-members', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const summaries = await prisma.archivedMemberSummary.findMany({
      where: { clubId: req.user.clubId },
      orderBy: { deletedAt: 'desc' },
    });
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Step 2: Mount in server.js**

After the existing route mounts (around line 159), add:

```js
const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);
```

**Step 3: Commit**

```bash
git add backend/routes/messages.js backend/server.js
git commit -m "feat: add messages API route"
```

---

## Task 5: Member lifecycle service

**Files:**
- Create: `backend/services/memberLifecycle.js`

This service handles the full deletion flow: compute summary, save ArchivedMemberSummary if user has history, then hard-delete the user. Used by both the inactivity cron and manual deletion from the admin UI.

**Step 1: Create the service**

```js
// backend/services/memberLifecycle.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Delete a member, saving an ArchivedMemberSummary if they have booking/membership history.
 *
 * @param {string} userId
 * @param {'INACTIVITY'|'MANUAL'} reason
 * @param {string|null} deletedBy  userId of acting admin, or null for cron
 */
async function deleteMember(userId, reason, deletedBy = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      bookings: {
        where: { status: 'CONFIRMED' },
        include: { sessionInstance: true },
      },
      guardedGymnasts: {
        include: { memberships: true },
      },
    },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const confirmedBookings = user.bookings;
  const hasHistory = confirmedBookings.length > 0 || user.guardedGymnasts.some(g => g.memberships.length > 0);

  if (hasHistory) {
    const now = new Date();
    const sessionsAttended = confirmedBookings.filter(b => new Date(b.sessionInstance.date) <= now).length;
    const totalAmountPaid = confirmedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const membershipCount = user.guardedGymnasts.reduce((sum, g) => sum + g.memberships.length, 0);

    await prisma.archivedMemberSummary.create({
      data: {
        clubId: user.clubId,
        firstName: user.firstName,
        lastName: user.lastName,
        totalAmountPaid,
        sessionsAttended,
        membershipCount,
        deletionReason: reason,
        deletedBy,
      },
    });
  }

  // Delete in FK dependency order
  await prisma.waitlistEntry.deleteMany({ where: { userId } });
  await prisma.bookingLine.deleteMany({ where: { booking: { userId } } });
  await prisma.credit.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  return { hadHistory: hasHistory };
}

module.exports = { deleteMember };
```

**Step 2: Commit**

```bash
git add backend/services/memberLifecycle.js
git commit -m "feat: add member lifecycle service with summary snapshot"
```

---

## Task 6: Cron jobs

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/services/emailService.js`

### 6a: Scheduled message processor (every minute)

Add to the cron section of `server.js`:

```js
const { sendMessage } = require('./services/messageSender');

// Send scheduled messages — runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const due = await prisma.message.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const m of due) {
      await sendMessage(m.id).catch(err => console.error(`Failed to send message ${m.id}:`, err));
    }
  } catch (err) {
    console.error('Scheduled message cron error:', err);
  }
});
```

### 6b: Session reminder (daily at 08:00)

Add to `emailService.js` — new method before the closing `module.exports`:

```js
async sendSessionReminderEmail(email, firstName, sessionDate, startTime, endTime, availableSlots) {
  const dateStr = new Date(sessionDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return this._send({
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject: `Spaces still available — ${dateStr}`,
    html: `<p>Hi ${firstName},</p>
           <p>There are still <strong>${availableSlots} spaces</strong> available for tomorrow's session on <strong>${dateStr}</strong> (${startTime}–${endTime}).</p>
           <p><a href="${process.env.FRONTEND_URL || 'https://booking.trampoline.life'}/booking">Book now</a></p>`,
  }, { to: email, subject: `Session reminder — ${dateStr}` });
}
```

Add to `server.js`:

```js
// Session reminder — runs daily at 08:00
cron.schedule('0 8 * * *', async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const instances = await prisma.sessionInstance.findMany({
      where: {
        date: { gte: tomorrow, lt: dayAfter },
        cancelledAt: null,
        template: { is: { club: { is: { emailEnabled: true, sessionReminderEnabled: true } } } },
      },
      include: {
        template: { include: { club: true } },
        bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      },
    });

    for (const instance of instances) {
      const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      const availableSlots = Math.max(0, capacity - bookedCount);
      if (availableSlots === 0) continue;

      const members = await prisma.user.findMany({
        where: { clubId: instance.template.clubId, isArchived: false, email: { not: null } },
        select: { email: true, firstName: true },
      });

      for (const member of members) {
        await emailService.sendSessionReminderEmail(
          member.email, member.firstName, instance.date,
          instance.template.startTime, instance.template.endTime, availableSlots
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Session reminder cron error:', err);
  }
});
```

### 6c: Membership payment reminder (daily at 09:00)

Add to `emailService.js`:

```js
async sendMembershipPaymentReminderEmail(email, firstName, gymnast, amountPence, renewalDate) {
  const dateStr = new Date(renewalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  return this._send({
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject: `Membership payment reminder — ${gymnast.firstName}`,
    html: `<p>Hi ${firstName},</p>
           <p>A membership payment of <strong>${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong> will be taken on <strong>${dateStr}</strong>.</p>
           <p>If you have any questions, please contact the club.</p>`,
  }, { to: email, subject: `Membership payment reminder — ${gymnast.firstName}` });
}
```

Add to `server.js`:

```js
// Membership payment reminder — runs daily at 09:00
cron.schedule('0 9 * * *', async () => {
  try {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    in3Days.setHours(23, 59, 59, 999);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(0, 0, 0, 0);

    // Find memberships whose Stripe subscription renews in ~3 days
    // We use startDate as a proxy: day-of-month anchor, next occurrence in 3 days
    const memberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        club: { emailEnabled: true, membershipReminderEnabled: true },
      },
      include: {
        gymnast: { include: { guardians: { select: { id: true, email: true, firstName: true } } } },
        club: true,
      },
    });

    for (const m of memberships) {
      // Check if billing day matches 3 days from now
      const billingDay = new Date(m.startDate).getDate();
      if (in3Days.getDate() !== billingDay) continue;

      for (const guardian of m.gymnast.guardians) {
        if (!guardian.email) continue;
        await emailService.sendMembershipPaymentReminderEmail(
          guardian.email, guardian.firstName, m.gymnast, m.monthlyAmount, in3Days
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Membership reminder cron error:', err);
  }
});
```

### 6d: Inactivity warning and deletion (daily at 02:30)

Add to `emailService.js`:

```js
async sendInactivityWarningEmail(email, firstName) {
  return this._send({
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject: 'Your Trampoline Life account will be deleted in one week',
    html: `<p>Hi ${firstName},</p>
           <p>Your account has been inactive for nearly 6 months. If we don't hear from you, your account will be <strong>permanently deleted in one week</strong>.</p>
           <p>To keep your account, simply <a href="${process.env.FRONTEND_URL || 'https://booking.trampoline.life'}/login">log in</a>.</p>`,
  }, { to: email, subject: 'Account deletion warning' });
}
```

Add to `server.js`:

```js
const { deleteMember } = require('./services/memberLifecycle');

// Inactivity warning + deletion — runs daily at 02:30
cron.schedule('30 2 * * *', async () => {
  try {
    const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
    const WARNING_MS = SIX_MONTHS_MS - 7 * 24 * 60 * 60 * 1000; // 5 months 3 weeks
    const now = new Date();

    const allUsers = await prisma.user.findMany({
      where: {
        isArchived: false,
        role: { notIn: ['CLUB_ADMIN', 'SUPER_ADMIN'] },
        club: { emailEnabled: true, inactivityWarningEnabled: true },
      },
      select: { id: true, email: true, firstName: true, lastLoginAt: true, createdAt: true, bookings: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    for (const user of allUsers) {
      const lastActivity = user.lastLoginAt
        || (user.bookings[0]?.createdAt)
        || user.createdAt;

      const idleMs = now - new Date(lastActivity);

      if (idleMs >= SIX_MONTHS_MS) {
        await deleteMember(user.id, 'INACTIVITY', null).catch(err =>
          console.error(`Failed to delete inactive user ${user.id}:`, err)
        );
      } else if (idleMs >= WARNING_MS && user.email) {
        await emailService.sendInactivityWarningEmail(user.email, user.firstName).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Inactivity cron error:', err);
  }
});
```

**Step: Commit**

```bash
git add backend/server.js backend/services/emailService.js
git commit -m "feat: add scheduled message, session reminder, membership reminder, inactivity crons"
```

---

## Task 7: Manual member deletion endpoint

**Files:**
- Modify: `backend/routes/booking/admin.js`

The existing admin route already has `DELETE /members/:userId`. Replace its implementation to use `deleteMember`:

Find the existing `router.delete('/members/:userId', ...)` handler and replace its body:

```js
router.delete('/members/:userId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { deleteMember } = require('../../services/memberLifecycle');
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user || user.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (['CLUB_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(400).json({ error: 'Cannot delete admin accounts' });
    }
    await deleteMember(user.id, 'MANUAL', req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

**Commit:**

```bash
git add backend/routes/booking/admin.js
git commit -m "feat: wire manual member deletion through memberLifecycle service"
```

---

## Task 8: Club settings — automation toggles

**Files:**
- Modify: `backend/routes/clubs.js` (PATCH /api/clubs/:id)
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js` (or wherever club settings are shown — search for `emailEnabled`)

**Step 1: Find the PATCH handler for clubs**

```bash
grep -n "emailEnabled\|PATCH\|patch" backend/routes/clubs.js | head -20
```

**Step 2: Add the three new fields to the allowed update fields**

Find where `emailEnabled` is handled in the PATCH body and add alongside it:

```js
if (req.body.sessionReminderEnabled !== undefined) data.sessionReminderEnabled = !!req.body.sessionReminderEnabled;
if (req.body.membershipReminderEnabled !== undefined) data.membershipReminderEnabled = !!req.body.membershipReminderEnabled;
if (req.body.inactivityWarningEnabled !== undefined) data.inactivityWarningEnabled = !!req.body.inactivityWarningEnabled;
```

**Step 3: Find where emailEnabled toggle is rendered in the frontend**

```bash
grep -rn "emailEnabled" frontend/src --include="*.js" -l
```

Open that file and add three toggle rows alongside the `emailEnabled` toggle, using the same pattern:

```jsx
<label>
  <input type="checkbox" checked={settings.sessionReminderEnabled ?? true}
    onChange={e => updateSetting('sessionReminderEnabled', e.target.checked)} />
  Send session reminders (day before, when slots available)
</label>
<label>
  <input type="checkbox" checked={settings.membershipReminderEnabled ?? true}
    onChange={e => updateSetting('membershipReminderEnabled', e.target.checked)} />
  Send membership payment reminders (3 days before renewal)
</label>
<label>
  <input type="checkbox" checked={settings.inactivityWarningEnabled ?? true}
    onChange={e => updateSetting('inactivityWarningEnabled', e.target.checked)} />
  Warn and delete inactive members after 6 months
</label>
```

**Commit:**

```bash
git add backend/routes/clubs.js frontend/src/...
git commit -m "feat: add automation toggle settings to club"
```

---

## Task 9: Frontend API client

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

Add to the `bookingApi` object (alongside the existing methods):

```js
// Messages
getMessages: () =>
  axios.get(`${API_URL}/messages`, { headers: getHeaders() }),
getMessage: (id) =>
  axios.get(`${API_URL}/messages/${id}`, { headers: getHeaders() }),
previewRecipients: (recipientFilter) =>
  axios.post(`${API_URL}/messages/preview-recipients`, { recipientFilter }, { headers: getHeaders() }),
createMessage: (data) =>
  axios.post(`${API_URL}/messages`, data, { headers: getHeaders() }),
updateMessage: (id, data) =>
  axios.patch(`${API_URL}/messages/${id}`, data, { headers: getHeaders() }),
sendMessage: (id) =>
  axios.post(`${API_URL}/messages/${id}/send`, {}, { headers: getHeaders() }),
deleteMessage: (id) =>
  axios.delete(`${API_URL}/messages/${id}`, { headers: getHeaders() }),
getArchivedMembers: () =>
  axios.get(`${API_URL}/messages/archived-members`, { headers: getHeaders() }),
```

**Commit:**

```bash
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add messaging API calls to bookingApi"
```

---

## Task 10: Frontend — AdminMessages page

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminMessages.js`

This page has two sections: a campaign list and a composer panel that opens when creating or editing a message. Follow the visual style of `AdminMembers.js` (bk- CSS classes, booking vars).

**Key UI components:**

**Campaign list** — table/card list showing subject, status badge, scheduled/sent time, sent count. Buttons: New Campaign, Edit (DRAFT/SCHEDULED only), Send Now, Delete.

**Status badge colours:**
- DRAFT → grey (`var(--booking-text-muted)`)
- SCHEDULED → blue (`var(--booking-accent)`)
- SENDING → orange (`#f39c12`)
- SENT → green (`var(--booking-booked)`)
- FAILED → red (`var(--booking-danger)`)

**Composer panel** (shown in a modal or slide-in when creating/editing):

```jsx
// Fields:
// - Subject (text input)
// - Body (textarea — plain HTML for now, no rich text editor needed)
// - Recipient filter builder (see below)
// - Schedule toggle: "Send now" / "Schedule for later" (shows datetime-local input)
// - Preview recipients button → shows count + first 5 names
// - Save as Draft / Schedule / Send Now buttons
```

**Recipient filter builder** — a `<select>` for filter type, then conditional fields:

```jsx
const FILTER_TYPES = [
  { value: 'all', label: 'All members' },
  { value: 'role', label: 'By role' },
  { value: 'session', label: 'Session attendees' },
  { value: 'active_membership', label: 'Active membership' },
  { value: 'expiring_credits', label: 'Expiring credits' },
  { value: 'no_upcoming_bookings', label: 'No upcoming bookings' },
];
```

For `role`: show a `<select>` for PARENT / COACH.
For `session`: show a session picker (fetch sessions list from `bookingApi.getSessions`).
For `expiring_credits` and `no_upcoming_bookings`: show a number input for `withinDays`.

**Step: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMessages.js
git commit -m "feat: add AdminMessages campaign composer page"
```

---

## Task 11: Frontend — AdminRemovedMembers page

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminRemovedMembers.js`

Simple table showing archived member summaries. Columns: Name, Sessions Attended, Total Paid, Memberships, Reason, Deleted At.

```jsx
import React, { useEffect, useState } from 'react';
import { bookingApi } from '../../../utils/bookingApi';

const REASON_LABELS = { INACTIVITY: 'Inactive', MANUAL: 'Manual / GDPR' };

export default function AdminRemovedMembers() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi.getArchivedMembers()
      .then(r => setSummaries(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="bk-muted">Loading...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Removed Members</h2>
      {summaries.length === 0 ? (
        <p className="bk-muted">No removed members yet.</p>
      ) : (
        <table className="bk-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Sessions</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total Paid</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Memberships</th>
              <th style={{ padding: '0.5rem' }}>Reason</th>
              <th style={{ padding: '0.5rem' }}>Removed</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--booking-border)' }}>
                <td style={{ padding: '0.5rem' }}>{s.firstName} {s.lastName}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.sessionsAttended}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>£{(s.totalAmountPaid / 100).toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.membershipCount}</td>
                <td style={{ padding: '0.5rem' }}>{REASON_LABELS[s.deletionReason] ?? s.deletionReason}</td>
                <td style={{ padding: '0.5rem', color: 'var(--booking-text-muted)', fontSize: '0.8rem' }}>
                  {new Date(s.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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

**Commit:**

```bash
git add frontend/src/pages/booking/admin/AdminRemovedMembers.js
git commit -m "feat: add AdminRemovedMembers page"
```

---

## Task 12: Wire up routing and navigation

**Files:**
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js` (admin nav/tabs)
- Modify: `frontend/src/App.js` (if messages/removed-members need their own routes)

**Step 1: Find where admin tabs are defined**

```bash
grep -n "AdminMembers\|AdminCredits\|tab\|Tab\|nav\|Nav" frontend/src/pages/booking/admin/BookingAdmin.js | head -20
```

**Step 2: Add imports at top of BookingAdmin.js**

```js
import AdminMessages from './AdminMessages';
import AdminRemovedMembers from './AdminRemovedMembers';
```

**Step 3: Add tabs to the tab list** (follow the existing tab pattern):

```jsx
{ key: 'messages', label: 'Messages' },
{ key: 'removed-members', label: 'Removed Members' },
```

**Step 4: Add tab panels** (follow the existing panel pattern):

```jsx
{activeTab === 'messages' && <AdminMessages />}
{activeTab === 'removed-members' && <AdminRemovedMembers />}
```

**Commit:**

```bash
git add frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: add Messages and Removed Members tabs to booking admin"
```

---

## Final steps

**Apply migration to production DB on Render:**

After deploying, run via Render shell or the deploy hook:
```bash
npx prisma migrate deploy
```

**Verify crons are running:**
Check Render logs after deploy for the cron registration messages.

**Test the full flow manually:**
1. Create a draft message with "all members" filter
2. Preview recipients — verify count is correct
3. Send immediately — check recipient statuses in message detail
4. Create a scheduled message 2 minutes in the future — verify it sends automatically
5. Trigger manual member deletion from AdminMembers — verify summary appears in Removed Members tab
