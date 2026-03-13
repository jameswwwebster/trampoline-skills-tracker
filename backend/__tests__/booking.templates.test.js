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
