const request = require('supertest');
const app = require('../server');
const { prisma } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

let club, parent, gymnast, parentToken, coachToken, coach;

beforeEach(async () => {
  club = await createTestClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent, { bgNumberStatus: null });
  parentToken = tokenFor(parent);
  coach = await createParent(club, { role: 'COACH', email: `coach-${Date.now()}@test.tl` });
  coachToken = tokenFor(coach);
});

test('parent can set BG number — becomes PENDING', async () => {
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number`)
    .set('Authorization', `Bearer ${parentToken}`)
    .send({ bgNumber: 'BG123456' });
  expect(res.status).toBe(200);
  expect(res.body.bgNumberStatus).toBe('PENDING');
  expect(res.body.bgNumberGraceDays).toBe(14);
});

test('staff setting BG number — becomes VERIFIED immediately', async () => {
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ bgNumber: 'BG123456' });
  expect(res.status).toBe(200);
  expect(res.body.bgNumberStatus).toBe('VERIFIED');
});

test('re-entry after INVALID gets 3-day grace', async () => {
  await prisma.gymnast.update({ where: { id: gymnast.id }, data: { bgNumber: 'OLD', bgNumberStatus: 'INVALID' } });
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number`)
    .set('Authorization', `Bearer ${parentToken}`)
    .send({ bgNumber: 'BG999999' });
  expect(res.status).toBe(200);
  expect(res.body.bgNumberGraceDays).toBe(3);
});

test('coach can verify a pending number', async () => {
  await prisma.gymnast.update({ where: { id: gymnast.id }, data: { bgNumber: 'BG123456', bgNumberStatus: 'PENDING' } });
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ action: 'verify' });
  expect(res.status).toBe(200);
  const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
  expect(updated.bgNumberStatus).toBe('VERIFIED');
});

test('coach can invalidate a pending number', async () => {
  await prisma.gymnast.update({ where: { id: gymnast.id }, data: { bgNumber: 'BG123456', bgNumberStatus: 'PENDING' } });
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ action: 'invalidate' });
  expect(res.status).toBe(200);
  const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
  expect(updated.bgNumberStatus).toBe('INVALID');
});

test('parent cannot call verify endpoint', async () => {
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
    .set('Authorization', `Bearer ${parentToken}`)
    .send({ action: 'verify' });
  expect(res.status).toBe(403);
});
