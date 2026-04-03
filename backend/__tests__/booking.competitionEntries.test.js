const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { ensureTrampolineLifeClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');
const { calculateEntryTotal } = require('../routes/booking/competitionEntries');

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
      categories: { create: [{ name: 'Open Trampoline' }, { name: 'Open DMT' }] },
    },
    include: { categories: true, priceTiers: true },
  });
  category = event.categories[0];
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('calculateEntryTotal', () => {
  const tiers = [
    { entryNumber: 1, price: 2500 },
    { entryNumber: 2, price: 1500 },
    { entryNumber: 3, price: 1000 },
  ];

  it('calculates correct total for 1 category', () => {
    expect(calculateEntryTotal(1, tiers, null, false)).toBe(2500);
  });

  it('calculates correct total for 2 categories', () => {
    expect(calculateEntryTotal(2, tiers, null, false)).toBe(4000);
  });

  it('uses tier 3 price for 4th+ entries', () => {
    // 4 categories: 2500 + 1500 + 1000 + 1000 = 6000
    expect(calculateEntryTotal(4, tiers, null, false)).toBe(6000);
  });

  it('adds late entry fee when past deadline', () => {
    expect(calculateEntryTotal(1, tiers, 500, true)).toBe(3000);
  });

  it('does not add late fee when not late', () => {
    expect(calculateEntryTotal(1, tiers, 500, false)).toBe(2500);
  });
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

    await prisma.competitionEntry.delete({ where: { id: entry.id } });
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

    await prisma.competitionEntry.delete({ where: { id: entry.id } });
  });

  it('prevents guardian from modifying a PAID entry', async () => {
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: gymnast.id, status: 'PAID' },
    });

    const res = await request(app)
      .patch(`/api/booking/competition-entries/${entry.id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ categoryIds: [category.id] });

    expect(res.status).toBe(400);

    await prisma.competitionEntry.delete({ where: { id: entry.id } });
  });
});

describe('GET /api/booking/competition-entries/mine', () => {
  it('returns entries for the parent gymnasts', async () => {
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: gymnast.id },
    });

    const res = await request(app)
      .get('/api/booking/competition-entries/mine')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(e => e.id === entry.id)).toBe(true);

    await prisma.competitionEntry.delete({ where: { id: entry.id } });
  });

  it('does not return entries for gymnasts belonging to other parents', async () => {
    const otherParent = await createParent(club);
    const otherGymnast = await createGymnast(club, otherParent);
    const entry = await prisma.competitionEntry.create({
      data: { competitionEventId: event.id, gymnastId: otherGymnast.id },
    });

    const res = await request(app)
      .get('/api/booking/competition-entries/mine')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some(e => e.id === entry.id)).toBe(false);

    await prisma.competitionEntry.delete({ where: { id: entry.id } });
  });
});
