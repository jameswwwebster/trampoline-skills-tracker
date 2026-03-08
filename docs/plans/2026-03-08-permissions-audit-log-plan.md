# Permissions & Audit Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten coach vs admin permissions, add a comprehensive AuditLog model, log all staff actions, and build an admin-only audit log UI with server-side filtering and infinite scroll.

**Architecture:** New `AuditLog` Prisma model stores every staff write action. A thin service helper writes entries inline in each route after the action succeeds. The frontend polls a paginated, filterable API endpoint and loads more on scroll.

**Tech Stack:** Express 5, Prisma 5, PostgreSQL, React 18, React Router 6, existing `bookingApi.js` utility, existing booking admin CSS variables.

**Design doc:** `docs/plans/2026-03-08-permissions-and-audit-log-design.md`

---

### Task 1: Tighten delete route permissions

**Files:**
- Modify: `backend/routes/booking/admin.js:10` and `:30`

**Step 1: Restrict gymnast delete to CLUB_ADMIN only**

In `backend/routes/booking/admin.js` line 10, change:
```js
router.delete('/gymnasts/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
```
to:
```js
router.delete('/gymnasts/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
```

**Step 2: Restrict member delete to CLUB_ADMIN only**

Line 30, change:
```js
router.delete('/members/:userId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
```
to:
```js
router.delete('/members/:userId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
```

**Step 3: Open membership routes to COACH**

In `backend/routes/booking/memberships.js`, change line 39:
```js
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
```
to:
```js
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
```

And line 81:
```js
router.patch('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
```
to:
```js
router.patch('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
```

**Step 4: Verify by restarting backend and confirming routes load without errors**

```bash
cd backend && node server.js
```
Expected: Server starts on port 5000 with no errors.

**Step 5: Commit**

```bash
git add backend/routes/booking/admin.js backend/routes/booking/memberships.js
git commit -m "fix: restrict member/gymnast delete to CLUB_ADMIN, open memberships to COACH"
```

---

### Task 2: Add AuditLog Prisma model and migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260308000001_add_audit_log/migration.sql`

**Step 1: Add AuditLog model to schema**

In `backend/prisma/schema.prisma`, add after the last model:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String
  entityType String
  entityId   String?
  metadata   Json?
  clubId     String
  club       Club     @relation(fields: [clubId], references: [id])
  createdAt  DateTime @default(now())

  @@index([clubId, createdAt])
  @@index([userId])
  @@map("audit_logs")
}
```

**Step 2: Add relation fields to User and Club models**

In the `User` model, add:
```prisma
  auditLogs  AuditLog[]
```

In the `Club` model, add:
```prisma
  auditLogs  AuditLog[]
```

**Step 3: Write migration SQL**

Create `backend/prisma/migrations/20260308000001_add_audit_log/migration.sql`:

```sql
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "clubId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_clubId_createdAt_idx" ON "audit_logs"("clubId", "createdAt");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Step 4: Apply migration and regenerate client**

```bash
cd backend && npx prisma migrate deploy && npx prisma generate
```
Expected: Migration applied, Prisma client regenerated with AuditLog model.

**Step 5: Verify model exists**

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.auditLog.create);"
```
Expected: `function`

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260308000001_add_audit_log/
git commit -m "feat: add AuditLog model and migration"
```

---

### Task 3: Create audit log service helper

**Files:**
- Create: `backend/services/auditLogService.js`

**Step 1: Create the service**

```js
// backend/services/auditLogService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Write an audit log entry. Fire-and-forget — errors are swallowed so they
 * never break the main request.
 *
 * @param {object} opts
 * @param {string} opts.userId     - Staff member performing the action
 * @param {string} opts.clubId     - Club context
 * @param {string} opts.action     - Namespaced action string e.g. "booking.cancel"
 * @param {string} opts.entityType - Model name e.g. "Booking"
 * @param {string} [opts.entityId] - Affected record ID
 * @param {object} [opts.metadata] - Extra context (amounts, names, reason etc.)
 */
async function audit({ userId, clubId, action, entityType, entityId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: { userId, clubId, action, entityType, entityId: entityId || null, metadata: metadata || null },
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { audit };
```

**Step 2: Verify the file loads**

```bash
node -e "const { audit } = require('./services/auditLogService'); console.log(typeof audit);"
```
Expected: `function`

**Step 3: Commit**

```bash
git add backend/services/auditLogService.js
git commit -m "feat: add audit log service helper"
```

---

### Task 4: Add missing routes (credit delete, membership delete, session cancel, refund)

**Files:**
- Modify: `backend/routes/booking/credits.js`
- Modify: `backend/routes/booking/memberships.js`
- Modify: `backend/routes/booking/sessions.js`
- Modify: `backend/routes/booking/bookings.js`

**Step 1: Add credit delete route to credits.js**

Add after the existing POST /assign route:

```js
// DELETE /credits/:id — remove a credit (staff only)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const { audit } = require('../services/auditLogService');
  try {
    const credit = await prisma.credit.findUnique({ where: { id: req.params.id } });
    if (!credit) return res.status(404).json({ error: 'Credit not found' });
    if (credit.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });
    if (credit.usedOnBookingId) return res.status(400).json({ error: 'Cannot delete a credit that has been used on a booking' });

    await prisma.credit.delete({ where: { id: credit.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'credit.delete', entityType: 'Credit', entityId: credit.id,
      metadata: { userId: credit.userId, sessionTemplateId: credit.sessionTemplateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete credit error:', err);
    res.status(500).json({ error: 'Failed to delete credit' });
  }
});
```

**Step 2: Add membership delete route to memberships.js**

Add after the existing PATCH /:id route:

```js
// DELETE /memberships/:id — cancel a membership (staff only)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const { audit } = require('../services/auditLogService');
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'CANCELLED' } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.delete', entityType: 'Membership', entityId: membership.id,
      metadata: { memberId: membership.userId, type: membership.membershipType },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel membership error:', err);
    res.status(500).json({ error: 'Failed to cancel membership' });
  }
});
```

**Step 3: Add session instance cancel route to sessions.js**

Add after existing GET routes:

```js
// PATCH /sessions/:instanceId/cancel — cancel a session instance (staff only)
router.patch('/:instanceId/cancel', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const { audit } = require('../services/auditLogService');
  try {
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.instanceId },
      include: { template: true },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.sessionInstance.update({
      where: { id: instance.id },
      data: { isCancelled: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'session.cancel', entityType: 'SessionInstance', entityId: instance.id,
      metadata: { date: instance.date, templateId: instance.templateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel session error:', err);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});
```

> Note: check the `SessionInstance` model in schema.prisma for the correct field name for cancellation status (`isCancelled` or similar). Adjust if needed.

**Step 4: Add refund route to bookings.js**

Add after the cancel route:

```js
// POST /bookings/:bookingId/refund — issue a Stripe refund (staff only)
router.post('/:bookingId/refund', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { audit } = require('../services/auditLogService');
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { user: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });
    if (!booking.stripePaymentIntentId) return res.status(400).json({ error: 'No payment to refund' });

    const refund = await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'refund.issue', entityType: 'Booking', entityId: booking.id,
      metadata: { memberId: booking.userId, stripeRefundId: refund.id, amount: refund.amount },
    });

    res.json({ success: true, refundId: refund.id });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ error: err.message || 'Failed to issue refund' });
  }
});
```

**Step 5: Restart backend and verify routes register without errors**

```bash
cd backend && node server.js
```
Expected: Server starts, no errors about undefined models.

**Step 6: Commit**

```bash
git add backend/routes/booking/credits.js backend/routes/booking/memberships.js backend/routes/booking/sessions.js backend/routes/booking/bookings.js
git commit -m "feat: add credit delete, membership cancel, session cancel, and refund routes"
```

---

### Task 5: Add audit logging to existing write routes

**Files:**
- Modify: `backend/routes/booking/bookings.js` (admin-add at line 207, cancel at line 252)
- Modify: `backend/routes/booking/credits.js` (assign at line 57)
- Modify: `backend/routes/booking/memberships.js` (create at line 39, update at line 81)
- Modify: `backend/routes/booking/admin.js` (gymnast delete at line 10, member delete at line 30)
- Modify: `backend/routes/users.js` (profile edit at line 411, gymnast profile at line 590)
- Modify: `backend/routes/gymnasts.js` (admin-add-child)

**Step 1: Add require to each file that needs it**

At the top of each modified file (after existing requires), add:
```js
const { audit } = require('../services/auditLogService');
```
(For files in `routes/booking/`, path is `../../services/auditLogService`)

**Step 2: Log booking.create in bookings.js admin-add route (line ~232)**

After `await prisma.booking.create(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'booking.create', entityType: 'Booking', entityId: booking.id,
  metadata: { memberId: booking.userId, instanceId: req.body.instanceId },
});
```

**Step 3: Log booking.cancel in bookings.js cancel route (line ~288)**

After the booking update/transaction, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'booking.cancel', entityType: 'Booking', entityId: booking.id,
  metadata: { memberId: booking.userId, issueCredit: req.body.issueCredit || false },
});
```

**Step 4: Log credit.create in credits.js assign route (line ~81)**

After `await prisma.credit.create(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'credit.create', entityType: 'Credit', entityId: credit.id,
  metadata: { memberId: req.body.userId, note: req.body.note },
});
```

**Step 5: Log membership.create in memberships.js (line ~61)**

After `await prisma.membership.create(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'membership.create', entityType: 'Membership', entityId: membership.id,
  metadata: { memberId: req.body.userId, type: membership.membershipType },
});
```

**Step 6: Log membership.update in memberships.js patch route (line ~93)**

After `await prisma.membership.update(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'membership.update', entityType: 'Membership', entityId: req.params.id,
  metadata: req.body,
});
```

**Step 7: Log member.delete in admin.js gymnast delete (line ~19)**

After `await deleteGymnast(gymnast.id)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'member.delete', entityType: 'Gymnast', entityId: gymnast.id,
  metadata: { name: `${gymnast.firstName} ${gymnast.lastName}` },
});
```

**Step 8: Log member.delete in admin.js member delete (line ~63)**

After `await prisma.user.delete(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'member.delete', entityType: 'User', entityId: userId,
  metadata: { email: memberUser.email, name: `${memberUser.firstName} ${memberUser.lastName}` },
});
```
(Ensure `memberUser` is captured before deletion)

**Step 9: Log member.edit in users.js profile route (line ~452)**

After `await prisma.user.update(...)`, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'member.edit', entityType: 'User', entityId: req.params.userId,
  metadata: { fields: Object.keys(req.body) },
});
```

**Step 10: Log member.create in gymnasts.js admin-add-child route**

After gymnast creation, add:
```js
await audit({
  userId: req.user.id, clubId: req.user.clubId,
  action: 'member.create', entityType: 'Gymnast', entityId: gymnast.id,
  metadata: { name: `${gymnast.firstName} ${gymnast.lastName}`, parentId: req.body.userId },
});
```

**Step 11: Restart and smoke-test by performing an admin-cancel in the UI, then check DB**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.auditLog.findMany({ take: 5, orderBy: { createdAt: 'desc' } }).then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"
```
Expected: Entries appear for actions performed.

**Step 12: Commit**

```bash
git add backend/routes/booking/ backend/routes/users.js backend/routes/gymnasts.js
git commit -m "feat: add audit logging to all staff write operations"
```

---

### Task 6: Audit log API endpoint

**Files:**
- Modify: `backend/routes/booking/admin.js`
- Modify: `backend/server.js` (already registers /api/booking/admin — no change needed)

**Step 1: Add GET /audit-log route to admin.js**

```js
// GET /admin/audit-log — paginated, filtered audit log (CLUB_ADMIN only)
router.get('/audit-log', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { page = '1', staffId, action, from, to } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = 25;
    const skip = (pageNum - 1) * pageSize;

    const where = {
      clubId: req.user.clubId,
      ...(staffId && { userId: staffId }),
      ...(action && { action }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      pageSize,
      hasMore: skip + logs.length < total,
    });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});
```

**Step 2: Add GET /admin/audit-log/staff route to return staff list for filter dropdown**

```js
// GET /admin/audit-log/staff — list staff members who have audit log entries
router.get('/audit-log/staff', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        clubId: req.user.clubId,
        role: { in: ['CLUB_ADMIN', 'COACH'] },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});
```

**Step 3: Test endpoint manually**

```bash
# Replace TOKEN with a valid CLUB_ADMIN JWT
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/booking/admin/audit-log
```
Expected: JSON with `logs`, `total`, `page`, `hasMore` fields.

**Step 4: Commit**

```bash
git add backend/routes/booking/admin.js
git commit -m "feat: add audit log API endpoint with filtering and pagination"
```

---

### Task 7: Audit log frontend page

**Files:**
- Create: `frontend/src/pages/booking/admin/AuditLog.js`
- Modify: `frontend/src/utils/bookingApi.js`
- Modify: `frontend/src/pages/booking/BookingLayout.js` (add nav link)
- Modify: `frontend/src/App.js` (add route)

**Step 1: Add API methods to bookingApi.js**

```js
// Audit log
export const getAuditLog = (params) =>
  api.get('/booking/admin/audit-log', { params });

export const getAuditStaff = () =>
  api.get('/booking/admin/audit-log/staff');
```

**Step 2: Create AuditLog.js**

```jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuditLog, getAuditStaff } from '../../../utils/bookingApi';
import { format } from 'date-fns';

const ACTION_LABELS = {
  'booking.create': 'Created booking',
  'booking.cancel': 'Cancelled booking',
  'credit.create': 'Added credit',
  'credit.delete': 'Deleted credit',
  'membership.create': 'Added membership',
  'membership.update': 'Updated membership',
  'membership.delete': 'Cancelled membership',
  'refund.issue': 'Issued refund',
  'session.cancel': 'Cancelled session',
  'member.create': 'Added member',
  'member.edit': 'Edited member',
  'member.delete': 'Deleted member',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState([]);

  // Filters
  const [staffId, setStaffId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const observerRef = useRef();
  const bottomRef = useRef();

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    setLoading(true);
    try {
      const params = { page: pageNum, ...(staffId && { staffId }), ...(action && { action }), ...(from && { from }), ...(to && { to }) };
      const { data } = await getAuditLog(params);
      setLogs(prev => reset ? data.logs : [...prev, ...data.logs]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load audit log', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, action, from, to]);

  // Reset and reload when filters change
  useEffect(() => {
    fetchPage(1, true);
  }, [staffId, action, from, to, fetchPage]);

  // Load staff for filter dropdown
  useEffect(() => {
    getAuditStaff().then(({ data }) => setStaff(data)).catch(() => {});
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        fetchPage(page + 1);
      }
    });
    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  const uniqueActions = Object.keys(ACTION_LABELS);

  return (
    <div className="bk-page">
      <div className="bk-page-header">
        <h1 className="bk-page-title">Audit Log</h1>
        <p className="bk-page-subtitle">{total} entries</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <select value={staffId} onChange={e => setStaffId(e.target.value)} className="bk-select">
          <option value="">All staff</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="bk-select">
          <option value="">All actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bk-input" placeholder="From" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bk-input" placeholder="To" />
        {(staffId || action || from || to) && (
          <button onClick={() => { setStaffId(''); setAction(''); setFrom(''); setTo(''); }} className="bk-btn bk-btn--ghost">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bk-table-wrap">
        <table className="bk-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Staff</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                  {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                </td>
                <td>{log.user ? `${log.user.firstName} ${log.user.lastName}` : '—'}</td>
                <td>
                  <span className="bk-badge">{ACTION_LABELS[log.action] || log.action}</span>
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
                  {log.entityType} {log.entityId ? `#${log.entityId.slice(-6)}` : ''}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span> — {Object.entries(log.metadata).filter(([k]) => !k.endsWith('Id')).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--booking-text-muted)', padding: '2rem' }}>No entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={bottomRef} style={{ height: '1px' }} />
      {loading && <p style={{ textAlign: 'center', color: 'var(--booking-text-muted)', padding: '1rem' }}>Loading…</p>}
    </div>
  );
}
```

**Step 3: Add route to App.js**

Find the admin booking routes section in `frontend/src/App.js` and add:
```jsx
import AuditLog from './pages/booking/admin/AuditLog';
// ...
<Route path="/booking/admin/audit-log" element={<AuditLog />} />
```

**Step 4: Add nav link in BookingLayout.js**

Find where admin nav links are listed (search for "Members" or "Sessions" link in the admin nav section) and add:
```jsx
{isAdmin && <Link to="/booking/admin/audit-log" className={...}>Audit Log</Link>}
```
Use the same pattern as existing admin nav links.

**Step 5: Verify in browser**

- Navigate to `/booking/admin/audit-log` as CLUB_ADMIN — table loads
- Apply a filter — results update
- Scroll to bottom — more entries load automatically
- Verify the link is not visible when logged in as COACH

**Step 6: Commit**

```bash
git add frontend/src/pages/booking/admin/AuditLog.js frontend/src/utils/bookingApi.js frontend/src/pages/booking/BookingLayout.js frontend/src/App.js
git commit -m "feat: add audit log admin UI with filtering and infinite scroll"
```

---

### Task 8: Push to production

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Verify on production**

- Log in as `contact@trampoline.life` (CLUB_ADMIN)
- Navigate to `/booking/admin/audit-log`
- Confirm page loads and any existing actions appear
