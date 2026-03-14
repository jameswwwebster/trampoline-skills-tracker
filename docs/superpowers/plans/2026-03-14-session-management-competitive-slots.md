# Session Management & Competitive Slots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a competitive slots cap with commitment waiting list to session templates, and promote "Session Templates" to a standalone "Session Management" page with a per-template commitments panel.

**Architecture:** Additive Prisma schema changes (new `competitiveSlots` field and `WAITLISTED` status), cap enforcement in the commitments route, then frontend changes: new route, nav link, removal of the embedded collapsible from BookingAdmin, and a commitments panel in SessionTemplates.js.

**Tech Stack:** Prisma 5, PostgreSQL, Express, React 18, node-cron is not involved.

---

## Chunk 1: Backend

### Task 1: Schema changes and migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp_a>_add_competitive_slots/migration.sql`
- Create: `backend/prisma/migrations/<timestamp_b>_add_waitlisted_status/migration.sql`

- [ ] **Step 1: Update schema.prisma**

In `backend/prisma/schema.prisma`, make two changes:

**Add `competitiveSlots` to `SessionTemplate`** (after `openSlots`):
```prisma
// Before:
openSlots       Int               @default(12)

// After:
openSlots       Int               @default(12)
competitiveSlots Int?
```

**Add `WAITLISTED` to `CommitmentStatus` enum**:
```prisma
// Before:
enum CommitmentStatus {
  ACTIVE
  PAUSED
}
// After:
enum CommitmentStatus {
  ACTIVE
  PAUSED
  WAITLISTED
}
```

- [ ] **Step 2: Create migration A — add the column**

```bash
cd backend && npx prisma migrate dev --create-only --name add_competitive_slots
```

This generates a migration file. **Replace the entire generated SQL** with:

```sql
ALTER TABLE "session_templates" ADD COLUMN "competitiveSlots" INTEGER;
```

- [ ] **Step 3: Create migration B — add the enum value**

```bash
npx prisma migrate dev --create-only --name add_waitlisted_status
```

This generates a second migration file. **Replace the entire generated SQL** with:

```sql
ALTER TYPE "CommitmentStatus" ADD VALUE 'WAITLISTED';
```

`ALTER TYPE ... ADD VALUE` cannot run inside a Prisma-managed transaction alongside other statements. Splitting it into its own migration file ensures it runs in isolation.

- [ ] **Step 4: Apply both migrations**

```bash
npx prisma migrate dev
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 6: Run tests to verify nothing is broken**

```bash
npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add competitiveSlots to SessionTemplate and WAITLISTED to CommitmentStatus"
```

---

### Task 2: Update templates.js Joi schema

**Files:**
- Modify: `backend/routes/booking/templates.js`

- [ ] **Step 1: Add `competitiveSlots` to `templateSchema`**

In `backend/routes/booking/templates.js` line 10, the `templateSchema` object. Add `competitiveSlots` after the `minAge` line:

```js
// Before:
const templateSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  openSlots: Joi.number().integer().min(1).required(),
  pricePerGymnast: Joi.number().integer().min(1).optional().default(600),
  minAge: Joi.number().integer().min(0).allow(null).optional(),
  information: Joi.string().allow('', null).optional(),
  type: Joi.string().valid('TRAMPOLINE', 'DMT').optional().default('TRAMPOLINE'),
});

// After:
const templateSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  openSlots: Joi.number().integer().min(1).required(),
  pricePerGymnast: Joi.number().integer().min(1).optional().default(600),
  minAge: Joi.number().integer().min(0).allow(null).optional(),
  competitiveSlots: Joi.number().integer().min(1).allow(null).optional(),
  information: Joi.string().allow('', null).optional(),
  type: Joi.string().valid('TRAMPOLINE', 'DMT').optional().default('TRAMPOLINE'),
});
```

- [ ] **Step 2: Verify the server still parses**

```bash
cd backend && node -e "require('./routes/booking/templates')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Add a test for `competitiveSlots`**

In `backend/__tests__/booking.templates.test.js`, find the end of the `describe('POST /api/booking/templates'` block and add before its closing `});`:

```js
  it('accepts and returns competitiveSlots', async () => {
    const res = await request(app)
      .post('/api/booking/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dayOfWeek: 3, startTime: '14:00', endTime: '15:00', openSlots: 12, pricePerGymnast: 600, competitiveSlots: 6 });

    expect(res.status).toBe(201);
    expect(res.body.competitiveSlots).toBe(6);
  });

  it('accepts null competitiveSlots (no cap)', async () => {
    const res = await request(app)
      .post('/api/booking/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dayOfWeek: 4, startTime: '14:00', endTime: '15:00', openSlots: 12, pricePerGymnast: 600, competitiveSlots: null });

    expect(res.status).toBe(201);
    expect(res.body.competitiveSlots).toBeNull();
  });
```

- [ ] **Step 4: Run the templates test**

```bash
cd backend && npm test -- --testPathPattern="booking.templates" --forceExit 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/booking/templates.js backend/__tests__/booking.templates.test.js
git commit -m "feat: add competitiveSlots to template Joi schema"
```

---

### Task 3: Update commitments.js — cap enforcement, transitions, tests

**Files:**
- Modify: `backend/routes/booking/commitments.js`
- Modify: `backend/__tests__/booking.commitments.test.js`

- [ ] **Step 1: Write the failing tests**

At the end of `backend/__tests__/booking.commitments.test.js` (after the last `});`), add:

```js
describe('POST /api/commitments — competitive slots cap', () => {
  let cappedTemplate;

  beforeAll(async () => {
    const { template: t } = await createSession(club, undefined, { competitiveSlots: 1 });
    cappedTemplate = t;
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: cappedTemplate.id } });
  });

  it('creates as ACTIVE when under cap', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: cappedTemplate.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('creates as WAITLISTED when at cap', async () => {
    // Fill the cap
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate.id, createdById: coach.id, status: 'ACTIVE' },
    });

    const gymnast2 = await createGymnast(club, parent);
    await createMembership(gymnast2, club);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast2.id, templateId: cappedTemplate.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITLISTED');
  });

  it('creates as ACTIVE when no cap is set', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('audit action is commitment.waitlisted when waitlisted', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const gymnast3 = await createGymnast(club, parent);
    await createMembership(gymnast3, club);

    await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast3.id, templateId: cappedTemplate.id });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.waitlisted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ gymnastId: gymnast3.id, templateId: cappedTemplate.id });
  });
});

describe('PATCH /api/commitments/:id/status — transitions', () => {
  let cappedTemplate2;

  beforeAll(async () => {
    const { template: t } = await createSession(club, undefined, { competitiveSlots: 1 });
    cappedTemplate2 = t;
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: cappedTemplate2.id } });
  });

  it('promotes WAITLISTED -> ACTIVE when slot available', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('returns 422 promoting WAITLISTED -> ACTIVE when cap is full', async () => {
    const gymnast4 = await createGymnast(club, parent);
    await createMembership(gymnast4, club);

    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast4.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/No competitive slot/);
  });

  it('returns 422 resuming PAUSED -> ACTIVE when cap is full', async () => {
    const gymnast5 = await createGymnast(club, parent);
    await createMembership(gymnast5, club);

    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const paused = await prisma.commitment.create({
      data: { gymnastId: gymnast5.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'PAUSED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${paused.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Competitive slots are full/);
  });

  it('returns 422 for WAITLISTED -> PAUSED transition', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Invalid status transition/);
  });

  it('audit action is commitment.promoted for WAITLISTED -> ACTIVE', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.promoted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ templateId: cappedTemplate2.id });
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern="booking.commitments" --forceExit 2>&1 | tail -15
```

Expected: The new `describe` blocks FAIL.

- [ ] **Step 3: Implement cap enforcement in `POST /api/commitments`**

In `backend/routes/booking/commitments.js`, find the existing `POST /` handler. Replace the template validation and commitment creation section:

```js
// Before (lines ~90-105 approximately):
    // Validate template belongs to caller's club
    const template = await prisma.sessionTemplate.findFirst({
      where: { id: templateId, clubId: req.user.clubId },
    });
    if (!template) return res.status(400).json({ error: 'Session template not found' });

    // Check for existing commitment (unique constraint)
    const existing = await prisma.commitment.findUnique({
      where: { gymnastId_templateId: { gymnastId, templateId } },
    });
    if (existing) return res.status(409).json({ error: 'Commitment already exists for this gymnast and template' });

    const commitment = await prisma.commitment.create({
      data: { gymnastId, templateId, createdById: req.user.id },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.create', entityType: 'Commitment', entityId: commitment.id,
      metadata: { gymnastId, templateId },
    });

// After:
    // Validate template belongs to caller's club
    const template = await prisma.sessionTemplate.findFirst({
      where: { id: templateId, clubId: req.user.clubId },
      select: { id: true, competitiveSlots: true },
    });
    if (!template) return res.status(400).json({ error: 'Session template not found' });

    // Check for existing commitment (unique constraint)
    const existing = await prisma.commitment.findUnique({
      where: { gymnastId_templateId: { gymnastId, templateId } },
    });
    if (existing) return res.status(409).json({ error: 'Commitment already exists for this gymnast and template' });

    // Determine status: WAITLISTED if competitive slots cap is reached
    let commitmentStatus = 'ACTIVE';
    if (template.competitiveSlots !== null) {
      const activeCount = await prisma.commitment.count({
        where: { templateId, status: 'ACTIVE' },
      });
      if (activeCount >= template.competitiveSlots) {
        commitmentStatus = 'WAITLISTED';
      }
    }

    const commitment = await prisma.commitment.create({
      data: { gymnastId, templateId, createdById: req.user.id, status: commitmentStatus },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: commitmentStatus === 'WAITLISTED' ? 'commitment.waitlisted' : 'commitment.create',
      entityType: 'Commitment', entityId: commitment.id,
      metadata: { gymnastId, templateId },
    });
```

- [ ] **Step 4: Implement transition logic in `PATCH /:id/status`**

In `backend/routes/booking/commitments.js`, find the `PATCH /:id/status` handler. Replace the entire try block body:

```js
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or PAUSED' });
    }

    const commitment = await prisma.commitment.findUnique({
      where: { id: req.params.id },
      include: { gymnast: true },
    });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (commitment.gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const current = commitment.status;

    // Disallow WAITLISTED -> PAUSED
    if (current === 'WAITLISTED' && status === 'PAUSED') {
      return res.status(422).json({ error: 'Invalid status transition' });
    }

    // Cap check for any transition that activates a commitment
    if (status === 'ACTIVE' && current !== 'ACTIVE') {
      const template = await prisma.sessionTemplate.findUnique({
        where: { id: commitment.templateId },
        select: { competitiveSlots: true },
      });
      if (template && template.competitiveSlots !== null) {
        const activeCount = await prisma.commitment.count({
          where: { templateId: commitment.templateId, status: 'ACTIVE' },
        });
        if (activeCount >= template.competitiveSlots) {
          const msg = current === 'WAITLISTED'
            ? 'No competitive slot available'
            : 'Competitive slots are full — promote a waitlisted gymnast first or increase the cap';
          return res.status(422).json({ error: msg });
        }
      }
    }

    const isPromotion = current === 'WAITLISTED' && status === 'ACTIVE';
    const data = status === 'PAUSED'
      ? { status: 'PAUSED', pausedAt: new Date(), pausedById: req.user.id }
      : { status: 'ACTIVE', pausedAt: null, pausedById: null };

    const updated = await prisma.commitment.update({ where: { id: req.params.id }, data });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: isPromotion ? 'commitment.promoted' : 'commitment.status',
      entityType: 'Commitment', entityId: req.params.id,
      metadata: { status, gymnastId: commitment.gymnast.id, templateId: commitment.templateId },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
```

- [ ] **Step 5: Run the commitments tests**

```bash
cd backend && npm test -- --testPathPattern="booking.commitments" --forceExit 2>&1 | tail -15
```

Expected: All pass.

- [ ] **Step 6: Run full test suite**

```bash
npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/booking/commitments.js backend/__tests__/booking.commitments.test.js
git commit -m "feat: enforce competitive slots cap and add WAITLISTED transition logic"
```

---

## Chunk 2: Frontend

### Task 4: Nav, routing, and BookingAdmin cleanup

**Files:**
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/pages/booking/BookingLayout.js`
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

- [ ] **Step 1: Add the route in App.js**

In `frontend/src/App.js`, add the import after the other admin imports (around line 66):

```js
import SessionManagement from './pages/booking/admin/SessionTemplates';
```

Then in the routes section, after `<Route path="admin/closures" element={<AdminClosures />} />` (around line 208):

```jsx
<Route path="admin/session-management" element={<SessionManagement />} />
```

- [ ] **Step 2: Add "Session Management" to the Sessions dropdown in BookingLayout.js**

In `frontend/src/pages/booking/BookingLayout.js`, find the Sessions dropdown (around line 209):

```jsx
// Before:
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/admin" end className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Sessions</NavLink>
                    <NavLink to="/booking/admin/closures" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Closures</NavLink>
                  </div>

// After:
                  <div className="booking-layout__dropdown-menu">
                    <NavLink to="/booking/admin" end className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Sessions</NavLink>
                    <NavLink to="/booking/admin/closures" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Closures</NavLink>
                    <NavLink to="/booking/admin/session-management" className="booking-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Session Management</NavLink>
                  </div>
```

- [ ] **Step 3: Remove the embedded SessionTemplates collapsible from BookingAdmin.js**

In `frontend/src/pages/booking/admin/BookingAdmin.js`, remove:

1. The import at line 4:
```js
import SessionTemplates from './SessionTemplates';
```

2. The state at line 384:
```js
  const [templatesOpen, setTemplatesOpen] = useState(false);
```

3. The entire "Session Templates" section (lines ~546-564):
```jsx
      {/* Session Templates */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--booking-border)', paddingTop: '1.25rem' }}>
        <button
          onClick={() => setTemplatesOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '1rem', fontWeight: 700, color: 'var(--booking-text-on-light)',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: templatesOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          Session Templates
        </button>
        {templatesOpen && (
          <div style={{ marginTop: '1rem' }}>
            <SessionTemplates />
          </div>
        )}
      </div>
```

- [ ] **Step 4: Update the standing slots panel in BookingAdmin.js to exclude WAITLISTED commitments**

In `frontend/src/pages/booking/admin/BookingAdmin.js`, in the `SessionDetailPanel` component, the standing slots list currently shows all commitments. Filter out WAITLISTED entries:

```jsx
// Before (around line 249):
          {!slotsLoading && standingSlots && standingSlots.map(c => (

// After:
          {!slotsLoading && standingSlots && standingSlots.filter(c => c.status !== 'WAITLISTED').map(c => (
```

Also update the active commitments count used in the slot arithmetic. The `sessionDetail.activeCommitments` value comes from the API and is computed server-side. Before relying on it, verify in `backend/routes/booking/sessions.js` (or whichever route returns `activeCommitments`) that the query counts only `status: 'ACTIVE'` commitments. If it counts all statuses, add a `where: { status: 'ACTIVE' }` filter. No frontend change is needed as long as the server value is correct.

- [ ] **Step 5: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.` or `The build folder is ready.`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js frontend/src/pages/booking/BookingLayout.js frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: add Session Management route and nav link, remove embedded collapsible"
```

---

### Task 5: Session Management page — competitive slots field and commitments panel

**Files:**
- Modify: `frontend/src/pages/booking/admin/SessionTemplates.js`

This task adds:
1. `competitiveSlots` field to `EMPTY_FORM`, `openEdit`, `buildPayload`, and the form UI
2. State and handlers for the per-template commitments panel
3. The commitments panel UI inside each template card
4. An import of `bookingApi`

- [ ] **Step 1: Add `bookingApi` import**

In `frontend/src/pages/booking/admin/SessionTemplates.js` line 5, after the existing imports:

```js
// Before:
import { getTemplates, createTemplate, updateTemplate, toggleTemplate, deleteTemplate } from '../../../utils/bookingApi';

// After:
import { getTemplates, createTemplate, updateTemplate, toggleTemplate, deleteTemplate, bookingApi } from '../../../utils/bookingApi';
```

- [ ] **Step 2: Add `competitiveSlots` to EMPTY_FORM**

```js
// Before:
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', pricePerGymnast: '6', information: '', type: 'TRAMPOLINE' };

// After:
const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', competitiveSlots: '', pricePerGymnast: '6', information: '', type: 'TRAMPOLINE' };
```

- [ ] **Step 3: Add `competitiveSlots` to `openEdit`**

```js
// Before:
    setForm({
      dayOfWeek: String(t.dayOfWeek),
      startTime: t.startTime,
      endTime: t.endTime,
      openSlots: String(t.openSlots),
      minAge: t.minAge != null ? String(t.minAge) : '',
      pricePerGymnast: String(t.pricePerGymnast / 100),
      information: t.information || '',
      type: t.type,
    });

// After:
    setForm({
      dayOfWeek: String(t.dayOfWeek),
      startTime: t.startTime,
      endTime: t.endTime,
      openSlots: String(t.openSlots),
      minAge: t.minAge != null ? String(t.minAge) : '',
      competitiveSlots: t.competitiveSlots != null ? String(t.competitiveSlots) : '',
      pricePerGymnast: String(t.pricePerGymnast / 100),
      information: t.information || '',
      type: t.type,
    });
```

- [ ] **Step 4: Add `competitiveSlots` to `buildPayload`**

```js
// Before:
  const buildPayload = () => ({
    dayOfWeek: parseInt(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    openSlots: parseInt(form.openSlots),
    pricePerGymnast: Math.round(parseFloat(form.pricePerGymnast) * 100) || 600,
    minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
    information: form.information || null,
    type: form.type,
  });

// After:
  const buildPayload = () => ({
    dayOfWeek: parseInt(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    openSlots: parseInt(form.openSlots),
    pricePerGymnast: Math.round(parseFloat(form.pricePerGymnast) * 100) || 600,
    minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
    competitiveSlots: form.competitiveSlots !== '' ? parseInt(form.competitiveSlots) : null,
    information: form.information || null,
    type: form.type,
  });
```

- [ ] **Step 5: Add commitments panel state and handlers**

After the existing state declarations (after `const [modal, setModal] = useState(null);` and before `const load = useCallback`) add:

```js
  const [openPanels, setOpenPanels] = useState({});
  const [panelData, setPanelData] = useState({});

  const loadPanel = useCallback(async (templateId) => {
    setPanelData(prev => ({ ...prev, [templateId]: { ...(prev[templateId] || {}), loading: true, error: null } }));
    try {
      const { data } = await bookingApi.getCommitmentsForTemplate(templateId);
      setPanelData(prev => ({ ...prev, [templateId]: { commitments: data, loading: false, error: null } }));
    } catch {
      setPanelData(prev => ({ ...prev, [templateId]: { commitments: [], loading: false, error: 'Failed to load' } }));
    }
  }, []);

  const togglePanel = (templateId) => {
    const isOpening = !openPanels[templateId];
    setOpenPanels(prev => ({ ...prev, [templateId]: isOpening }));
    if (isOpening) loadPanel(templateId);
  };

  const handlePauseCommitment = async (templateId, commitmentId) => {
    try {
      await bookingApi.updateCommitmentStatus(commitmentId, 'PAUSED');
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to pause commitment');
    }
  };

  const handleActivateCommitment = async (templateId, commitmentId) => {
    try {
      await bookingApi.updateCommitmentStatus(commitmentId, 'ACTIVE');
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to activate commitment');
    }
  };

  const handleRemoveCommitment = async (templateId, commitmentId) => {
    if (!window.confirm('Remove this commitment?')) return;
    try {
      await bookingApi.deleteCommitment(commitmentId);
      loadPanel(templateId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove commitment');
    }
  };
```

- [ ] **Step 6: Add the `competitiveSlots` form field**

In the form grid (after the `Min age (optional)` label block, around line 249), add:

```jsx
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Competitive slots (optional)
              <input type="number" min="1" value={form.competitiveSlots} onChange={e => setForm(f => ({ ...f, competitiveSlots: e.target.value }))} className="bk-input" placeholder="No cap" />
            </label>
```

Place this immediately after the `Min age (optional)` label block and before the `Price per gymnast` label block.

- [ ] **Step 7: Update the page heading**

```jsx
// Before:
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--booking-text-on-light)' }}>Session Templates</h2>

// After:
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--booking-text-on-light)' }}>Session Management</h2>
```

- [ ] **Step 8: Add "View slots" button and panel to each template card**

In the template list, find the buttons div inside each template card (around line 303):

```jsx
// Before:
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => openEdit(t)}>Edit</button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => handleToggle(t)}>
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem', color: 'var(--booking-danger)' }} onClick={() => handleDelete(t)}>Delete</button>
              </div>

// After:
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => togglePanel(t.id)}>
                  {openPanels[t.id] ? 'Hide slots' : 'View slots'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => openEdit(t)}>Edit</button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => handleToggle(t)}>
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem', color: 'var(--booking-danger)' }} onClick={() => handleDelete(t)}>Delete</button>
              </div>
              {openPanels[t.id] && (() => {
                const pd = panelData[t.id];
                const commitments = pd?.commitments || [];
                const active = commitments.filter(c => c.status === 'ACTIVE').sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
                const paused = commitments.filter(c => c.status === 'PAUSED').sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
                const waitlisted = commitments.filter(c => c.status === 'WAITLISTED').sort((a, b) => a.createdAt < b.createdAt ? -1 : (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : 1));
                const hasSlotAvailable = t.competitiveSlots !== null && active.length < t.competitiveSlots && waitlisted.length > 0;
                const slotsLabel = t.competitiveSlots !== null ? `${active.length} / ${t.competitiveSlots} competitive slots` : null;
                return (
                  <div style={{ width: '100%', borderTop: '1px solid var(--booking-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    {pd?.loading && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.85rem', margin: 0 }}>Loading...</p>}
                    {pd?.error && <p style={{ color: 'var(--booking-danger)', fontSize: '0.85rem', margin: 0 }}>{pd.error}</p>}
                    {pd && !pd.loading && !pd.error && (
                      <>
                        {slotsLabel && (
                          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--booking-text-muted)' }}>{slotsLabel}</span>
                            {hasSlotAvailable && (
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: 'var(--booking-success)', borderRadius: 4, padding: '0.1rem 0.5rem' }}>
                                {t.competitiveSlots - active.length} slot{t.competitiveSlots - active.length !== 1 ? 's' : ''} available \u2014 {waitlisted.length} on waitlist
                              </span>
                            )}
                          </div>
                        )}
                        {commitments.length === 0 && <p style={{ color: 'var(--booking-text-muted)', fontSize: '0.85rem', margin: 0 }}>No commitments yet.</p>}
                        {active.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Active</div>
                            {active.map(c => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                <span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button className="bk-btn bk-btn--sm" onClick={() => handlePauseCommitment(t.id, c.id)}>Pause</button>
                                  <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {paused.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Paused</div>
                            {paused.map(c => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                <span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button className="bk-btn bk-btn--sm" onClick={() => handleActivateCommitment(t.id, c.id)}>Activate</button>
                                  <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {waitlisted.length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--booking-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Waitlist</div>
                            {waitlisted.map((c, idx) => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--booking-bg-light)', fontSize: '0.85rem' }}>
                                <span><span style={{ color: 'var(--booking-text-muted)', marginRight: '0.4rem' }}>#{idx + 1}</span>{c.gymnast.firstName} {c.gymnast.lastName}</span>
                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button
                                    className="bk-btn bk-btn--sm"
                                    disabled={!hasSlotAvailable && !(t.competitiveSlots === null)}
                                    onClick={() => handleActivateCommitment(t.id, c.id)}
                                  >
                                    Promote
                                  </button>
                                  <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={() => handleRemoveCommitment(t.id, c.id)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
```

- [ ] **Step 9: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/booking/admin/SessionTemplates.js
git commit -m "feat: add competitive slots field and per-template commitments panel to Session Management"
```

---

### Task 6: Update AdminMembers.js — Waitlisted badge

**Files:**
- Modify: `frontend/src/pages/booking/admin/AdminMembers.js`

- [ ] **Step 1: Add Waitlisted badge to the commitment status label**

In `frontend/src/pages/booking/admin/AdminMembers.js` (around line 612), find the commitment status span:

```jsx
// Before:
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: c.status === 'ACTIVE' ? 'var(--booking-success)' : 'var(--booking-text-muted)', fontWeight: 600 }}>
                      {c.status === 'ACTIVE' ? 'Active' : 'Paused'}
                    </span>

// After:
                    <span style={{
                      marginLeft: '0.5rem', fontSize: '0.78rem', fontWeight: 600,
                      color: c.status === 'ACTIVE' ? 'var(--booking-success)' : c.status === 'WAITLISTED' ? '#e67e22' : 'var(--booking-text-muted)',
                    }}>
                      {c.status === 'ACTIVE' ? 'Active' : c.status === 'WAITLISTED' ? 'Waitlisted' : 'Paused'}
                    </span>
```

- [ ] **Step 2: Hide the Pause/Resume toggle button for WAITLISTED commitments**

The existing toggle button calls `handleToggleCommitmentStatus` which sends `PAUSED` for ACTIVE or `ACTIVE` for PAUSED. For WAITLISTED commitments, this button should not appear (the status transition is not valid).

```jsx
// Before:
                    <button className="bk-btn bk-btn--sm" onClick={() => handleToggleCommitmentStatus(c)}>
                      {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                    </button>

// After:
                    {c.status !== 'WAITLISTED' && (
                      <button className="bk-btn bk-btn--sm" onClick={() => handleToggleCommitmentStatus(c)}>
                        {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    )}
```

- [ ] **Step 3: Verify the app builds**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Run full backend test suite one final time**

```bash
cd backend && npm test -- --forceExit 2>&1 | tail -8
```

Expected: All suites pass.

- [ ] **Step 5: Commit and push**

```bash
git add frontend/src/pages/booking/admin/AdminMembers.js
git commit -m "feat: show Waitlisted badge and hide Pause button for waitlisted commitments in AdminMembers"
git push
```
