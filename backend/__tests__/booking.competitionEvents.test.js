const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { ensureTrampolineLifeClub, createParent, tokenFor } = require('./helpers/seed');

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
    expect(res.body.lateEntryFee).toBe(500);
  });

  it('rejects creation by non-admin/coach', async () => {
    const parent = await createParent(club, { role: 'ADULT' });
    const res = await request(app)
      .post('/api/booking/competition-events')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({
        name: 'X', location: 'Y', startDate: '2026-06-01', entryDeadline: '2026-05-01',
        categories: [], priceTiers: [],
      });

    expect(res.status).toBe(403);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/booking/competition-events')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Incomplete' });

    expect(res.status).toBe(400);
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

  it('can clear lateEntryFee to null (hard deadline)', async () => {
    const event = await prisma.competitionEvent.create({
      data: {
        clubId: club.id,
        name: 'Test Event 2',
        location: 'London',
        startDate: new Date('2026-07-01'),
        entryDeadline: new Date('2026-06-01'),
        lateEntryFee: 500,
      },
    });

    const res = await request(app)
      .patch(`/api/booking/competition-events/${event.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ lateEntryFee: null });

    expect(res.status).toBe(200);
    expect(res.body.lateEntryFee).toBeNull();
  });
});

describe('POST /api/booking/competition-events/:id/invite', () => {
  it('creates entries for invited gymnasts', async () => {
    const { createGymnast } = require('./helpers/seed');
    const parent = await createParent(club);
    const gymnast = await createGymnast(club, parent);

    const event = await prisma.competitionEvent.create({
      data: {
        clubId: club.id,
        name: 'Invite Test',
        location: 'Leeds',
        startDate: new Date('2026-08-01'),
        entryDeadline: new Date('2026-07-01'),
      },
    });

    const res = await request(app)
      .post(`/api/booking/competition-events/${event.id}/invite`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastIds: [gymnast.id] });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);

    // Idempotent — second invite doesn't double-create
    const res2 = await request(app)
      .post(`/api/booking/competition-events/${event.id}/invite`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastIds: [gymnast.id] });

    expect(res2.status).toBe(201);
    expect(res2.body.created).toBe(0);
  });
});
