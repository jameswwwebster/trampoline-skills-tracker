# Trampoline Session Type & DMT Visibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `STANDARD` session type to `TRAMPOLINE` throughout the stack, label Trampoline sessions in the booking UI, and hide DMT sessions from parents with no DMT-approved gymnasts.

**Architecture:** Additive Postgres enum rename via migration, then update all string references in backend routes/tests and frontend components. DMT visibility filtering added to the sessions list route. No schema shape changes beyond the enum rename.

**Tech Stack:** Prisma 5, PostgreSQL, Express, React 18.

---

## Chunk 1: Backend

### Task 1: Rename enum in schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_rename_standard_to_trampoline/migration.sql` (auto-generated)

- [ ] **Step 1: Update schema.prisma**

In `backend/prisma/schema.prisma`, make two changes:

Change the `SessionTemplate.type` default:
```prisma
// Before:
type  SessionType  @default(STANDARD)
// After:
type  SessionType  @default(TRAMPOLINE)
```

Change the enum definition:
```prisma
// Before:
enum SessionType {
  STANDARD
  DMT
}
// After:
enum SessionType {
  TRAMPOLINE
  DMT
}
```

- [ ] **Step 2: Create the migration**

```bash
cd backend && npx prisma migrate dev --name rename_standard_to_trampoline
```

Prisma will generate a migration file. **Edit the generated `.sql` file** to replace whatever Prisma generates with exactly this single statement:

```sql
ALTER TYPE "SessionType" RENAME VALUE 'STANDARD' TO 'TRAMPOLINE';
```

Then re-run to apply it:

```bash
npx prisma migrate dev
```

Expected: `✅ Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✅ Generated Prisma Client`

- [ ] **Step 4: Verify tests still pass**

```bash
npm test -- --forceExit 2>&1 | tail -8
```

Expected: All test suites pass (the enum rename is backward-safe — all existing DB rows used `STANDARD`, now named `TRAMPOLINE`).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: rename SessionType.STANDARD to TRAMPOLINE in schema and migration"
```

---

### Task 2: Update backend routes and tests

**Files:**
- Modify: `backend/routes/booking/templates.js`
- Modify: `backend/__tests__/booking.templates.test.js`
- Modify: `backend/__tests__/booking.bookings.test.js`

- [ ] **Step 1: Update Joi schema in templates.js**

In `backend/routes/booking/templates.js` line 18:

```js
// Before:
type: Joi.string().valid('STANDARD', 'DMT').optional().default('STANDARD'),
// After:
type: Joi.string().valid('TRAMPOLINE', 'DMT').optional().default('TRAMPOLINE'),
```

- [ ] **Step 2: Update booking.templates.test.js**

Three changes in `backend/__tests__/booking.templates.test.js`:

```js
// Line 79 — test description:
// Before:
it('defaults type to STANDARD when not provided', async () => {
// After:
it('defaults type to TRAMPOLINE when not provided', async () => {

// Line 86 — assertion:
// Before:
expect(res.body.type).toBe('STANDARD');
// After:
expect(res.body.type).toBe('TRAMPOLINE');

// Line 91 — test description:
// Before:
it('updates type from STANDARD to DMT', async () => {
// After:
it('updates type from TRAMPOLINE to DMT', async () => {
```

- [ ] **Step 3: Update booking.bookings.test.js**

Two changes in `backend/__tests__/booking.bookings.test.js`:

```js
// Line 164 — test description:
// Before:
it('POST / — STANDARD session does not apply DMT gate', async () => {
// After:
it('POST / — TRAMPOLINE session does not apply DMT gate', async () => {

// Line 165 — type value:
// Before:
const { instance } = await createSession(dmtClub, undefined, { type: 'STANDARD' });
// After:
const { instance } = await createSession(dmtClub, undefined, { type: 'TRAMPOLINE' });
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/booking/templates.js backend/__tests__/booking.templates.test.js backend/__tests__/booking.bookings.test.js
git commit -m "feat: update STANDARD → TRAMPOLINE string references in routes and tests"
```

---

### Task 3: DMT visibility filtering in sessions.js

**Files:**
- Modify: `backend/routes/booking/sessions.js`
- Modify: `backend/__tests__/booking.sessions.type.test.js`

The `GET /api/booking/sessions` route currently returns all session instances. Add filtering: if the requesting user is a `PARENT` with no DMT-approved gymnasts, strip DMT sessions from the response.

- [ ] **Step 1: Write the failing test**

Add to `backend/__tests__/booking.sessions.type.test.js` (append after the last `});`):

```js
describe('GET /api/booking/sessions — DMT visibility for parents', () => {
  let visClub, dmtParent, dmtParentToken, noApprovalParent, noApprovalToken;
  let dmtInstance, trampolineInstance;

  beforeAll(async () => {
    const { createGymnast, createMembership } = require('./helpers/seed');
    visClub = await createTestClub();

    // Parent whose gymnast IS DMT approved
    dmtParent = await createParent(visClub, { email: `dmt-vis-${Date.now()}@test.tl` });
    const dmtGymnast = await createGymnast(visClub, dmtParent);
    await prisma.gymnast.update({ where: { id: dmtGymnast.id }, data: { dmtApproved: true } });
    dmtParentToken = tokenFor(dmtParent);

    // Parent whose gymnast is NOT DMT approved
    noApprovalParent = await createParent(visClub, { email: `no-dmt-${Date.now()}@test.tl` });
    await createGymnast(visClub, noApprovalParent);
    noApprovalToken = tokenFor(noApprovalParent);

    // Create one DMT session and one Trampoline session in the same month
    const { instance: di } = await createSession(visClub, undefined, { type: 'DMT' });
    const { instance: ti } = await createSession(visClub, undefined, { type: 'TRAMPOLINE' });
    dmtInstance = di;
    trampolineInstance = ti;
  });

  afterAll(async () => {
    await prisma.sessionInstance.deleteMany({ where: { templateId: { in: [dmtInstance.templateId, trampolineInstance.templateId] } } });
    await prisma.sessionTemplate.deleteMany({ where: { id: { in: [dmtInstance.templateId, trampolineInstance.templateId] } } });
  });

  it('parent with no DMT-approved gymnasts does not see DMT sessions', async () => {
    const d = dmtInstance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${noApprovalToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(s => s.id);
    expect(ids).not.toContain(dmtInstance.id);
    expect(ids).toContain(trampolineInstance.id);
  });

  it('parent with a DMT-approved gymnast sees DMT sessions', async () => {
    const d = dmtInstance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${dmtParentToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(s => s.id);
    expect(ids).toContain(dmtInstance.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- --testPathPattern="booking.sessions.type" --forceExit 2>&1 | tail -15
```

Expected: The two new tests FAIL (DMT sessions not yet filtered).

- [ ] **Step 3: Add DMT filtering to sessions.js**

In `backend/routes/booking/sessions.js`, after the `result` array is built (after the `await Promise.all(...)` block, before `res.json(result)`), insert:

```js
    // Filter DMT sessions for parents with no approved gymnasts
    let visibleResult = result;
    if (req.user.role === 'PARENT') {
      const myGymnasts = await prisma.gymnast.findMany({
        where: {
          clubId,
          OR: [
            { userId: req.user.id },
            { guardians: { some: { id: req.user.id } } },
          ],
        },
        select: { dmtApproved: true },
      });
      const hasDmtApproval = myGymnasts.some(g => g.dmtApproved);
      if (!hasDmtApproval) {
        visibleResult = result.filter(s => s.type !== 'DMT');
      }
    }

    res.json(visibleResult);
```

Also remove the existing `res.json(result);` line that was at the end of the try block (it's now replaced by `res.json(visibleResult)`).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern="booking.sessions.type" --forceExit 2>&1 | tail -15
```

Expected: All tests in the file pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/sessions.js backend/__tests__/booking.sessions.type.test.js
git commit -m "feat: filter DMT sessions for parents with no approved gymnasts"
```

---

## Chunk 2: Frontend

### Task 4: Frontend label updates

**Files:**
- Modify: `frontend/src/pages/booking/BookingCalendar.js`
- Modify: `frontend/src/pages/booking/admin/SessionTemplates.js`
- Modify: `frontend/src/pages/booking/admin/AdminMemberships.js`
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

No automated tests — all UI label changes, verified manually.

- [ ] **Step 1: Add Trampoline badge to BookingCalendar.js**

In `frontend/src/pages/booking/BookingCalendar.js`, find the DMT badge block (around line 142). Add a Trampoline badge immediately after it:

```jsx
// Before (existing DMT badge):
{s.type === 'DMT' && (
  <span style={{
    fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-accent)',
    border: '1px solid var(--booking-accent)', borderRadius: 3,
    padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
  }}>
    DMT
  </span>
)}

// After — add the Trampoline badge immediately after:
{s.type === 'DMT' && (
  <span style={{
    fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-accent)',
    border: '1px solid var(--booking-accent)', borderRadius: 3,
    padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
  }}>
    DMT
  </span>
)}
{s.type === 'TRAMPOLINE' && (
  <span style={{
    fontSize: '0.7rem', fontWeight: 700, color: 'var(--booking-accent)',
    border: '1px solid var(--booking-accent)', borderRadius: 3,
    padding: '0 4px', marginLeft: '0.4rem', lineHeight: 1.6,
  }}>
    Trampoline
  </span>
)}
```

- [ ] **Step 2: Update SessionTemplates.js**

Three changes in `frontend/src/pages/booking/admin/SessionTemplates.js`:

**a) Default form value (line 9):**
```js
// Before:
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', pricePerGymnast: '6', information: '', type: 'STANDARD' };
// After:
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', pricePerGymnast: '6', information: '', type: 'TRAMPOLINE' };
```

**b) Select option (line ~254):**
```jsx
// Before:
<option value="STANDARD">Standard</option>
// After:
<option value="TRAMPOLINE">Trampoline</option>
```

**c) Template list badge (line ~299):**
```jsx
// Before:
{t.type === 'DMT' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--booking-accent)' }}>DMT</span>}
// After:
{t.type === 'DMT' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--booking-accent)' }}>DMT</span>}
{t.type === 'TRAMPOLINE' && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--booking-accent)' }}>Trampoline</span>}
```

- [ ] **Step 3: Update AdminMemberships.js**

In `frontend/src/pages/booking/admin/AdminMemberships.js` (line ~131):

```jsx
// Before:
{label}{t.type === 'DMT' ? ' · DMT' : ''}
// After:
{label}{t.type === 'DMT' ? ' · DMT' : ' · Trampoline'}
```

- [ ] **Step 4: Update AdminMembers.js**

In `frontend/src/pages/booking/admin/AdminMembers.js` (line ~641):

```jsx
// Before:
return <option key={t.id} value={t.id}>{days[t.dayOfWeek]} {t.startTime}–{t.endTime}{t.type === 'DMT' ? ' · DMT' : ''}</option>;
// After:
return <option key={t.id} value={t.id}>{days[t.dayOfWeek]} {t.startTime}–{t.endTime}{t.type === 'DMT' ? ' · DMT' : ' · Trampoline'}</option>;
```

- [ ] **Step 5: Run full backend test suite one final time**

```bash
cd backend && npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 6: Commit and push**

```bash
git add frontend/src/pages/booking/BookingCalendar.js \
        frontend/src/pages/booking/admin/SessionTemplates.js \
        frontend/src/pages/booking/admin/AdminMemberships.js \
        frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: add Trampoline labels throughout booking UI"
git push
```
