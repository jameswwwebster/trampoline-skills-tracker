const request = require('supertest');
const app = require('../server');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

let club, admin, adminToken, parent, parentToken;

beforeEach(async () => {
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `admin-${Date.now()}@test.tl` });
  adminToken = tokenFor(admin);
  parent = await createParent(club);
  parentToken = tokenFor(parent);
});

afterEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); });

test('hasPendingBg is false when gymnast has no pending BG number', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'VERIFIED' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user).toBeDefined();
  expect(user.hasPendingBg).toBe(false);
});

test('hasPendingBg is true when any gymnast of that user has PENDING BG status', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'PENDING', bgNumber: 'BG111' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user).toBeDefined();
  expect(user.hasPendingBg).toBe(true);
});

test('hasPendingBg is false when gymnast is INVALID not PENDING', async () => {
  await createGymnast(club, parent, { bgNumberStatus: 'INVALID', bgNumber: 'BG222' });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === parent.id);
  expect(user.hasPendingBg).toBe(false);
});

test('hasPendingBg is true for adult participant gymnast linked via userId with PENDING status', async () => {
  // An adult participant is a gymnast linked to a user via userId (not via guardians)
  const adultUser = await createParent(club, { email: `adult-${Date.now()}@test.tl` });
  await prisma.gymnast.create({
    data: {
      firstName: 'Adult',
      lastName: 'Gymnast',
      dateOfBirth: new Date('2000-01-01'),
      clubId: club.id,
      bgNumber: 'BG999',
      bgNumberStatus: 'PENDING',
      userId: adultUser.id,
    },
  });

  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  const user = res.body.find(u => u.id === adultUser.id);
  expect(user).toBeDefined();
  expect(user.hasPendingBg).toBe(true);
});

test('hasPendingBg requires CLUB_ADMIN auth', async () => {
  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${parentToken}`);
  expect(res.status).toBe(403);
});
