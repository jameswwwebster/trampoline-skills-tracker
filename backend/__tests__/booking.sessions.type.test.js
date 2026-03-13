const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, parent, token;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  parent = await createParent(club);
  token = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/booking/sessions — type field', () => {
  it('includes type in session list response', async () => {
    await createSession(club, undefined, { type: 'DMT' });

    const now = new Date();
    const res = await request(app)
      .get(`/api/booking/sessions?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .set('Authorization', `Bearer ${token}`);

    // Find a DMT session in the response
    const dmt = res.body.find(s => s.type === 'DMT');
    expect(dmt).toBeDefined();
  });
});

describe('GET /api/booking/sessions/:instanceId — type field', () => {
  it('includes type in session detail response', async () => {
    const { instance } = await createSession(club, undefined, { type: 'DMT' });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('DMT');
  });
});
