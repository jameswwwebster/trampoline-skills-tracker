# Zero-Amount Membership Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow memberships with `monthlyAmount = 0` so a gymnast can attend for free, skipping Stripe entirely.

**Architecture:** One guard added in `membershipActivationService.js` before the Stripe block; one validator loosened in the POST route; two HTML `min` attributes updated in the frontend. The PATCH route's `min(1)` validator is left unchanged — editing to £0 is intentionally blocked.

**Tech Stack:** Express + Prisma 5 + Jest/Supertest (backend); React 18 (frontend)

---

## Chunk 1: All changes

### Task 1: Backend — POST validator and activation service

**Files:**
- Modify: `backend/routes/booking/memberships.js:263`
- Modify: `backend/services/membershipActivationService.js:35`
- Create: `backend/__tests__/booking.memberships.zero.test.js`

- [ ] **Step 1: Create the test file with four failing tests**

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, gymnast;

const today = new Date().toISOString().split('T')[0];
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `zero-mem-admin-${Date.now()}@test.tl` });
  const parent = await createParent(club, { email: `zero-mem-parent-${Date.now()}@test.tl` });
  gymnast = await createGymnast(club, parent);
  adminToken = tokenFor(admin);
});

afterEach(async () => {
  await prisma.membership.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Zero-amount memberships', () => {
  it('POST with monthlyAmount: 0 and today creates ACTIVE membership with no Stripe data', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 0, startDate: today });

    expect(res.status).toBe(201);
    expect(res.body.membership.status).toBe('ACTIVE');
    expect(res.body.membership.stripeSubscriptionId).toBeNull();
    expect(res.body.membership.needsPaymentMethod).toBe(false);
  });

  it('POST with monthlyAmount: 0 and future date creates SCHEDULED membership', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 0, startDate: futureDate });

    expect(res.status).toBe(201);
    expect(res.body.membership.status).toBe('SCHEDULED');
  });

  it('POST with monthlyAmount: -1 returns 400', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: -1, startDate: futureDate });

    expect(res.status).toBe(400);
  });

  it('PATCH /:id with monthlyAmount: 0 returns 400', async () => {
    // Create a valid membership first
    const createRes = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 3000, startDate: futureDate });
    expect(createRes.status).toBe(201);
    const membershipId = createRes.body.membership.id;

    const res = await request(app)
      .patch(`/api/booking/memberships/${membershipId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 0 });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest booking.memberships.zero --no-coverage
```

Expected: first two tests fail (POST rejects 0), third passes (already min(1)), fourth passes (already min(1)).

- [ ] **Step 3: Change POST validator from `min(1)` to `min(0)`**

In `backend/routes/booking/memberships.js` line 263, change:

```js
monthlyAmount: Joi.number().integer().min(1).required(),
```

to:

```js
monthlyAmount: Joi.number().integer().min(0).required(),
```

- [ ] **Step 4: Add `£0` guard in `membershipActivationService.js`**

In `backend/services/membershipActivationService.js`, replace line 35:

```js
if (process.env.STRIPE_SECRET_KEY) {
```

with:

```js
if (membership.monthlyAmount === 0) {
  // No Stripe subscription for free memberships — defaults already correct
} else if (process.env.STRIPE_SECRET_KEY) {
```

The closing `}` for the original `if` block stays as-is (it now closes the `else if`).

- [ ] **Step 5: Run tests to confirm all four pass**

```bash
cd backend && npx jest booking.memberships.zero --no-coverage
```

Expected: all 4 pass.

- [ ] **Step 6: Run full backend test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/__tests__/booking.memberships.zero.test.js \
        backend/routes/booking/memberships.js \
        backend/services/membershipActivationService.js
git commit -m "feat: allow zero-amount memberships, skip Stripe for free gymnasts"
```

---

### Task 2: Frontend — allow 0 in monthly amount inputs

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js:817`
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js:841`

There are two number inputs with `min="0.01"` in `GymnastMembership`:
- Line 817: the edit-amount form
- Line 841: the add-membership creation form

- [ ] **Step 1: Update the edit-amount input (line 817)**

Change:

```jsx
<input type="number" step="0.01" min="0.01" className="bk-input"
```

to:

```jsx
<input type="number" step="0.01" min="0" className="bk-input"
```

- [ ] **Step 2: Update the creation form input (line 841)**

Change:

```jsx
<input type="number" step="0.01" min="0.01" className="bk-input"
```

to:

```jsx
<input type="number" step="0.01" min="0" className="bk-input"
```

- [ ] **Step 3: Verify the membership inputs no longer have `min="0.01"`**

```bash
grep -n 'min="0.01"' frontend/src/pages/booking/admin/AdminMembers.js
```

Expected: only lines ~34 and ~1308 remain — those are the credit assignment and charges forms, which are correct to leave at `0.01`. The two membership inputs at lines ~817 and ~841 should no longer appear.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: allow 0 in monthly amount inputs for free memberships"
```
