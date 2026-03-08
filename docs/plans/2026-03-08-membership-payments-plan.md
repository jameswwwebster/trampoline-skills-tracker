# Monthly Membership Payments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins/coaches to assign monthly Stripe-billed memberships to gymnasts, with members setting up payment via embedded Stripe Elements in My Account.

**Architecture:** Admin creates a membership → backend creates Stripe Customer + Subscription (incomplete) with calendar-month billing anchor and automatic pro-rata first invoice → member completes card setup in My Account via PaymentElement → webhook activates membership and sends emails. Members with ACTIVE memberships are hidden from the session booking flow.

**Tech Stack:** Express + Prisma 5 + PostgreSQL, Stripe (subscriptions, webhooks), React 18 + @stripe/stripe-js + @stripe/react-stripe-js (PaymentElement already used in Checkout.js).

---

### Task 1: DB migration — schema additions

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260308000004_membership_payments/migration.sql`

**Context:**
- `User` model is at line 11 of schema.prisma — add `stripeCustomerId String?` field
- `Membership` model is at line 540 — add `sessionAllowancePerWeek Int`, change default status, update enum
- `MembershipStatus` enum is at line 640 — add `PENDING_PAYMENT`
- Migration naming convention: `20260308000004_<name>`

**Step 1: Update schema.prisma**

In the `User` model, add after `isArchived Boolean @default(false)`:
```prisma
stripeCustomerId              String?
```

In the `Membership` model, replace the current block with:
```prisma
model Membership {
  id                     String           @id @default(cuid())
  gymnastId              String
  clubId                 String
  monthlyAmount          Int              // in pence
  sessionAllowancePerWeek Int
  stripeSubscriptionId   String?
  status                 MembershipStatus @default(PENDING_PAYMENT)
  startDate              DateTime
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt
  gymnast                Gymnast          @relation(fields: [gymnastId], references: [id])
  club                   Club             @relation(fields: [clubId], references: [id])

  @@map("memberships")
}
```

In the `MembershipStatus` enum, add `PENDING_PAYMENT`:
```prisma
enum MembershipStatus {
  PENDING_PAYMENT
  ACTIVE
  CANCELLED
  PAUSED
}
```

**Step 2: Create migration SQL**

Create `backend/prisma/migrations/20260308000004_membership_payments/migration.sql`:
```sql
ALTER TABLE "users" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "memberships" ADD COLUMN "sessionAllowancePerWeek" INTEGER NOT NULL DEFAULT 0;
ALTER TYPE "MembershipStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
```

**Step 3: Apply migration and regenerate client**

```bash
cd backend
npx prisma migrate dev --name membership_payments
```

Expected: Migration applied, Prisma client regenerated.

**Step 4: Verify**

```bash
npx prisma studio
```

Check `Membership` table has `sessionAllowancePerWeek` column and `User` has `stripeCustomerId`.

**Step 5: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add stripeCustomerId, sessionAllowancePerWeek, PENDING_PAYMENT status"
```

---

### Task 2: Membership email notifications

**Files:**
- Modify: `backend/services/emailService.js`

**Context:**
- `emailService.js` exports a singleton `EmailService` instance
- Add two methods before the closing `}` of the class, before `sendGuardianConnectionNotification`
- The `sendEmail` generic method was added in a previous session — use `this.transporter.sendMail` directly like other methods

**Step 1: Add `sendMembershipPaymentSuccessEmail` and `sendMembershipPaymentFailedEmail`**

Add these two methods to the `EmailService` class before `sendGuardianConnectionNotification`:

```js
async sendMembershipPaymentSuccessEmail(email, userName, gymnast, amountPence, nextBillingDate) {
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  const nextDate = new Date(nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject: `Membership payment received — ${gymnast.firstName} ${gymnast.lastName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2>Payment received</h2>
      <p>Hi ${userName},</p>
      <p>We've received your membership payment of <strong>${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>.</p>
      <p>Your next payment of ${amount} will be taken on <strong>${nextDate}</strong>.</p>
      <p>Thanks for being a member of Trampoline Life!</p>
    </div>`,
    text: `Hi ${userName},\n\nWe've received your membership payment of ${amount} for ${gymnast.firstName} ${gymnast.lastName}.\n\nYour next payment of ${amount} will be taken on ${nextDate}.\n\nThanks for being a member of Trampoline Life!`,
  };
  try {
    if (this.isConfigured && this.transporter) {
      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } else {
      console.log('📧 Membership payment success email (DEV MODE):', { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount });
      return { success: true, dev: true };
    }
  } catch (error) {
    console.error('❌ Failed to send membership payment success email:', error);
    return { success: false, error: error.message };
  }
}

async sendMembershipPaymentFailedEmail(email, userName, gymnast, amountPence) {
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
    to: email,
    subject: `Membership payment failed — ${gymnast.firstName} ${gymnast.lastName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2>Payment failed</h2>
      <p>Hi ${userName},</p>
      <p>We were unable to collect your membership payment of <strong>${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>.</p>
      <p>Please log in to your account and update your payment details to avoid any interruption to your membership.</p>
      <p>If you have any questions, please contact us.</p>
    </div>`,
    text: `Hi ${userName},\n\nWe were unable to collect your membership payment of ${amount} for ${gymnast.firstName} ${gymnast.lastName}.\n\nPlease log in to your account and update your payment details.\n\nIf you have any questions, please contact us.`,
  };
  try {
    if (this.isConfigured && this.transporter) {
      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } else {
      console.log('📧 Membership payment failed email (DEV MODE):', { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount });
      return { success: true, dev: true };
    }
  } catch (error) {
    console.error('❌ Failed to send membership payment failed email:', error);
    return { success: false, error: error.message };
  }
}
```

**Step 2: Commit**
```bash
git add backend/services/emailService.js
git commit -m "feat: add membership payment email notifications"
```

---

### Task 3: Memberships backend — create with Stripe

**Files:**
- Modify: `backend/routes/booking/memberships.js`

**Context:**
- Current `POST /` creates a membership with an optional `stripeCustomerId` param — replace this entirely
- The gymnast may have multiple guardians; use the first guardian found (ordering by `createdAt`)
- Stripe subscription setup:
  - Create/find Stripe Customer on the guardian's `User.stripeCustomerId`
  - `billing_cycle_anchor` = 1st of next calendar month (UTC)
  - `proration_behavior: 'create_prorations'` — auto pro-rata first invoice
  - `payment_behavior: 'default_incomplete'` — subscription waits for payment
  - `payment_settings: { save_default_payment_method: 'on_subscription' }`
  - `expand: ['latest_invoice.payment_intent']` — get clientSecret in one call
- Return `{ membership, clientSecret }` to frontend
- If STRIPE_SECRET_KEY is not set, create membership with status PENDING_PAYMENT and no subscription (dev fallback)

**Step 1: Replace the full `memberships.js`**

```js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/memberships — admin: all; member: their gymnasts
router.get('/', auth, async (req, res) => {
  try {
    let where = { clubId: req.user.clubId };
    if (!['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
      const myGymnasts = await prisma.gymnast.findMany({
        where: { guardians: { some: { id: req.user.id } } },
        select: { id: true },
      });
      where.gymnastId = { in: myGymnasts.map(g => g.id) };
    }
    const memberships = await prisma.membership.findMany({
      where,
      include: { gymnast: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/memberships/my — member's own memberships (for My Account)
router.get('/my', auth, async (req, res) => {
  try {
    const myGymnasts = await prisma.gymnast.findMany({
      where: { guardians: { some: { id: req.user.id } } },
      select: { id: true },
    });
    const memberships = await prisma.membership.findMany({
      where: {
        gymnastId: { in: myGymnasts.map(g => g.id) },
        clubId: req.user.clubId,
        status: { not: 'CANCELLED' },
      },
      include: { gymnast: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/memberships/:id/client-secret — get clientSecret to re-show payment form
router.get('/:id/client-secret', auth, async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Not found' });
    if (!membership.stripeSubscriptionId) return res.status(400).json({ error: 'No subscription' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });
    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
    if (!clientSecret) return res.status(400).json({ error: 'Payment already complete' });
    res.json({ clientSecret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships — admin/coach only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      gymnastId: Joi.string().required(),
      monthlyAmount: Joi.number().integer().min(1).required(),
      sessionAllowancePerWeek: Joi.number().integer().min(1).required(),
      startDate: Joi.date().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify gymnast belongs to this club
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: value.gymnastId },
      include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!gymnast || gymnast.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check no active/pending membership already exists
    const existing = await prisma.membership.findFirst({
      where: { gymnastId: value.gymnastId, status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED'] } },
    });
    if (existing) return res.status(400).json({ error: 'Gymnast already has an active membership' });

    let stripeSubscriptionId = null;
    let clientSecret = null;

    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const guardian = gymnast.guardians[0];

      if (!guardian) return res.status(400).json({ error: 'Gymnast has no guardian account to bill' });

      // Create or retrieve Stripe Customer for the guardian
      let stripeCustomerId = guardian.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: guardian.email,
          name: `${guardian.firstName} ${guardian.lastName}`,
          metadata: { userId: guardian.id },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: guardian.id },
          data: { stripeCustomerId },
        });
      }

      // billing_cycle_anchor = 1st of next calendar month (UTC)
      const now = new Date();
      const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const billingCycleAnchor = Math.floor(firstOfNextMonth.getTime() / 1000);

      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{
          price_data: {
            currency: 'gbp',
            product_data: { name: `Trampoline Life Membership — ${gymnast.firstName} ${gymnast.lastName}` },
            unit_amount: value.monthlyAmount,
            recurring: { interval: 'month' },
          },
        }],
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'create_prorations',
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { clubId: req.user.clubId, gymnastId: value.gymnastId },
      });

      stripeSubscriptionId = subscription.id;
      clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
    }

    const membership = await prisma.membership.create({
      data: {
        gymnastId: value.gymnastId,
        clubId: req.user.clubId,
        monthlyAmount: value.monthlyAmount,
        sessionAllowancePerWeek: value.sessionAllowancePerWeek,
        stripeSubscriptionId,
        status: 'PENDING_PAYMENT',
        startDate: new Date(value.startDate),
      },
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.create', entityType: 'Membership', entityId: membership.id,
      metadata: { gymnastId: value.gymnastId, monthlyAmount: value.monthlyAmount, sessionAllowancePerWeek: value.sessionAllowancePerWeek },
    });

    res.status(201).json({ membership, clientSecret });
  } catch (err) {
    console.error('Create membership error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/memberships/:id — pause, resume, update amount
router.patch('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const { status, monthlyAmount } = req.body;
    const data = {};

    if (monthlyAmount !== undefined) data.monthlyAmount = monthlyAmount;

    if (status === 'PAUSED' && membership.status === 'ACTIVE') {
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.update(membership.stripeSubscriptionId, {
          pause_collection: { behavior: 'void' },
        });
      }
      data.status = 'PAUSED';
    } else if (status === 'ACTIVE' && membership.status === 'PAUSED') {
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.update(membership.stripeSubscriptionId, {
          pause_collection: '',
        });
      }
      data.status = 'ACTIVE';
    }

    const updated = await prisma.membership.update({
      where: { id: req.params.id },
      data,
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.update', entityType: 'Membership', entityId: req.params.id,
      metadata: req.body,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/memberships/:id — cancel
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
    }

    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'CANCELLED' } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.cancel', entityType: 'Membership', entityId: membership.id,
      metadata: { gymnastId: membership.gymnastId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel membership error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

**Step 2: Verify server starts without errors**
```bash
cd backend && node -e "require('./routes/booking/memberships')" && echo OK
```
Expected: `OK`

**Step 3: Commit**
```bash
git add backend/routes/booking/memberships.js
git commit -m "feat: membership backend with Stripe subscription creation"
```

---

### Task 4: Webhook — subscription payment events

**Files:**
- Modify: `backend/routes/booking/webhook.js`

**Context:**
- File is at `backend/routes/booking/webhook.js`
- Currently handles `payment_intent.succeeded` and `payment_intent.payment_failed` for one-off bookings
- Add handlers for: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- For `invoice.paid`: find membership by subscription ID, set ACTIVE, send success email to first guardian
- For `invoice.payment_failed`: find membership, send failure email to first guardian
- For `customer.subscription.deleted`: find membership, set CANCELLED
- Use `emailService` from `../services/emailService` (path is `../../services/emailService` from `routes/booking/`)
- The `invoice` object has: `subscription` (subscription ID), `amount_paid`, `period_end` (next billing date as Unix timestamp)

**Step 1: Add subscription event handlers to webhook.js**

After the existing `payment_intent.payment_failed` block, before `res.json({ received: true })`:

```js
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (!invoice.subscription) return res.json({ received: true }); // not a subscription invoice
    const membership = await prisma.membership.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
      include: {
        gymnast: true,
        club: true,
      },
    });
    if (membership && membership.status !== 'ACTIVE') {
      await prisma.membership.update({ where: { id: membership.id }, data: { status: 'ACTIVE' } });
    }
    if (membership && membership.club.emailEnabled && invoice.amount_paid > 0) {
      // Find the first guardian to email
      const guardian = await prisma.user.findFirst({
        where: { guardedGymnasts: { some: { id: membership.gymnastId } } },
        select: { email: true, firstName: true, lastName: true },
        orderBy: { createdAt: 'asc' },
      });
      if (guardian?.email) {
        const emailService = require('../../services/emailService');
        const nextBillingDate = new Date(invoice.period_end * 1000);
        await emailService.sendMembershipPaymentSuccessEmail(
          guardian.email,
          `${guardian.firstName} ${guardian.lastName}`,
          membership.gymnast,
          invoice.amount_paid,
          nextBillingDate,
        );
      }
    }
    console.log(`Membership ${membership?.id} activated via invoice ${invoice.id}`);
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    if (!invoice.subscription) return res.json({ received: true });
    const membership = await prisma.membership.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
      include: { gymnast: true, club: true },
    });
    if (membership && membership.club.emailEnabled) {
      const guardian = await prisma.user.findFirst({
        where: { guardedGymnasts: { some: { id: membership.gymnastId } } },
        select: { email: true, firstName: true, lastName: true },
        orderBy: { createdAt: 'asc' },
      });
      if (guardian?.email) {
        const emailService = require('../../services/emailService');
        await emailService.sendMembershipPaymentFailedEmail(
          guardian.email,
          `${guardian.firstName} ${guardian.lastName}`,
          membership.gymnast,
          invoice.amount_due,
        );
      }
    }
    console.log(`Membership payment failed for subscription ${invoice.subscription}`);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await prisma.membership.updateMany({
      where: { stripeSubscriptionId: subscription.id, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    });
    console.log(`Membership cancelled via subscription deletion ${subscription.id}`);
  }
```

**Step 2: Verify**
```bash
cd backend && node -e "require('./routes/booking/webhook')" && echo OK
```
Expected: `OK`

**Step 3: Register new webhook events in Stripe dashboard**

In the Stripe dashboard → Webhooks → your endpoint, add these events:
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`

**Step 4: Commit**
```bash
git add backend/routes/booking/webhook.js
git commit -m "feat: webhook handlers for subscription payment events"
```

---

### Task 5: Exclude active members from session booking flow

**Files:**
- Modify: `backend/routes/gymnasts.js` (the `GET /bookable-for-me` route, lines 27–70)

**Context:**
- `getBookableGymnasts` returns gymnasts the user can book for
- Gymnasts with `status: 'ACTIVE'` or `status: 'PAUSED'` memberships don't need to book (members just show up)
- Add a `hasMembership: Boolean` field to each gymnast in the response
- The frontend `SessionDetail.js` uses this list for the "who's coming?" checkboxes — gymnasts with `hasMembership: true` should be shown separately with a note, not as bookable options

**Step 1: Update the `buildGymnastList` select to include membership check**

In `getBookableGymnasts`, after the `withCounts` map, add membership lookup:

```js
// Check for active memberships
const activeMembershipGymnastIds = await prisma.membership.findMany({
  where: {
    gymnastId: { in: allGymnasts.map(g => g.id) },
    status: { in: ['ACTIVE', 'PAUSED'] },
  },
  select: { gymnastId: true },
}).then(ms => new Set(ms.map(m => m.gymnastId)));

const withMembership = withCounts.map(g => ({
  ...g,
  hasMembership: activeMembershipGymnastIds.has(g.id),
}));
```

Then change the final `res.json(withCounts)` to `res.json(withMembership)`.

**Step 2: Update `SessionDetail.js` to handle members**

In `frontend/src/pages/booking/SessionDetail.js`, after the `eligibleGymnasts` filter (around line 51), add:

```js
const bookableGymnasts = eligibleGymnasts.filter(g => !g.hasMembership);
const memberGymnasts = eligibleGymnasts.filter(g => g.hasMembership);
```

Then in the gymnast list render, replace `eligibleGymnasts.map(...)` with `bookableGymnasts.map(...)`.

After the gymnast list (before the "Only N slots" warning), add:
```jsx
{memberGymnasts.map(g => (
  <div key={g.id} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.25rem', background: 'rgba(39,174,96,0.08)', borderRadius: 'var(--booking-radius)', fontSize: '0.875rem', color: 'var(--booking-success)' }}>
    ✓ {g.firstName} {g.lastName} — monthly member, no booking needed
  </div>
))}
```

Also update capacity logic — replace `selectedGymnastIds.length >= session.availableSlots` checks to use `bookableGymnasts` instead of `eligibleGymnasts` where appropriate.

**Step 3: Verify server starts**
```bash
cd backend && node -e "require('./routes/gymnasts')" && echo OK
```

**Step 4: Commit**
```bash
git add backend/routes/gymnasts.js frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: exclude active members from session booking, show member badge"
```

---

### Task 6: bookingApi.js additions

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

**Context:**
- `bookingApi` is an object exported from this file
- `getHeaders()` returns the auth header
- Add: `getMyMemberships`, `getMembershipClientSecret`, `createMembership` already exists but needs `sessionAllowancePerWeek`

**Step 1: Add `getMyMemberships` and `getMembershipClientSecret`**

In the `bookingApi` object, after the existing `updateMembership` entry:

```js
getMyMemberships: () =>
  axios.get(`${API_URL}/booking/memberships/my`, { headers: getHeaders() }),

getMembershipClientSecret: (membershipId) =>
  axios.get(`${API_URL}/booking/memberships/${membershipId}/client-secret`, { headers: getHeaders() }),
```

**Step 2: Commit**
```bash
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add getMyMemberships and getMembershipClientSecret to bookingApi"
```

---

### Task 7: Admin memberships UI

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMemberships.js`

**Context:**
- Current UI: create form (gymnast, monthly amount, start date) + table with pause/cancel
- Add: `sessionAllowancePerWeek` field to form
- Show `PENDING_PAYMENT` status as a badge
- The `createMembership` call returns `{ membership, clientSecret }` — if `clientSecret` is returned, show a note that the member needs to complete payment setup in their account
- Status display: map status strings to readable labels

**Step 1: Replace `AdminMemberships.js`**

```jsx
import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const STATUS_LABELS = {
  PENDING_PAYMENT: { label: 'Awaiting payment setup', color: 'var(--booking-warning, #e67e22)' },
  ACTIVE: { label: 'Active', color: 'var(--booking-success)' },
  PAUSED: { label: 'Paused', color: 'var(--booking-text-muted)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--booking-danger)' },
};

export default function AdminMemberships() {
  const [memberships, setMemberships] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [form, setForm] = useState({ gymnastId: '', monthlyAmount: '', sessionAllowancePerWeek: '', startDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    bookingApi.getMemberships().then(res => setMemberships(res.data));
    const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;
    fetch(`${API_URL}/gymnasts`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json()).then(data => setGymnasts(Array.isArray(data) ? data : data.gymnasts || []));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitMsg(null);
    try {
      const res = await bookingApi.createMembership({
        gymnastId: form.gymnastId,
        monthlyAmount: Math.round(parseFloat(form.monthlyAmount) * 100),
        sessionAllowancePerWeek: parseInt(form.sessionAllowancePerWeek),
        startDate: form.startDate,
      });
      setForm({ gymnastId: '', monthlyAmount: '', sessionAllowancePerWeek: '', startDate: '' });
      setSubmitMsg(res.data.clientSecret
        ? 'Membership created. The member will see a payment setup prompt in their account.'
        : 'Membership created.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create membership.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await bookingApi.updateMembership(id, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update membership.');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this membership? This will stop Stripe billing immediately.')) return;
    try {
      await bookingApi.deleteMembership(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel membership.');
    }
  };

  return (
    <div className="bk-page bk-page--lg">
      <h2>Memberships</h2>

      <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Add member</h3>
        <div className="bk-grid-2">
          <label className="bk-label">Gymnast
            <select value={form.gymnastId} onChange={e => setForm(f => ({ ...f, gymnastId: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }}>
              <option value="">Select gymnast</option>
              {gymnasts.filter(g => !g.isArchived).map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>)}
            </select>
          </label>
          <label className="bk-label">Monthly amount (£)
            <input type="number" step="0.01" min="0" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} required placeholder="e.g. 40.00" className="bk-input" style={{ marginTop: '0.25rem' }} />
          </label>
        </div>
        <div className="bk-grid-2">
          <label className="bk-label">Sessions per week
            <input type="number" min="1" max="14" value={form.sessionAllowancePerWeek} onChange={e => setForm(f => ({ ...f, sessionAllowancePerWeek: e.target.value }))} required placeholder="e.g. 2" className="bk-input" style={{ marginTop: '0.25rem' }} />
          </label>
          <label className="bk-label">Start date
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required className="bk-input" style={{ marginTop: '0.25rem' }} />
          </label>
        </div>
        {error && <p className="bk-error">{error}</p>}
        {submitMsg && <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem' }}>{submitMsg}</p>}
        <button type="submit" disabled={submitting} className="bk-btn bk-btn--primary">
          {submitting ? 'Creating...' : 'Add member'}
        </button>
      </form>

      {memberships.length === 0 && <p className="bk-muted">No memberships.</p>}
      {memberships.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th style={{ textAlign: 'right' }}>Monthly</th>
              <th>Sessions/wk</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map(m => {
              const s = STATUS_LABELS[m.status] || { label: m.status, color: 'inherit' };
              return (
                <tr key={m.id}>
                  <td>{m.gymnast.firstName} {m.gymnast.lastName}</td>
                  <td style={{ textAlign: 'right' }}>£{(m.monthlyAmount / 100).toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>{m.sessionAllowancePerWeek}</td>
                  <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                  <td>
                    <div className="bk-row">
                      {m.status === 'ACTIVE' && (
                        <button onClick={() => handleStatusChange(m.id, 'PAUSED')} className="bk-btn bk-btn--sm">Pause</button>
                      )}
                      {m.status === 'PAUSED' && (
                        <button onClick={() => handleStatusChange(m.id, 'ACTIVE')} className="bk-btn bk-btn--sm bk-btn--primary">Resume</button>
                      )}
                      {m.status !== 'CANCELLED' && (
                        <button onClick={() => handleCancel(m.id)} className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

**Step 2: Add `deleteMembership` to bookingApi.js** (needed by the cancel button above):

In `frontend/src/utils/bookingApi.js`, add after `updateMembership`:
```js
deleteMembership: (id) =>
  axios.delete(`${API_URL}/booking/memberships/${id}`, { headers: getHeaders() }),
```

**Step 3: Commit**
```bash
git add frontend/src/pages/booking/admin/AdminMemberships.js frontend/src/utils/bookingApi.js
git commit -m "feat: admin memberships UI with sessions/week, status labels, Stripe-aware cancel"
```

---

### Task 8: Member membership card in My Account

**Files:**
- Modify: `frontend/src/pages/booking/MyChildren.js`

**Context:**
- `MyChildren.js` is the My Account page
- Already loads gymnasts, credits, user contact details
- Add a membership section that loads via `bookingApi.getMyMemberships()`
- If a membership has `status === 'PENDING_PAYMENT'` and a `clientSecret` is available (fetched from `getMembershipClientSecret`), show the Stripe PaymentElement inline
- Use the same `loadStripe` / `Elements` / `PaymentElement` pattern as `Checkout.js`
- After payment confirmation, reload memberships (status will flip to ACTIVE via webhook, but optimistically show a "payment submitted" message)
- Show membership details for ACTIVE / PAUSED memberships

**Step 1: Add membership card component and load in MyChildren**

At the top of `MyChildren.js`, add imports:
```js
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { bookingApi } from '../../utils/bookingApi';
```

(Note: `bookingApi` is already imported — don't duplicate it.)

Add `stripePromise` constant at module level (outside component, same as Checkout.js):
```js
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
```

Add a `MembershipPaymentForm` component (outside `MyChildren`):
```jsx
function MembershipPaymentForm({ membership, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/my-account` },
      redirect: 'if_required',
    });
    if (error) {
      setError(error.message);
      setProcessing(false);
    } else {
      setDone(true);
      onDone();
    }
  };

  if (done) return <p style={{ color: 'var(--booking-success)', fontSize: '0.875rem' }}>Payment submitted — your membership will activate shortly.</p>;

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
      <button type="submit" disabled={!stripe || processing} className="bk-btn bk-btn--primary" style={{ marginTop: '0.75rem', width: '100%' }}>
        {processing ? 'Processing...' : `Set up payment — £${(membership.monthlyAmount / 100).toFixed(2)}/month`}
      </button>
    </form>
  );
}
```

Add a `MembershipCard` component:
```jsx
function MembershipCard({ membership, onUpdated }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingSecret, setLoadingSecret] = useState(false);

  const loadClientSecret = async () => {
    setLoadingSecret(true);
    try {
      const res = await bookingApi.getMembershipClientSecret(membership.id);
      setClientSecret(res.data.clientSecret);
    } catch {
      // already paid or error
    } finally {
      setLoadingSecret(false);
    }
  };

  const STATUS_DISPLAY = {
    PENDING_PAYMENT: { label: 'Payment setup required', color: 'var(--booking-danger)' },
    ACTIVE: { label: 'Active', color: 'var(--booking-success)' },
    PAUSED: { label: 'Paused', color: 'var(--booking-text-muted)' },
  };
  const s = STATUS_DISPLAY[membership.status] || { label: membership.status, color: 'inherit' };

  return (
    <div className="bk-card" style={{ marginBottom: '0.75rem' }}>
      <div className="bk-row bk-row--between" style={{ marginBottom: '0.5rem' }}>
        <strong>{membership.gymnast.firstName} {membership.gymnast.lastName}</strong>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>{s.label}</span>
      </div>
      <div style={{ fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', color: 'var(--booking-text-muted)' }}>
        <span>Monthly</span><span style={{ color: 'var(--booking-text-on-light)', fontWeight: 600 }}>£{(membership.monthlyAmount / 100).toFixed(2)}</span>
        <span>Sessions/week</span><span style={{ color: 'var(--booking-text-on-light)' }}>{membership.sessionAllowancePerWeek}</span>
        <span>Start date</span><span style={{ color: 'var(--booking-text-on-light)' }}>{new Date(membership.startDate).toLocaleDateString('en-GB')}</span>
      </div>

      {membership.status === 'PENDING_PAYMENT' && !clientSecret && (
        <button
          className="bk-btn bk-btn--primary"
          style={{ marginTop: '0.75rem', width: '100%' }}
          disabled={loadingSecret}
          onClick={loadClientSecret}
        >
          {loadingSecret ? 'Loading...' : 'Set up payment'}
        </button>
      )}

      {membership.status === 'PENDING_PAYMENT' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <MembershipPaymentForm membership={membership} onDone={onUpdated} />
        </Elements>
      )}

      {membership.status === 'PAUSED' && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
          Your membership is currently paused. Contact the club to resume.
        </p>
      )}
    </div>
  );
}
```

**Step 2: Add memberships state and load in `MyChildren`**

In the `MyChildren` component state declarations, add:
```js
const [memberships, setMemberships] = useState([]);
```

In the `useEffect`, add alongside the credits load:
```js
bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {});
```

**Step 3: Add memberships section to the JSX**

In the `MyChildren` JSX, add a memberships section after the credits card and before the "Myself" section:

```jsx
{memberships.length > 0 && (
  <section style={{ marginBottom: '2rem' }}>
    <h3>Memberships</h3>
    {memberships.map(m => (
      <MembershipCard key={m.id} membership={m} onUpdated={() =>
        bookingApi.getMyMemberships().then(r => setMemberships(r.data)).catch(() => {})
      } />
    ))}
  </section>
)}
```

**Step 4: Commit**
```bash
git add frontend/src/pages/booking/MyChildren.js
git commit -m "feat: membership card with Stripe payment setup in My Account"
```

---

## Testing Checklist

After all tasks:

1. **Admin creates membership** — fills form with gymnast, amount, sessions/week, start date → membership appears in table with "Awaiting payment setup" status
2. **Member sets up payment** — logs in, sees membership card in My Account → clicks "Set up payment" → Stripe card form appears → enters test card `4242 4242 4242 4242` → submits → "payment submitted" message shown
3. **Webhook activates** — check backend logs for `Membership ... activated via invoice ...` → membership status flips to ACTIVE
4. **Pro-rata billing** — verify Stripe dashboard shows first invoice with pro-rated amount based on days remaining in month
5. **Session booking** — gymnast with ACTIVE membership appears as "monthly member" badge in session booking, not as a bookable option
6. **Admin pause** — click Pause → Stripe shows `pause_collection` active → status shows PAUSED
7. **Admin resume** — click Resume → Stripe `pause_collection` cleared → status shows ACTIVE
8. **Admin cancel** — click Cancel + confirm → Stripe subscription cancelled → status shows Cancelled
9. **Payment success email** — check email logs / inbox for payment received email
10. **Payment failed email** — use Stripe test card `4000 0000 0000 0341` (always fails) → check failure email sent
