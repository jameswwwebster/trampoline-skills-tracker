# Session Template Pricing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable per-gymnast price to each session template, replacing the hardcoded £6.00 constant throughout the booking system.

**Architecture:** Add `pricePerGymnast` to the `SessionTemplate` DB model with a default of 600 (pence). The booking routes read the price from the loaded template instance (already included in their queries), so no new DB queries are needed. The frontend form stores/displays prices in pounds but sends/receives pence.

**Tech Stack:** Node/Express, Prisma 5, PostgreSQL, React 18

**Spec:** `docs/superpowers/specs/2026-03-12-session-template-pricing-design.md`

---

## Chunk 1: Database + Backend

### Task 1: Add `pricePerGymnast` to the schema and migrate

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add field to schema**

In `backend/prisma/schema.prisma`, add `pricePerGymnast` to the `SessionTemplate` model after `openSlots`:

```prisma
model SessionTemplate {
  id              String            @id @default(cuid())
  clubId          String
  dayOfWeek       Int
  startTime       String
  endTime         String
  openSlots       Int               @default(12)
  pricePerGymnast Int               @default(600)   // in pence, e.g. 600 = £6.00
  minAge          Int?
  information     String?
  isActive        Boolean           @default(true)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  club            Club              @relation(fields: [clubId], references: [id])
  instances       SessionInstance[]

  @@map("session_templates")
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_price_per_gymnast_to_session_templates
```

Expected: Migration created and applied successfully. Existing rows default to 600.

- [ ] **Step 3: Verify schema**

```bash
cd backend && npx prisma studio
```

Open `SessionTemplate` table and confirm `pricePerGymnast` column exists with value 600 on all rows.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add pricePerGymnast to SessionTemplate schema"
```

---

### Task 2: Update template routes

**Files:**
- Modify: `backend/routes/booking/templates.js`
- Create: `backend/__tests__/booking.templates.test.js`

- [ ] **Step 1: Create test file with proper setup**

Create `backend/__tests__/booking.templates.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { ensureTrampolineLifeClub, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, adminToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  const admin = await prisma.user.create({
    data: {
      email: 'admin-templates@test.tl',
      password: 'hashed',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'CLUB_ADMIN',
      clubId: club.id,
    },
  });
  adminToken = tokenFor(admin);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/templates', () => {
  it('creates a template with a custom pricePerGymnast', async () => {
    const res = await request(app)
      .post('/api/booking/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dayOfWeek: 1, startTime: '10:00', endTime: '11:00', openSlots: 8, pricePerGymnast: 800 });

    expect(res.status).toBe(201);
    expect(res.body.pricePerGymnast).toBe(800);
  });

  it('defaults pricePerGymnast to 600 when not provided', async () => {
    const res = await request(app)
      .post('/api/booking/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dayOfWeek: 2, startTime: '14:00', endTime: '15:00', openSlots: 10 });

    expect(res.status).toBe(201);
    expect(res.body.pricePerGymnast).toBe(600);
  });
});

describe('PUT /api/booking/templates/:id', () => {
  it('updates pricePerGymnast', async () => {
    const template = await prisma.sessionTemplate.create({
      data: { clubId: club.id, dayOfWeek: 3, startTime: '09:00', endTime: '10:00', openSlots: 6, pricePerGymnast: 600 },
    });

    const res = await request(app)
      .put(`/api/booking/templates/${template.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dayOfWeek: 3, startTime: '09:00', endTime: '10:00', openSlots: 6, pricePerGymnast: 1000, applyToFutureInstances: false });

    expect(res.status).toBe(200);
    expect(res.body.pricePerGymnast).toBe(1000);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && npx jest --testPathPattern="booking.templates" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `pricePerGymnast` not in Joi schema, so it is stripped; the 800 test returns 600 (DB default); the update test also returns the old value.

- [ ] **Step 3: Update `templateSchema` in `templates.js`**

Change the `templateSchema` Joi object to include `pricePerGymnast`. Use `.optional().default(600)` so existing API callers that omit the field aren't broken:

```js
const templateSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  openSlots: Joi.number().integer().min(1).required(),
  pricePerGymnast: Joi.number().integer().min(1).optional().default(600),
  minAge: Joi.number().integer().min(0).allow(null).optional(),
  information: Joi.string().allow('', null).optional(),
});
```

No other changes needed in `templates.js` — `value` from Joi is passed directly to Prisma `create`/`update`, so `pricePerGymnast` flows through automatically.

- [ ] **Step 4: Run tests to confirm passing**

```bash
cd backend && npx jest --testPathPattern="booking.templates" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/booking/templates.js backend/__tests__/booking.templates.test.js
git commit -m "feat: add pricePerGymnast to template routes and validation"
```

---

### Task 3: Include `pricePerGymnast` in sessions list response

**Files:**
- Modify: `backend/routes/booking/sessions.js` (lines 37–53)
- Modify: `backend/__tests__/helpers/seed.js`
- Modify: `backend/__tests__/parent/sessions.test.js`

- [ ] **Step 1: Update `createSession` in seed to accept template overrides**

In `backend/__tests__/helpers/seed.js`, update `createSession` to accept an optional third argument for template field overrides:

```js
async function createSession(club, date, templateOverrides = {}) {
  const sessionDate = date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  sessionDate.setUTCHours(0, 0, 0, 0);

  const template = await prisma.sessionTemplate.create({
    data: {
      clubId: club.id,
      dayOfWeek: sessionDate.getDay(),
      startTime: '10:00',
      endTime: '11:00',
      openSlots: 10,
      ...templateOverrides,
    },
  });

  const instance = await prisma.sessionInstance.create({
    data: { templateId: template.id, date: sessionDate },
  });

  return { template, instance };
}
```

This is a backward-compatible change — all existing `createSession(club)` and `createSession(club, date)` calls continue to work.

- [ ] **Step 2: Write failing test**

In `backend/__tests__/parent/sessions.test.js`, add:

```js
it('includes pricePerGymnast in session list', async () => {
  const now = new Date();
  // Use the 15th of the current month to avoid month-boundary flakiness
  const sessionDate = new Date(now.getFullYear(), now.getMonth(), 15);
  const { instance } = await createSession(club, sessionDate, { pricePerGymnast: 750 });

  const res = await request(app)
    .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
    .set('Authorization', `Bearer ${tokenFor(parent)}`);

  expect(res.status).toBe(200);
  const found = res.body.find(s => s.id === instance.id);
  expect(found).toBeDefined();
  expect(found.pricePerGymnast).toBe(750);
});
```

Note: `getMonth()` is zero-indexed, so `+ 1` gives the current 1-indexed calendar month. Using the 15th of the current month as a fixed date avoids month-boundary flakiness (the session is always in the same month being queried, regardless of when the test runs).

- [ ] **Step 3: Run to confirm failure**

```bash
cd backend && npx jest --testPathPattern="parent/sessions" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `pricePerGymnast` not present in the response object

- [ ] **Step 4: Add `pricePerGymnast` to sessions list result map**

In `backend/routes/booking/sessions.js`, in the `GET /` result map (around line 41–52), add:

```js
return {
  id: instance.id,
  date: instance.date,
  startTime: instance.template.startTime,
  endTime: instance.template.endTime,
  minAge: instance.template.minAge,
  pricePerGymnast: instance.template.pricePerGymnast,
  capacity,
  bookedCount,
  availableSlots: Math.max(0, capacity - bookedCount),
  cancelledAt: instance.cancelledAt,
  isBooked: confirmedBookings.some(b => b.userId === req.user.id),
};
```

- [ ] **Step 5: Run tests to confirm passing**

```bash
cd backend && npx jest --testPathPattern="parent/sessions" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/sessions.js backend/__tests__/helpers/seed.js backend/__tests__/parent/sessions.test.js
git commit -m "feat: include pricePerGymnast in sessions list response"
```

---

### Task 4: Replace hardcoded price in booking routes + fix cancellation credit

**Files:**
- Modify: `backend/routes/booking/bookings.js`
- Test: `backend/__tests__/parent/bookings.test.js`

There are four locations to fix in `bookings.js`:

| Location | What changes |
|---|---|
| `POST /` line ~156 | `PRICE_PER_GYMNAST_PENCE * gymnastIds.length` → `instance.template.pricePerGymnast * gymnastIds.length` |
| `POST /` line ~219 | `amount: PRICE_PER_GYMNAST_PENCE` → `amount: instance.template.pricePerGymnast` |
| `POST /batch` line ~329 | push `pricePerGymnast: instance.template.pricePerGymnast` onto `validatedItems` entry |
| `POST /batch` line ~386 | `amount: PRICE_PER_GYMNAST_PENCE` → `amount: item.pricePerGymnast` |
| `POST /combined` line ~670 | push `pricePerGymnast: instance.template.pricePerGymnast` onto `validatedSessions` entry |
| `POST /combined` line ~748 | `amount: PRICE_PER_GYMNAST_PENCE` → `amount: item.pricePerGymnast` |
| Cancellation ~line 536 | Change `() =>` to `(line) =>`, use `amount: line.amount` |

- [ ] **Step 1: Update `createConfirmedBooking` in seed to accept price**

In `backend/__tests__/helpers/seed.js`, add an optional `amount` parameter (default 600 preserves all existing calls):

```js
async function createConfirmedBooking(parent, gymnast, instance, amount = 600) {
  return prisma.booking.create({
    data: {
      userId: parent.id,
      sessionInstanceId: instance.id,
      status: 'CONFIRMED',
      totalAmount: amount,
      lines: { create: [{ gymnastId: gymnast.id, amount }] },
    },
    include: { lines: true },
  });
}
```

- [ ] **Step 2: Write failing tests**

In `backend/__tests__/parent/bookings.test.js`, add:

```js
it('uses the template pricePerGymnast for booking amount', async () => {
  const { instance } = await createSession(club, undefined, { pricePerGymnast: 800 });
  await createCredit(parent, 800); // exactly £8.00 so booking is CONFIRMED (no Stripe)

  const res = await request(app)
    .post('/api/booking/bookings')
    .set('Authorization', `Bearer ${tokenFor(parent)}`)
    .send({ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] });

  expect(res.status).toBe(200);
  expect(res.body.booking.status).toBe('CONFIRMED');
  expect(res.body.booking.totalAmount).toBe(800);
  expect(res.body.booking.lines[0].amount).toBe(800);
});

it('issues a credit matching the booking line amount on cancellation', async () => {
  const { instance } = await createSession(club, undefined, { pricePerGymnast: 800 });
  const booking = await createConfirmedBooking(parent, gymnast, instance, 800);

  const res = await request(app)
    .post(`/api/booking/bookings/${booking.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(parent)}`)
    .send({ issueCredit: true });

  expect(res.status).toBe(200);

  const credits = await prisma.credit.findMany({
    where: { userId: parent.id, sourceBookingId: booking.id },
  });
  expect(credits).toHaveLength(1);
  expect(credits[0].amount).toBe(800);
});
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
cd backend && npx jest --testPathPattern="parent/bookings" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `totalAmount` is 600 not 800, credit amount is 600 not 800.

- [ ] **Step 4: Verify cancellation route includes `booking.lines`**

Before editing the lambda, confirm the `booking` query at the top of `POST /:bookingId/cancel` (around line 492) includes `lines`:

```js
const booking = await prisma.booking.findUnique({
  where: { id: req.params.bookingId },
  include: { lines: true, sessionInstance: { include: { template: true } } },
});
```

`include: { lines: true }` is present — confirmed from reading the file. If for any reason it is missing, add it before proceeding.

- [ ] **Step 5: Fix `POST /` in `bookings.js`**

Replace the hardcoded constant uses in `POST /` (around lines 156 and 219):

```js
// Line ~156 — was: const totalAmount = PRICE_PER_GYMNAST_PENCE * gymnastIds.length;
const totalAmount = instance.template.pricePerGymnast * gymnastIds.length;

// Line ~219 — was: amount: PRICE_PER_GYMNAST_PENCE,
amount: instance.template.pricePerGymnast,
```

- [ ] **Step 6: Fix `POST /batch` in `bookings.js`**

In the validation loop, update the `validatedItems.push(...)` call (around line 326):

```js
validatedItems.push({
  sessionInstanceId,
  gymnastIds,
  pricePerGymnast: instance.template.pricePerGymnast,
  itemAmount: instance.template.pricePerGymnast * gymnastIds.length,
});
```

In the booking creation loop (around line 386), update the `BookingLine.amount`:

```js
lines: {
  create: item.gymnastIds.map(id => ({ gymnastId: id, amount: item.pricePerGymnast })),
},
```

- [ ] **Step 7: Fix `POST /combined` in `bookings.js`**

In the validation loop, update the `validatedSessions.push(...)` call (around line 670):

```js
validatedSessions.push({
  sessionInstanceId,
  gymnastIds,
  pricePerGymnast: instance.template.pricePerGymnast,
  itemAmount: instance.template.pricePerGymnast * gymnastIds.length,
});
```

In the booking creation loop (around line 748), update the `BookingLine.amount`:

```js
lines: { create: item.gymnastIds.map(id => ({ gymnastId: id, amount: item.pricePerGymnast })) },
```

- [ ] **Step 8: Fix cancellation credit (around line 536)**

Change the lambda to capture `line` and use `line.amount`:

```js
// Was:
...booking.lines.map(() =>
  prisma.credit.create({
    data: {
      userId: booking.userId,
      amount: 600,
      expiresAt,
      sourceBookingId: booking.id,
    },
  })
),

// Change to:
...booking.lines.map((line) =>
  prisma.credit.create({
    data: {
      userId: booking.userId,
      amount: line.amount,
      expiresAt,
      sourceBookingId: booking.id,
    },
  })
),
```

- [ ] **Step 9: Confirm `PRICE_PER_GYMNAST_PENCE` is unused before removing**

```bash
cd backend && grep -rn "PRICE_PER_GYMNAST_PENCE" .
```

Expected: only one result — the declaration in `bookings.js` itself. If any other file references it, do not remove it yet and investigate.

- [ ] **Step 10: Remove the now-unused `PRICE_PER_GYMNAST_PENCE` constant (line 58)**

Delete the line:
```js
const PRICE_PER_GYMNAST_PENCE = 600; // £6.00
```

- [ ] **Step 11: Run all booking tests**

```bash
cd backend && npx jest --testPathPattern="parent/bookings" --no-coverage 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 12: Run full test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 13: Commit**

```bash
git add backend/routes/booking/bookings.js backend/__tests__/helpers/seed.js backend/__tests__/parent/bookings.test.js
git commit -m "feat: use template pricePerGymnast in booking routes, fix cancellation credit amount"
```

---

## Chunk 2: Frontend

### Task 5: Add price field to SessionTemplates form

**Files:**
- Modify: `frontend/src/pages/booking/admin/SessionTemplates.js`

- [ ] **Step 1: Add `pricePerGymnast` to `EMPTY_FORM`**

Change:

```js
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', information: '' };
```

To:

```js
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', pricePerGymnast: '6', minAge: '', information: '' };
```

(`'6'` = £6.00, stored as pounds in the form.)

- [ ] **Step 2: Update `openEdit` to populate price in pounds**

Change the `openEdit` function body from:

```js
setForm({
  dayOfWeek: String(t.dayOfWeek),
  startTime: t.startTime,
  endTime: t.endTime,
  openSlots: String(t.openSlots),
  minAge: t.minAge != null ? String(t.minAge) : '',
  information: t.information || '',
});
```

To:

```js
setForm({
  dayOfWeek: String(t.dayOfWeek),
  startTime: t.startTime,
  endTime: t.endTime,
  openSlots: String(t.openSlots),
  pricePerGymnast: String(t.pricePerGymnast / 100),
  minAge: t.minAge != null ? String(t.minAge) : '',
  information: t.information || '',
});
```

- [ ] **Step 3: Update `buildPayload` to convert pounds → pence**

Change the `buildPayload` function from:

```js
const buildPayload = () => ({
  dayOfWeek: parseInt(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  openSlots: parseInt(form.openSlots),
  minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
  information: form.information || null,
});
```

To:

```js
const buildPayload = () => ({
  dayOfWeek: parseInt(form.dayOfWeek),
  startTime: form.startTime,
  endTime: form.endTime,
  openSlots: parseInt(form.openSlots),
  pricePerGymnast: Math.round(parseFloat(form.pricePerGymnast) * 100),
  minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
  information: form.information || null,
});
```

- [ ] **Step 4: Add price input to the form**

Inside the form's grid div (after the Capacity input, before Min age), add:

```jsx
<label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
  Price per gymnast (£)
  <input
    type="number"
    min="0.01"
    step="0.01"
    value={form.pricePerGymnast}
    onChange={e => setForm(f => ({ ...f, pricePerGymnast: e.target.value }))}
    className="bk-input"
    required
  />
</label>
```

- [ ] **Step 5: Show price in the template list row**

In the template list row, update the detail line from:

```jsx
<div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.15rem' }}>
  {t.openSlots} slots{t.minAge ? ` · ${t.minAge}+` : ''}
  {t.information && <span> &middot; <em>Has info text</em></span>}
</div>
```

To:

```jsx
<div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.15rem' }}>
  {t.openSlots} slots · £{(t.pricePerGymnast / 100).toFixed(2)}
  {t.minAge ? ` · ${t.minAge}+` : ''}
  {t.information && <span> &middot; <em>Has info text</em></span>}
</div>
```

- [ ] **Step 6: Manually verify in browser**

1. Open the Booking Admin page → Session Templates
2. Click "New Template" — confirm Price per gymnast field shows with default £6.00
3. Create a template with £8.00 — confirm it saves and shows "£8.00" in the list
4. Click Edit on that template — confirm the price field shows "8" (not "800")
5. Change to £5.50 and save — confirm list shows "£5.50"

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/booking/admin/SessionTemplates.js
git commit -m "feat: add pricePerGymnast field to session template form and list"
```

---

### Task 6: Fix cart total in BookingCalendar

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`

- [ ] **Step 1: Update cart total calculation**

In `BookingCalendar.js`, find:

```js
const cartTotalSlots = cartEntries.reduce((sum, [, g]) => sum + g.length, 0);
const cartTotalAmount = cartTotalSlots * 600;
```

Replace with:

```js
const cartTotalSlots = cartEntries.reduce((sum, [, g]) => sum + g.length, 0);
const cartTotalAmount = cartEntries.reduce((sum, [sessionId, gymnasts]) => {
  const session = sessions.find(s => s.id === sessionId);
  const price = session?.pricePerGymnast ?? 600;
  return sum + price * gymnasts.length;
}, 0);
```

- [ ] **Step 2: Manually verify in browser**

1. Open the parent booking calendar
2. Add a session with a non-default price (e.g. £8.00) to the cart
3. Confirm the cart bar shows the correct total (e.g. "1 slot · £8.00")
4. Add a second session with a different price — confirm combined total is correct

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/BookingCalendar.js
git commit -m "feat: calculate cart total using per-session pricePerGymnast"
```

---

### Final: Push

- [ ] Push all commits

```bash
git push
```
