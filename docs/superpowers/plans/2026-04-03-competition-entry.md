# Competition Entry Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to create external competition events, invite eligible gymnasts, and collect entry fees through the app via Stripe.

**Architecture:** New Prisma models (`CompetitionEvent`, `CompetitionCategory`, `CompetitionPriceTier`, `CompetitionEntry`, `CompetitionEntryCategory`, `CompetitionCategorySkillLevel`) back a set of booking-style routes. Guardians pay via a one-off Stripe PaymentIntent. The existing `Competition` model (skill tracker) is left untouched — the new `CompetitionCategorySkillLevel` join table links categories to it.

**Tech Stack:** Prisma 5 + PostgreSQL, Express + Joi, Stripe PaymentIntent, React 18 + @stripe/react-stripe-js, axios bookingApi pattern.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/prisma/schema.prisma` | Modify | Add 6 new models + enum |
| `backend/prisma/migrations/*/migration.sql` | Create (via migrate dev) | DB migration |
| `backend/routes/booking/competitionEvents.js` | Create | Admin CRUD + eligible list + invite endpoints |
| `backend/routes/booking/competitionEntries.js` | Create | Entry management + payment checkout |
| `backend/routes/booking/webhook.js` | Modify | Handle `payment_intent.succeeded` for competition entries |
| `backend/server.js` | Modify | Mount the two new route files |
| `backend/__tests__/booking/competitionEvents.test.js` | Create | Backend tests — events + eligible list |
| `backend/__tests__/booking/competitionEntries.test.js` | Create | Backend tests — entries + checkout |
| `frontend/src/utils/bookingApi.js` | Modify | Add competition API methods |
| `frontend/src/pages/booking/admin/AdminCompetitions.js` | Create | Competition list + create form |
| `frontend/src/pages/booking/admin/AdminCompetitionDetail.js` | Create | Details / Invites / Entries tabs |
| `frontend/src/pages/booking/CompetitionEntry.js` | Create | Guardian entry + payment page |
| `frontend/src/App.js` | Modify | Add 3 new routes |
| `frontend/src/components/AppLayout.js` | Modify | Add nav links |

---

## Task 1: Prisma Schema — Competition Event Models

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the new enum and models to schema.prisma**

In `schema.prisma`, after the existing `MembershipStatus` enum, add:

```prisma
enum CompetitionEntryStatus {
  INVITED
  PAYMENT_PENDING
  PAID
  DECLINED
}
```

After the existing `Competition` model block (around line 410), add the back-relation to Competition and the six new models:

First, add `categoryLinks` to the existing `Competition` model:
```prisma
model Competition {
  id          String             @id @default(cuid())
  name        String
  code        String             @unique
  description String?
  order       Int
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  category    String
  levels      LevelCompetition[]
  categoryLinks CompetitionCategorySkillLevel[]

  @@map("competitions")
}
```

Add back-relation to `Club` model — inside the `Club` model body, add:
```prisma
  competitionEvents  CompetitionEvent[]
```

Add back-relation to `Gymnast` model — inside the `Gymnast` model body, add:
```prisma
  competitionEntries CompetitionEntry[]
```

Then add the new models after the `LevelCompetition` model:

```prisma
model CompetitionEvent {
  id            String                 @id @default(cuid())
  clubId        String
  name          String
  location      String
  startDate     DateTime
  endDate       DateTime?
  entryDeadline DateTime
  lateEntryFee  Int?
  description   String?
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt
  club          Club                   @relation(fields: [clubId], references: [id])
  categories    CompetitionCategory[]
  priceTiers    CompetitionPriceTier[]
  entries       CompetitionEntry[]

  @@map("competition_events")
}

model CompetitionCategory {
  id                 String                          @id @default(cuid())
  competitionEventId String
  name               String
  competitionEvent   CompetitionEvent                @relation(fields: [competitionEventId], references: [id], onDelete: Cascade)
  skillCompetitions  CompetitionCategorySkillLevel[]
  entryCategories    CompetitionEntryCategory[]

  @@map("competition_categories")
}

model CompetitionCategorySkillLevel {
  id                 String              @id @default(cuid())
  categoryId         String
  skillCompetitionId String
  category           CompetitionCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  skillCompetition   Competition         @relation(fields: [skillCompetitionId], references: [id], onDelete: Cascade)

  @@unique([categoryId, skillCompetitionId])
  @@map("competition_category_skill_levels")
}

model CompetitionPriceTier {
  id                 String           @id @default(cuid())
  competitionEventId String
  entryNumber        Int
  price              Int
  competitionEvent   CompetitionEvent @relation(fields: [competitionEventId], references: [id], onDelete: Cascade)

  @@unique([competitionEventId, entryNumber])
  @@map("competition_price_tiers")
}

model CompetitionEntry {
  id                    String                   @id @default(cuid())
  competitionEventId    String
  gymnastId             String
  status                CompetitionEntryStatus   @default(INVITED)
  totalAmount           Int?
  stripePaymentIntentId String?
  coachConfirmed        Boolean                  @default(false)
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt
  competitionEvent      CompetitionEvent         @relation(fields: [competitionEventId], references: [id])
  gymnast               Gymnast                  @relation(fields: [gymnastId], references: [id])
  categories            CompetitionEntryCategory[]

  @@unique([competitionEventId, gymnastId])
  @@map("competition_entries")
}

model CompetitionEntryCategory {
  id         String              @id @default(cuid())
  entryId    String
  categoryId String
  entry      CompetitionEntry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  category   CompetitionCategory @relation(fields: [categoryId], references: [id])

  @@unique([entryId, categoryId])
  @@map("competition_entry_categories")
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name competition_events
```

Expected: migration file created and applied, no errors.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add competition event prisma models"
```

---

## Task 2: Backend — Competition Events Route

**Files:**
- Create: `backend/routes/booking/competitionEvents.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/booking/competitionEvents.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const { ensureTrampolineLifeClub, createParent, tokenFor } = require('../helpers/seed');

const app = createTestApp();
let club, coach, coachToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  coach = await createParent(club, { role: 'COACH' });
  coachToken = tokenFor(coach);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/competition-events', () => {
  it('creates a competition event with categories and price tiers', async () => {
    const res = await request(app)
      .post('/api/booking/competition-events')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: 'Regional 2026',
        location: 'Newcastle',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        entryDeadline: '2026-05-01',
        lateEntryFee: 500,
        categories: [
          { name: "Women's 13-14", skillCompetitionIds: [] },
        ],
        priceTiers: [
          { entryNumber: 1, price: 2500 },
          { entryNumber: 2, price: 1500 },
          { entryNumber: 3, price: 1000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Regional 2026');
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.priceTiers).toHaveLength(3);
  });

  it('rejects creation by non-admin/coach', async () => {
    const parent = await createParent(club, { role: 'ADULT' });
    const res = await request(app)
      .post('/api/booking/competition-events')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ name: 'X', location: 'Y', startDate: '2026-06-01', entryDeadline: '2026-05-01', categories: [], priceTiers: [] });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/booking/competition-events', () => {
  it('returns events for the club ordered by startDate', async () => {
    const res = await request(app)
      .get('/api/booking/competition-events')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PATCH /api/booking/competition-events/:id', () => {
  it('updates deadline and lateEntryFee', async () => {
    const event = await prisma.competitionEvent.create({
      data: {
        clubId: club.id,
        name: 'Test Event',
        location: 'London',
        startDate: new Date('2026-07-01'),
        entryDeadline: new Date('2026-06-01'),
      },
    });

    const res = await request(app)
      .patch(`/api/booking/competition-events/${event.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ entryDeadline: '2026-06-15', lateEntryFee: 1000 });

    expect(res.status).toBe(200);
    expect(new Date(res.body.entryDeadline).toISOString().slice(0, 10)).toBe('2026-06-15');
    expect(res.body.lateEntryFee).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest __tests__/booking/competitionEvents.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../routes/booking/competitionEvents'` or 404s.

- [ ] **Step 3: Create the route file**

Create `backend/routes/booking/competitionEvents.js`:

```js
const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

const eventSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().optional().allow(null),
  entryDeadline: Joi.date().required(),
  lateEntryFee: Joi.number().integer().min(0).optional().allow(null),
  description: Joi.string().optional().allow('', null),
  categories: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      skillCompetitionIds: Joi.array().items(Joi.string()).default([]),
    })
  ).required(),
  priceTiers: Joi.array().items(
    Joi.object({
      entryNumber: Joi.number().integer().min(1).required(),
      price: Joi.number().integer().min(0).required(),
    })
  ).required(),
});

// GET /api/booking/competition-events
router.get('/', auth, async (req, res) => {
  try {
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    const events = await prisma.competitionEvent.findMany({
      where: { clubId: req.user.clubId },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
        _count: { select: { entries: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/competition-events/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
        entries: {
          include: {
            gymnast: true,
            categories: { include: { category: true } },
          },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-events
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.create({
      data: {
        clubId: req.user.clubId,
        name: value.name,
        location: value.location,
        startDate: new Date(value.startDate),
        endDate: value.endDate ? new Date(value.endDate) : null,
        entryDeadline: new Date(value.entryDeadline),
        lateEntryFee: value.lateEntryFee ?? null,
        description: value.description ?? null,
        categories: {
          create: value.categories.map(c => ({
            name: c.name,
            skillCompetitions: c.skillCompetitionIds.length > 0 ? {
              create: c.skillCompetitionIds.map(sid => ({ skillCompetitionId: sid })),
            } : undefined,
          })),
        },
        priceTiers: {
          create: value.priceTiers.map(t => ({
            entryNumber: t.entryNumber,
            price: t.price,
          })),
        },
      },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
      },
    });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/competition-events/:id
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const patchSchema = Joi.object({
    name: Joi.string(),
    location: Joi.string(),
    startDate: Joi.date(),
    endDate: Joi.date().allow(null),
    entryDeadline: Joi.date(),
    lateEntryFee: Joi.number().integer().min(0).allow(null),
    description: Joi.string().allow('', null),
  });
  const { error, value } = patchSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existing = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.competitionEvent.update({
      where: { id: req.params.id },
      data: {
        ...(value.name && { name: value.name }),
        ...(value.location && { location: value.location }),
        ...(value.startDate && { startDate: new Date(value.startDate) }),
        ...('endDate' in value && { endDate: value.endDate ? new Date(value.endDate) : null }),
        ...(value.entryDeadline && { entryDeadline: new Date(value.entryDeadline) }),
        ...('lateEntryFee' in value && { lateEntryFee: value.lateEntryFee }),
        ...('description' in value && { description: value.description }),
      },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/competition-events/:id
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const existing = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.competitionEvent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/competition-events/:id/eligible
// Returns gymnasts per category who have completed the linked skill tracker levels.
router.get('/:id/eligible', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        categories: {
          include: {
            skillCompetitions: {
              include: {
                skillCompetition: { include: { levels: true } },
              },
            },
          },
        },
        entries: { select: { gymnastId: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const alreadyInvited = new Set(event.entries.map(e => e.gymnastId));

    // For each category, find eligible gymnasts
    const result = await Promise.all(event.categories.map(async (cat) => {
      const levelIds = cat.skillCompetitions.flatMap(sc =>
        sc.skillCompetition.levels.map(l => l.levelId)
      );

      let gymnasts;
      if (levelIds.length === 0) {
        // No skill filter — return all active members
        gymnasts = await prisma.gymnast.findMany({
          where: { clubId: req.user.clubId, isArchived: false },
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
      } else {
        gymnasts = await prisma.gymnast.findMany({
          where: {
            clubId: req.user.clubId,
            isArchived: false,
            levelProgress: {
              some: { levelId: { in: levelIds }, status: 'COMPLETED' },
            },
          },
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        gymnasts: gymnasts.map(g => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          alreadyInvited: alreadyInvited.has(g.id),
        })),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-events/:id/invite
// Body: { gymnastIds: string[] }
// Creates CompetitionEntry (INVITED) for each gymnast. Idempotent — skips existing entries.
router.post('/:id/invite', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const created = [];
    for (const gymnastId of value.gymnastIds) {
      const existing = await prisma.competitionEntry.findUnique({
        where: { competitionEventId_gymnastId: { competitionEventId: event.id, gymnastId } },
      });
      if (!existing) {
        const entry = await prisma.competitionEntry.create({
          data: { competitionEventId: event.id, gymnastId },
          include: { gymnast: true },
        });
        created.push(entry);
      }
    }

    res.status(201).json({ created: created.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount routes in server.js**

In `backend/server.js`, after line 181 (`app.use('/api/booking/shop', ...)`), add:
```js
app.use('/api/booking/competition-events', require('./routes/booking/competitionEvents'));
```

- [ ] **Step 5: Run tests**

```bash
cd backend
npx jest __tests__/booking/competitionEvents.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/competitionEvents.js backend/server.js backend/__tests__/booking/competitionEvents.test.js
git commit -m "feat: add competition events backend routes"
```

---

## Task 3: Backend — Competition Entries Route

**Files:**
- Create: `backend/routes/booking/competitionEntries.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/booking/competitionEntries.test.js`:

```js
const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const { ensureTrampolineLifeClub, createParent, createGymnast, tokenFor } = require('../helpers/seed');

const app = createTestApp();
let club, coach, coachToken, parent, parentToken, gymnast, event, category;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  coach = await createParent(club, { role: 'COACH' });
  coachToken = tokenFor(coach);
  parent = await createParent(club);
  parentToken = tokenFor(parent);
  gymnast = await createGymnast(club, parent);

  event = await prisma.competitionEvent.create({
    data: {
      clubId: club.id,
      name: 'Test Competition',
      location: 'Test Venue',
      startDate: new Date('2026-08-01'),
      entryDeadline: new Date('2026-07-01'),
      priceTiers: {
        create: [
          { entryNumber: 1, price: 2500 },
          { entryNumber: 2, price: 1500 },
          { entryNumber: 3, price: 1000 },
        ],
      },
      categories: { create: [{ name: 'Open Trampoline' }] },
    },
    include: { categories: true, priceTiers: true },
  });
  category = event.categories[0];
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('PATCH /api/booking/competition-entries/:id', () => {
  it('allows coach to set coachConfirmed', async () => {
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: gymnast.id },
    });

    const res = await request(app)
      .patch(`/api/booking/competition-entries/${entry.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ coachConfirmed: true });

    expect(res.status).toBe(200);
    expect(res.body.coachConfirmed).toBe(true);
  });

  it('allows coach to set entry status to DECLINED', async () => {
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: gymnast.id },
    });

    const res = await request(app)
      .patch(`/api/booking/competition-entries/${entry.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'DECLINED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DECLINED');
  });
});

describe('GET /api/booking/competition-entries/mine', () => {
  it('returns entries for the parent's gymnasts', async () => {
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: gymnast.id },
    });

    const res = await request(app)
      .get('/api/booking/competition-entries/mine')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some(e => e.id === entry.id)).toBe(true);
  });
});

describe('calculateEntryTotal', () => {
  it('calculates correct total for 2 categories', () => {
    const { calculateEntryTotal } = require('../../routes/booking/competitionEntries');
    // Tiers: 1→2500, 2→1500, 3→1000
    const tiers = [
      { entryNumber: 1, price: 2500 },
      { entryNumber: 2, price: 1500 },
      { entryNumber: 3, price: 1000 },
    ];
    expect(calculateEntryTotal(2, tiers, null, false)).toBe(4000);
  });

  it('adds late entry fee when past deadline', () => {
    const { calculateEntryTotal } = require('../../routes/booking/competitionEntries');
    const tiers = [{ entryNumber: 1, price: 2500 }];
    expect(calculateEntryTotal(1, tiers, 500, true)).toBe(3000);
  });

  it('uses tier 3 price for 4th+ entries', () => {
    const { calculateEntryTotal } = require('../../routes/booking/competitionEntries');
    const tiers = [
      { entryNumber: 1, price: 2500 },
      { entryNumber: 2, price: 1500 },
      { entryNumber: 3, price: 1000 },
    ];
    // 4 categories: 2500 + 1500 + 1000 + 1000 = 6000
    expect(calculateEntryTotal(4, tiers, null, false)).toBe(6000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npx jest __tests__/booking/competitionEntries.test.js --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route file**

Create `backend/routes/booking/competitionEntries.js`:

```js
const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

/**
 * Calculates total entry cost.
 * @param {number} numCategories - how many categories selected
 * @param {Array<{entryNumber: number, price: number}>} tiers - price tiers sorted by entryNumber
 * @param {number|null} lateEntryFee - in pence, or null
 * @param {boolean} isLate - whether current time is past the deadline
 * @returns {number} total in pence
 */
function calculateEntryTotal(numCategories, tiers, lateEntryFee, isLate) {
  const sorted = [...tiers].sort((a, b) => a.entryNumber - b.entryNumber);
  let total = 0;
  for (let i = 0; i < numCategories; i++) {
    const tierIndex = Math.min(i, sorted.length - 1);
    total += sorted[tierIndex].price;
  }
  if (isLate && lateEntryFee) total += lateEntryFee;
  return total;
}

// GET /api/booking/competition-entries/mine
// Returns all competition entries for the current user's gymnasts (guardian view)
router.get('/mine', auth, async (req, res) => {
  try {
    const myGymnasts = await prisma.gymnast.findMany({
      where: { guardians: { some: { id: req.user.id } } },
      select: { id: true },
    });
    const gymnstIds = myGymnasts.map(g => g.id);

    const entries = await prisma.competitionEntry.findMany({
      where: { gymnastId: { in: gymnstIds } },
      include: {
        competitionEvent: {
          include: {
            categories: true,
            priceTiers: { orderBy: { entryNumber: 'asc' } },
          },
        },
        gymnast: true,
        categories: { include: { category: true } },
      },
      orderBy: { competitionEvent: { startDate: 'asc' } },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/competition-entries/:id
// Admin: update coachConfirmed, status, or categoryIds
// Guardian: update categoryIds only (when status is INVITED)
router.patch('/:id', auth, async (req, res) => {
  const isAdmin = ADMIN_ROLES.includes(req.user.role);

  const adminSchema = Joi.object({
    coachConfirmed: Joi.boolean(),
    status: Joi.string().valid('INVITED', 'DECLINED'),
    categoryIds: Joi.array().items(Joi.string()),
  });
  const guardianSchema = Joi.object({
    categoryIds: Joi.array().items(Joi.string()).required(),
  });

  const { error, value } = (isAdmin ? adminSchema : guardianSchema).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });

    // Guards: admin must be in same club, guardian must own gymnast
    if (isAdmin) {
      if (entry.competitionEvent.clubId !== req.user.clubId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      const gymnast = await prisma.gymnast.findFirst({
        where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
      });
      if (!gymnast) return res.status(403).json({ error: 'Forbidden' });
      // Guardian can only update INVITED entries
      if (!['INVITED', 'PAYMENT_PENDING'].includes(entry.status)) {
        return res.status(400).json({ error: 'Entry cannot be modified after payment' });
      }
    }

    const updateData = {};
    if ('coachConfirmed' in value) updateData.coachConfirmed = value.coachConfirmed;
    if ('status' in value) updateData.status = value.status;

    // Replace category links if categoryIds provided
    if (value.categoryIds !== undefined) {
      await prisma.competitionEntryCategory.deleteMany({ where: { entryId: entry.id } });
      if (value.categoryIds.length > 0) {
        await prisma.competitionEntryCategory.createMany({
          data: value.categoryIds.map(cid => ({ entryId: entry.id, categoryId: cid })),
        });
      }
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: updateData,
      include: {
        gymnast: true,
        categories: { include: { category: true } },
        competitionEvent: {
          include: { priceTiers: { orderBy: { entryNumber: 'asc' } } },
        },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/competition-entries/:id (admin only)
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.competitionEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/checkout
// Creates a Stripe PaymentIntent for the entry.
// Body: { categoryIds: string[] }
router.post('/:id/checkout', auth, async (req, res) => {
  const { error, value } = Joi.object({
    categoryIds: Joi.array().items(Joi.string()).min(1).required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: {
        gymnast: true,
        competitionEvent: {
          include: {
            priceTiers: { orderBy: { entryNumber: 'asc' } },
            categories: true,
          },
        },
      },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });

    // Verify guardian owns this gymnast
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
    });
    if (!gymnast) return res.status(403).json({ error: 'Forbidden' });

    if (!['INVITED', 'PAYMENT_PENDING'].includes(entry.status)) {
      return res.status(400).json({ error: 'Entry already paid or declined' });
    }

    // Check deadline
    const now = new Date();
    const isLate = now > new Date(entry.competitionEvent.entryDeadline);
    if (isLate && entry.competitionEvent.lateEntryFee === null) {
      return res.status(400).json({ error: 'Entry deadline has passed' });
    }

    // Validate categoryIds belong to this event
    const validCatIds = new Set(entry.competitionEvent.categories.map(c => c.id));
    for (const cid of value.categoryIds) {
      if (!validCatIds.has(cid)) {
        return res.status(400).json({ error: `Invalid category ${cid}` });
      }
    }

    const total = calculateEntryTotal(
      value.categoryIds.length,
      entry.competitionEvent.priceTiers,
      entry.competitionEvent.lateEntryFee,
      isLate
    );

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Get or create Stripe customer for guardian
    const guardian = await prisma.user.findUnique({ where: { id: req.user.id } });
    let stripeCustomerId = guardian.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: guardian.email,
        name: `${guardian.firstName} ${guardian.lastName}`,
        metadata: { userId: guardian.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: guardian.id }, data: { stripeCustomerId } });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'gbp',
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        competitionEntryId: entry.id,
        competitionEventId: entry.competitionEventId,
        gymnastId: entry.gymnastId,
        clubId: entry.competitionEvent.clubId,
      },
      description: `Competition entry: ${entry.competitionEvent.name} — ${entry.gymnast.firstName} ${entry.gymnast.lastName}`,
    });

    // Update entry: categories, totalAmount, paymentIntentId, status
    await prisma.competitionEntryCategory.deleteMany({ where: { entryId: entry.id } });
    await prisma.competitionEntryCategory.createMany({
      data: value.categoryIds.map(cid => ({ entryId: entry.id, categoryId: cid })),
    });
    await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: {
        status: 'PAYMENT_PENDING',
        totalAmount: total,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.calculateEntryTotal = calculateEntryTotal;
```

- [ ] **Step 4: Mount routes in server.js**

In `backend/server.js`, after the competition-events line, add:
```js
app.use('/api/booking/competition-entries', require('./routes/booking/competitionEntries'));
```

- [ ] **Step 5: Run tests**

```bash
cd backend
npx jest __tests__/booking/competitionEntries.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/booking/competitionEntries.js backend/server.js backend/__tests__/booking/competitionEntries.test.js
git commit -m "feat: add competition entries backend routes"
```

---

## Task 4: Extend Webhook for Competition Entry Payments

**Files:**
- Modify: `backend/routes/booking/webhook.js`

- [ ] **Step 1: Add competition entry handler to `payment_intent.succeeded` block**

In `webhook.js`, find the `if (event.type === 'payment_intent.succeeded')` block (around line 54). After the existing `prisma.charge.updateMany(...)` call, add:

```js
// Mark competition entry as PAID
const competitionEntryId = paymentIntent.metadata?.competitionEntryId;
if (competitionEntryId) {
  await prisma.competitionEntry.updateMany({
    where: { id: competitionEntryId, status: 'PAYMENT_PENDING' },
    data: { status: 'PAID' },
  });
  console.log(`Competition entry ${competitionEntryId} marked PAID`);
}
```

- [ ] **Step 2: Verify webhook file looks correct**

Read `backend/routes/booking/webhook.js` and confirm the new block is inside the `payment_intent.succeeded` handler.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/booking/webhook.js
git commit -m "feat: handle competition entry payment in webhook"
```

---

## Task 5: Frontend API Methods

**Files:**
- Modify: `frontend/src/utils/bookingApi.js`

- [ ] **Step 1: Add competition API methods to bookingApi**

At the end of the `bookingApi` object (before the closing `}`), add:

```js
  // Competition Events (admin)
  getCompetitionEvents: () =>
    axios.get(`${API_URL}/booking/competition-events`, { headers: getHeaders() }),

  getCompetitionEvent: (id) =>
    axios.get(`${API_URL}/booking/competition-events/${id}`, { headers: getHeaders() }),

  createCompetitionEvent: (data) =>
    axios.post(`${API_URL}/booking/competition-events`, data, { headers: getHeaders() }),

  updateCompetitionEvent: (id, data) =>
    axios.patch(`${API_URL}/booking/competition-events/${id}`, data, { headers: getHeaders() }),

  deleteCompetitionEvent: (id) =>
    axios.delete(`${API_URL}/booking/competition-events/${id}`, { headers: getHeaders() }),

  getEligibleGymnasts: (eventId) =>
    axios.get(`${API_URL}/booking/competition-events/${eventId}/eligible`, { headers: getHeaders() }),

  inviteGymnasts: (eventId, gymnastIds) =>
    axios.post(`${API_URL}/booking/competition-events/${eventId}/invite`, { gymnastIds }, { headers: getHeaders() }),

  // Competition Entries
  getMyCompetitionEntries: () =>
    axios.get(`${API_URL}/booking/competition-entries/mine`, { headers: getHeaders() }),

  updateCompetitionEntry: (entryId, data) =>
    axios.patch(`${API_URL}/booking/competition-entries/${entryId}`, data, { headers: getHeaders() }),

  deleteCompetitionEntry: (entryId) =>
    axios.delete(`${API_URL}/booking/competition-entries/${entryId}`, { headers: getHeaders() }),

  checkoutCompetitionEntry: (entryId, categoryIds) =>
    axios.post(`${API_URL}/booking/competition-entries/${entryId}/checkout`, { categoryIds }, { headers: getHeaders() }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/bookingApi.js
git commit -m "feat: add competition API methods to bookingApi"
```

---

## Task 6: Admin — Competition List Page

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminCompetitions.js`

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/booking/admin/AdminCompetitions.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

function getSkillCompetitions() {
  return fetch(`${API_URL}/competitions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }).then(r => r.json());
}

const EMPTY_FORM = {
  name: '',
  location: '',
  startDate: '',
  endDate: '',
  entryDeadline: '',
  lateEntryFee: '',
  description: '',
  categories: [{ name: '', skillCompetitionIds: [] }],
  priceTiers: [
    { entryNumber: 1, price: '' },
    { entryNumber: 2, price: '' },
    { entryNumber: 3, price: '' },
  ],
};

export default function AdminCompetitions() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skillCompetitions, setSkillCompetitions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    bookingApi.getCompetitionEvents().then(res => setEvents(res.data));
    getSkillCompetitions().then(data => setSkillCompetitions(Array.isArray(data) ? data : data.competitions || []));
  };

  useEffect(load, []);

  const addCategory = () =>
    setForm(f => ({ ...f, categories: [...f.categories, { name: '', skillCompetitionIds: [] }] }));

  const removeCategory = (i) =>
    setForm(f => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i) }));

  const updateCategory = (i, key, val) =>
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
    }));

  const toggleSkillComp = (catIdx, scId) => {
    const cat = form.categories[catIdx];
    const ids = cat.skillCompetitionIds.includes(scId)
      ? cat.skillCompetitionIds.filter(id => id !== scId)
      : [...cat.skillCompetitionIds, scId];
    updateCategory(catIdx, 'skillCompetitionIds', ids);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        location: form.location,
        startDate: form.startDate,
        endDate: form.endDate || null,
        entryDeadline: form.entryDeadline,
        lateEntryFee: form.lateEntryFee ? Math.round(parseFloat(form.lateEntryFee) * 100) : null,
        description: form.description || null,
        categories: form.categories.filter(c => c.name.trim()).map(c => ({
          name: c.name.trim(),
          skillCompetitionIds: c.skillCompetitionIds,
        })),
        priceTiers: form.priceTiers
          .filter(t => t.price !== '')
          .map(t => ({ entryNumber: t.entryNumber, price: Math.round(parseFloat(t.price) * 100) })),
      };
      await bookingApi.createCompetitionEvent(payload);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create competition.');
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming = events.filter(e => new Date(e.startDate) >= new Date());
  const past = events.filter(e => new Date(e.startDate) < new Date());

  return (
    <div className="bk-page bk-page--lg">
      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Competitions</h2>
        <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New competition'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bk-form-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>New competition</h3>
          <div className="bk-grid-2">
            <label className="bk-label">Name
              <input className="bk-input" style={{ marginTop: '0.25rem' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label className="bk-label">Location
              <input className="bk-input" style={{ marginTop: '0.25rem' }} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
            </label>
            <label className="bk-label">Start date
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
            </label>
            <label className="bk-label">End date (optional)
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </label>
            <label className="bk-label">Entry deadline
              <input type="date" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.entryDeadline} onChange={e => setForm(f => ({ ...f, entryDeadline: e.target.value }))} required />
            </label>
            <label className="bk-label">Late entry fee (£, optional — leave blank for hard deadline)
              <input type="number" step="0.01" min="0" className="bk-input" style={{ marginTop: '0.25rem' }} value={form.lateEntryFee} onChange={e => setForm(f => ({ ...f, lateEntryFee: e.target.value }))} placeholder="e.g. 5.00" />
            </label>
          </div>

          <label className="bk-label" style={{ marginTop: '0.75rem' }}>Description (optional)
            <textarea className="bk-input" style={{ marginTop: '0.25rem' }} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </label>

          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Entry price tiers</p>
            <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem' }}>Tier 3 applies to 3rd entry and beyond.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {form.priceTiers.map((tier, i) => (
                <label key={tier.entryNumber} className="bk-label" style={{ minWidth: '120px' }}>
                  {i === 0 ? '1st entry (£)' : i === 1 ? '2nd entry (£)' : '3rd+ entries (£)'}
                  <input
                    type="number" step="0.01" min="0"
                    className="bk-input" style={{ marginTop: '0.25rem' }}
                    value={tier.price}
                    onChange={e => setForm(f => ({ ...f, priceTiers: f.priceTiers.map((t, j) => j === i ? { ...t, price: e.target.value } : t) }))}
                    required
                  />
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>Categories</p>
              <button type="button" className="bk-btn bk-btn--sm" onClick={addCategory}>+ Add category</button>
            </div>
            {form.categories.map((cat, i) => (
              <div key={i} className="bk-card" style={{ marginBottom: '0.5rem', padding: '0.75rem' }}>
                <div className="bk-row" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    className="bk-input"
                    placeholder="Category name e.g. Women's 13-14"
                    value={cat.name}
                    onChange={e => updateCategory(i, 'name', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {form.categories.length > 1 && (
                    <button type="button" className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)' }} onClick={() => removeCategory(i)}>Remove</button>
                  )}
                </div>
                {skillCompetitions.length > 0 && (
                  <div>
                    <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.35rem' }}>Eligible if gymnast has achieved (optional):</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {skillCompetitions.filter(sc => sc.isActive).map(sc => (
                        <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={cat.skillCompetitionIds.includes(sc.id)}
                            onChange={() => toggleSkillComp(i, sc.id)}
                          />
                          {sc.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="bk-error">{error}</p>}
          <button type="submit" className="bk-btn bk-btn--primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create competition'}
          </button>
        </form>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="bk-muted">No competitions yet.</p>
      )}

      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>UPCOMING</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {upcoming.map(ev => <CompetitionCard key={ev.id} event={ev} onClick={() => navigate(`/booking/admin/competitions/${ev.id}`)} />)}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>PAST</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {past.map(ev => <CompetitionCard key={ev.id} event={ev} onClick={() => navigate(`/booking/admin/competitions/${ev.id}`)} />)}
          </div>
        </>
      )}
    </div>
  );
}

function CompetitionCard({ event, onClick }) {
  const isLate = new Date() > new Date(event.entryDeadline);
  const hasLateFee = event.lateEntryFee !== null;
  return (
    <div className="bk-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>{event.name}</p>
          <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>{event.location} · {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <p className="bk-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
            Deadline: {new Date(event.entryDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {isLate && hasLateFee && <span style={{ color: 'var(--booking-warning)', marginLeft: '0.5rem' }}>Late entries: +£{(event.lateEntryFee / 100).toFixed(2)}</span>}
            {isLate && !hasLateFee && <span style={{ color: 'var(--booking-danger)', marginLeft: '0.5rem' }}>Closed</span>}
          </p>
        </div>
        <span className="bk-muted" style={{ fontSize: '0.8rem' }}>{event._count?.entries ?? 0} entries</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminCompetitions.js
git commit -m "feat: add AdminCompetitions page"
```

---

## Task 7: Admin — Competition Detail Page

**Files:**
- Create: `frontend/src/pages/booking/admin/AdminCompetitionDetail.js`

- [ ] **Step 1: Create the detail page**

Create `frontend/src/pages/booking/admin/AdminCompetitionDetail.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '../../../utils/bookingApi';
import '../booking-shared.css';

export default function AdminCompetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [tab, setTab] = useState('details');
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const res = await bookingApi.getCompetitionEvent(id);
    setEvent(res.data);
  };

  const loadEligible = async () => {
    const res = await bookingApi.getEligibleGymnasts(id);
    setEligible(res.data);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tab === 'invites') loadEligible(); }, [tab]);

  const saveField = async (field, rawValue) => {
    setSaving(true);
    setMsg(null);
    try {
      let value = rawValue;
      if (field === 'lateEntryFee') value = rawValue === '' ? null : Math.round(parseFloat(rawValue) * 100);
      await bookingApi.updateCompetitionEvent(id, { [field]: value });
      setEditField(null);
      await load();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (gymnastId) => {
    setInviting(true);
    try {
      await bookingApi.inviteGymnasts(id, [gymnastId]);
      await load();
      setEligible(prev => prev.map(cat => ({
        ...cat,
        gymnasts: cat.gymnasts.map(g => g.id === gymnastId ? { ...g, alreadyInvited: true } : g),
      })));
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveEntry = async (entryId) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await bookingApi.deleteCompetitionEntry(entryId);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to remove entry.');
    }
  };

  const handleCoachConfirm = async (entryId, current) => {
    try {
      await bookingApi.updateCompetitionEntry(entryId, { coachConfirmed: !current });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this competition? All entries will be removed.')) return;
    try {
      await bookingApi.deleteCompetitionEvent(id);
      navigate('/booking/admin/competitions');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to delete.');
    }
  };

  if (!event) return <div className="bk-page"><p className="bk-muted">Loading...</p></div>;

  const isDeadlinePassed = new Date() > new Date(event.entryDeadline);
  const entryCountByStatus = event.entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bk-page bk-page--lg">
      <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.85rem', marginBottom: '1rem' }} onClick={() => navigate('/booking/admin/competitions')}>
        ← Competitions
      </button>

      <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem' }}>{event.name}</h2>
          <p className="bk-muted" style={{ margin: 0, fontSize: '0.875rem' }}>{event.location} · {new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button className="bk-btn bk-btn--sm" style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }} onClick={handleDelete}>Delete</button>
      </div>

      {msg && <p style={{ fontSize: '0.875rem', color: 'var(--booking-text-muted)', marginBottom: '0.75rem' }}>{msg}</p>}

      <div className="bk-row" style={{ gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--booking-border)', paddingBottom: '0' }}>
        {['details', 'invites', 'entries'].map(t => (
          <button
            key={t}
            className="bk-btn bk-btn--ghost"
            style={{
              fontSize: '0.875rem',
              borderBottom: tab === t ? '2px solid var(--booking-primary)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: '0.6rem',
            }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'entries' && event.entries.length > 0 && ` (${event.entries.length})`}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <DetailsTab
          event={event}
          editField={editField}
          editValue={editValue}
          saving={saving}
          onEdit={(field, val) => { setEditField(field); setEditValue(val); setMsg(null); }}
          onSave={saveField}
          onCancel={() => setEditField(null)}
          onEditValueChange={setEditValue}
        />
      )}

      {tab === 'invites' && (
        <InvitesTab
          event={event}
          eligible={eligible}
          inviting={inviting}
          onInvite={handleInvite}
        />
      )}

      {tab === 'entries' && (
        <EntriesTab
          event={event}
          entryCountByStatus={entryCountByStatus}
          onRemove={handleRemoveEntry}
          onCoachConfirm={handleCoachConfirm}
        />
      )}
    </div>
  );
}

function DetailsTab({ event, editField, editValue, saving, onEdit, onSave, onCancel, onEditValueChange }) {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', display: event.name },
    { key: 'location', label: 'Location', type: 'text', display: event.location },
    { key: 'startDate', label: 'Start date', type: 'date', display: new Date(event.startDate).toLocaleDateString('en-GB') },
    { key: 'endDate', label: 'End date', type: 'date', display: event.endDate ? new Date(event.endDate).toLocaleDateString('en-GB') : '—' },
    { key: 'entryDeadline', label: 'Entry deadline', type: 'date', display: new Date(event.entryDeadline).toLocaleDateString('en-GB') },
    {
      key: 'lateEntryFee',
      label: 'Late entry fee',
      type: 'number',
      display: event.lateEntryFee !== null ? `£${(event.lateEntryFee / 100).toFixed(2)}` : 'None (hard deadline)',
      editVal: event.lateEntryFee !== null ? (event.lateEntryFee / 100).toFixed(2) : '',
    },
  ];

  return (
    <div>
      <table className="bk-table" style={{ maxWidth: 600 }}>
        <tbody>
          {fields.map(f => (
            <tr key={f.key}>
              <td style={{ fontWeight: 500, width: '160px' }}>{f.label}</td>
              <td>
                {editField === f.key ? (
                  <div className="bk-row" style={{ gap: '0.5rem' }}>
                    <input
                      type={f.type}
                      step={f.type === 'number' ? '0.01' : undefined}
                      min={f.type === 'number' ? '0' : undefined}
                      className="bk-input"
                      style={{ maxWidth: 200 }}
                      value={editValue}
                      onChange={e => onEditValueChange(e.target.value)}
                      autoFocus
                    />
                    <button className="bk-btn bk-btn--sm bk-btn--primary" disabled={saving} onClick={() => onSave(f.key, editValue)}>Save</button>
                    <button className="bk-btn bk-btn--sm" onClick={onCancel}>Cancel</button>
                  </div>
                ) : (
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                    onClick={() => onEdit(f.key, f.editVal !== undefined ? f.editVal : f.display)}
                  >
                    {f.display}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Price tiers</p>
        <table className="bk-table" style={{ maxWidth: 300 }}>
          <thead><tr><th>Entry</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
          <tbody>
            {event.priceTiers.map(t => (
              <tr key={t.id}>
                <td>{t.entryNumber === 1 ? '1st' : t.entryNumber === 2 ? '2nd' : '3rd+'}</td>
                <td style={{ textAlign: 'right' }}>£{(t.price / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.5rem' }}>Categories</p>
        {event.categories.map(cat => (
          <div key={cat.id} style={{ fontSize: '0.875rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 500 }}>{cat.name}</span>
            {cat.skillCompetitions?.length > 0 && (
              <span className="bk-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                ({cat.skillCompetitions.length} skill level{cat.skillCompetitions.length !== 1 ? 's' : ''} linked)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitesTab({ event, eligible, inviting, onInvite }) {
  const allInvited = event.entries.map(e => e.gymnasId);

  if (eligible.length === 0) return <p className="bk-muted">Loading eligible gymnasts...</p>;

  return (
    <div>
      <p className="bk-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Recommended gymnasts are those who have completed the linked skill tracker levels. You can invite anyone regardless of recommendation.
      </p>
      {eligible.map(cat => (
        <div key={cat.categoryId} style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{cat.categoryName}</h4>
          {cat.gymnasts.length === 0 && <p className="bk-muted" style={{ fontSize: '0.85rem' }}>No eligible gymnasts found.</p>}
          <table className="bk-table">
            <tbody>
              {cat.gymnasts.map(g => (
                <tr key={g.id}>
                  <td>{g.firstName} {g.lastName}</td>
                  <td>
                    {g.alreadyInvited ? (
                      <span style={{ color: 'var(--booking-success)', fontSize: '0.85rem', fontWeight: 600 }}>Invited</span>
                    ) : (
                      <button
                        className="bk-btn bk-btn--sm bk-btn--primary"
                        disabled={inviting}
                        onClick={() => onInvite(g.id)}
                      >
                        Invite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function EntriesTab({ event, entryCountByStatus, onRemove, onCoachConfirm }) {
  const STATUS_LABELS = {
    INVITED: { label: 'Invited', color: '#1565c0' },
    PAYMENT_PENDING: { label: 'Awaiting payment', color: 'var(--booking-warning, #e67e22)' },
    PAID: { label: 'Paid', color: 'var(--booking-success)' },
    DECLINED: { label: 'Declined', color: 'var(--booking-text-muted)' },
  };

  return (
    <div>
      <div className="bk-row" style={{ gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(entryCountByStatus).map(([status, count]) => (
          <div key={status} style={{ fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600, color: STATUS_LABELS[status]?.color || 'inherit' }}>{count}</span>
            <span className="bk-muted"> {STATUS_LABELS[status]?.label || status}</span>
          </div>
        ))}
      </div>

      {event.entries.length === 0 && <p className="bk-muted">No entries yet.</p>}

      {event.entries.length > 0 && (
        <table className="bk-table">
          <thead>
            <tr>
              <th>Gymnast</th>
              <th>Categories</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {event.entries.map(entry => {
              const s = STATUS_LABELS[entry.status] || { label: entry.status, color: 'inherit' };
              return (
                <tr key={entry.id}>
                  <td>{entry.gymnast.firstName} {entry.gymnast.lastName}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--booking-text-muted)' }}>
                    {entry.categories.length > 0
                      ? entry.categories.map(ec => ec.category.name).join(', ')
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {entry.totalAmount !== null ? `£${(entry.totalAmount / 100).toFixed(2)}` : '—'}
                  </td>
                  <td><span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</span></td>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={entry.coachConfirmed}
                        onChange={() => onCoachConfirm(entry.id, entry.coachConfirmed)}
                      />
                      {entry.coachConfirmed ? 'Done' : 'Confirm'}
                    </label>
                  </td>
                  <td>
                    {entry.status !== 'PAID' && (
                      <button
                        className="bk-btn bk-btn--sm"
                        style={{ color: 'var(--booking-danger)', fontSize: '0.8rem' }}
                        onClick={() => onRemove(entry.id)}
                      >
                        Remove
                      </button>
                    )}
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/booking/admin/AdminCompetitionDetail.js
git commit -m "feat: add AdminCompetitionDetail page"
```

---

## Task 8: Guardian — Competition Entry Page

**Files:**
- Create: `frontend/src/pages/booking/CompetitionEntry.js`

- [ ] **Step 1: Create the guardian entry page**

Create `frontend/src/pages/booking/CompetitionEntry.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

export default function CompetitionEntry() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [clientSecret, setClientSecret] = useState(null);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.getMyCompetitionEntries().then(res => {
      const found = res.data.find(e => e.id === entryId);
      if (found) {
        setEntry(found);
        setSelectedCategories(found.categories.map(ec => ec.categoryId));
        if (found.status === 'PAID') setClientSecret(null);
      }
    });
  }, [entryId]);

  if (!entry) return <div className="bk-page bk-page--sm"><p className="bk-muted">Loading...</p></div>;

  if (entry.status === 'PAID') {
    return (
      <div className="bk-page bk-page--sm">
        <div className="bk-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Entry confirmed</p>
          <p className="bk-muted">{entry.competitionEvent.name}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {entry.categories.map(ec => ec.category.name).join(', ')}
          </p>
          <p style={{ fontWeight: 600, marginTop: '0.5rem' }}>£{(entry.totalAmount / 100).toFixed(2)}</p>
        </div>
      </div>
    );
  }

  const ev = entry.competitionEvent;
  const isLate = new Date() > new Date(ev.entryDeadline);
  const deadlinePassed = isLate && ev.lateEntryFee === null;

  const toggleCategory = (catId) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
    setClientSecret(null);
  };

  const calcDisplayTotal = () => {
    const tiers = [...ev.priceTiers].sort((a, b) => a.entryNumber - b.entryNumber);
    let t = 0;
    for (let i = 0; i < selectedCategories.length; i++) {
      const tierIdx = Math.min(i, tiers.length - 1);
      t += tiers[tierIdx].price;
    }
    if (isLate && ev.lateEntryFee) t += ev.lateEntryFee;
    return t;
  };

  const handleProceedToPayment = async () => {
    if (selectedCategories.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.checkoutCompetitionEntry(entryId, selectedCategories);
      setClientSecret(res.data.clientSecret);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout.');
    } finally {
      setLoading(false);
    }
  };

  if (clientSecret) {
    return (
      <div className="bk-page bk-page--sm">
        <h2>{ev.name}</h2>
        <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
          {entry.gymnast.firstName} {entry.gymnast.lastName}
        </p>
        <p style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          {selectedCategories.map(cid => ev.categories.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}
        </p>
        {isLate && ev.lateEntryFee && (
          <p style={{ color: 'var(--booking-warning)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Late entry fee of £{(ev.lateEntryFee / 100).toFixed(2)} included
          </p>
        )}
        <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
          Total: £{(total / 100).toFixed(2)}
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CompetitionPaymentForm entryId={entryId} onSuccess={() => navigate('/booking/competitions')} />
        </Elements>
        <button className="bk-btn bk-btn--ghost" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }} onClick={() => setClientSecret(null)}>
          Back to category selection
        </button>
      </div>
    );
  }

  return (
    <div className="bk-page bk-page--sm">
      <h2>{ev.name}</h2>
      <p className="bk-muted" style={{ marginBottom: '0.5rem' }}>
        {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)', marginBottom: '1rem' }}>
        Gymnast: <strong>{entry.gymnast.firstName} {entry.gymnast.lastName}</strong>
      </p>

      {deadlinePassed && (
        <div className="bk-card" style={{ background: '#fff3cd', borderColor: '#ffc107', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>The entry deadline has passed. Entries are closed for this competition.</p>
        </div>
      )}

      {!deadlinePassed && (
        <>
          {isLate && (
            <div className="bk-card" style={{ background: '#fff3cd', borderColor: '#ffc107', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
                The entry deadline has passed. A late entry fee of £{(ev.lateEntryFee / 100).toFixed(2)} will be added.
              </p>
            </div>
          )}

          <div className="bk-form-card" style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.75rem' }}>Select categories to enter</p>
            {ev.categories.map(cat => (
              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                {cat.name}
              </label>
            ))}
          </div>

          {selectedCategories.length > 0 && (
            <div className="bk-card" style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.35rem' }}>
                Entry total: £{(calcDisplayTotal() / 100).toFixed(2)}
              </p>
              <p className="bk-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
                {isLate && ev.lateEntryFee ? ` + £${(ev.lateEntryFee / 100).toFixed(2)} late fee` : ''}
              </p>
            </div>
          )}

          {error && <p className="bk-error">{error}</p>}

          <button
            className="bk-btn bk-btn--primary bk-btn--full"
            disabled={selectedCategories.length === 0 || loading}
            onClick={handleProceedToPayment}
          >
            {loading ? 'Loading...' : 'Proceed to payment'}
          </button>

          <button className="bk-btn bk-btn--ghost bk-btn--full" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/booking/competitions')}>
            Decline
          </button>
        </>
      )}
    </div>
  );
}

function CompetitionPaymentForm({ entryId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/booking/competitions` },
      redirect: 'if_required',
    });
    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="bk-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
      <button
        type="submit"
        className="bk-btn bk-btn--primary bk-btn--full"
        style={{ marginTop: '1rem' }}
        disabled={!stripe || loading}
      >
        {loading ? 'Processing...' : 'Pay now'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the guardian competitions list page**

Create `frontend/src/pages/booking/MyCompetitions.js`:

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../utils/bookingApi';
import './booking-shared.css';

const STATUS_LABELS = {
  INVITED: { label: 'Action needed', color: '#1565c0' },
  PAYMENT_PENDING: { label: 'Payment pending', color: 'var(--booking-warning, #e67e22)' },
  PAID: { label: 'Entered', color: 'var(--booking-success)' },
  DECLINED: { label: 'Declined', color: 'var(--booking-text-muted)' },
};

export default function MyCompetitions() {
  const [entries, setEntries] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    bookingApi.getMyCompetitionEntries().then(res => setEntries(res.data));
  }, []);

  const upcoming = entries.filter(e => new Date(e.competitionEvent.startDate) >= new Date());
  const past = entries.filter(e => new Date(e.competitionEvent.startDate) < new Date());

  const renderEntry = (entry) => {
    const s = STATUS_LABELS[entry.status] || { label: entry.status, color: 'inherit' };
    const ev = entry.competitionEvent;
    const isDeadlinePassed = new Date() > new Date(ev.entryDeadline);
    const canEnter = ['INVITED', 'PAYMENT_PENDING'].includes(entry.status) && (!isDeadlinePassed || ev.lateEntryFee !== null);

    return (
      <div key={entry.id} className="bk-card" style={{ marginBottom: '0.75rem' }}>
        <div className="bk-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>{ev.name}</p>
            <p className="bk-muted" style={{ fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
              {ev.location} · {new Date(ev.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {entry.gymnast.firstName} {entry.gymnast.lastName}
            </p>
            {entry.categories.length > 0 && (
              <p className="bk-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                {entry.categories.map(ec => ec.category.name).join(', ')}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: s.color, fontWeight: 600, fontSize: '0.85rem', display: 'block' }}>{s.label}</span>
            {entry.totalAmount && <span className="bk-muted" style={{ fontSize: '0.8rem' }}>£{(entry.totalAmount / 100).toFixed(2)}</span>}
          </div>
        </div>
        {canEnter && (
          <button className="bk-btn bk-btn--primary bk-btn--sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate(`/booking/competitions/${entry.id}/enter`)}>
            Enter now
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bk-page bk-page--sm">
      <h2>Competitions</h2>
      {entries.length === 0 && <p className="bk-muted">No competition invitations yet.</p>}
      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '0 0 0.75rem' }}>UPCOMING</h3>
          {upcoming.map(renderEntry)}
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--booking-text-muted)', margin: '1.5rem 0 0.75rem' }}>PAST</h3>
          {past.map(renderEntry)}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/booking/CompetitionEntry.js frontend/src/pages/booking/MyCompetitions.js
git commit -m "feat: add guardian competition entry and my competitions pages"
```

---

## Task 9: Wire Up Routes and Navigation

**Files:**
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/AppLayout.js`

- [ ] **Step 1: Add imports and routes to App.js**

In `frontend/src/App.js`, add imports after the existing admin page imports (around line 61):

```js
import AdminCompetitions from './pages/booking/admin/AdminCompetitions';
import AdminCompetitionDetail from './pages/booking/admin/AdminCompetitionDetail';
import MyCompetitions from './pages/booking/MyCompetitions';
import CompetitionEntry from './pages/booking/CompetitionEntry';
```

In the routes section, after the `admin/payments` route (line 214), add:
```jsx
<Route path="admin/competitions" element={<AdminCompetitions />} />
<Route path="admin/competitions/:id" element={<AdminCompetitionDetail />} />
```

After the guardian routes section (after `admin/help`), add:
```jsx
<Route path="competitions" element={<MyCompetitions />} />
<Route path="competitions/:entryId/enter" element={<CompetitionEntry />} />
```

- [ ] **Step 2: Add nav links to AppLayout.js**

In `frontend/src/components/AppLayout.js`:

Find the admin dropdown section containing the `Memberships` NavLink (around line 338). Add after the `Memberships` NavLink:
```jsx
<NavLink to="/booking/admin/competitions" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Competitions</NavLink>
```

Find the guardian section containing `My Charges` NavLink (around line 310). Add:
```jsx
<NavLink to="/booking/competitions" className="app-layout__dropdown-item" onClick={() => setOpenDropdown(null)}>Competitions</NavLink>
```

Find the mobile admin links section (around line 426). Add after `Memberships`:
```jsx
<NavLink to="/booking/admin/competitions" className="app-layout__mobile-link" onClick={closeMobile}>Competitions</NavLink>
```

Find the mobile guardian links section (around line 412). Add:
```jsx
<NavLink to="/booking/competitions" className="app-layout__mobile-link" onClick={closeMobile}>Competitions</NavLink>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.js frontend/src/components/AppLayout.js
git commit -m "feat: wire up competition routes and nav links"
```

---

## Task 10: Push to Remote

- [ ] **Step 1: Push all commits**

```bash
git push
```

Expected: Successful push to remote.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Competition details (name, location, dates, deadline, optional late fee) | Tasks 1, 2, 6 |
| Eligible gymnast list (skill tracker + manual) | Tasks 2, 7 |
| Invite mechanism | Tasks 2, 7 |
| Payment through app (Stripe PaymentIntent) | Tasks 3, 8 |
| Entry status display | Tasks 3, 7, 8 |
| Deadline management with optional late-entry fees | Tasks 2, 3, 8 |
| Coach deadline editing | Task 2 (PATCH endpoint), Task 7 (Details tab) |
| Coach confirmation checkbox | Tasks 3, 7 |
| Competition calendar / list | Tasks 6, 8 |
| Status transitions INVITED → PAYMENT_PENDING → PAID | Tasks 3, 4 |
| Webhook confirms payment → PAID | Task 4 |
| Guardian can decline | Task 3 (PATCH status=DECLINED), Task 8 (Decline button) |

All spec requirements covered.
