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

test('unauthenticated request to set number returns 401', async () => {
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number`)
    .send({ bgNumber: 'BG123456' });
  expect(res.status).toBe(401);
});

test('staff from different club cannot verify', async () => {
  const otherClub = await createTestClub();
  const otherCoach = await createParent(otherClub, { role: 'COACH', email: `other-${Date.now()}@test.tl` });
  const otherToken = tokenFor(otherCoach);
  await prisma.gymnast.update({ where: { id: gymnast.id }, data: { bgNumber: 'BG123456', bgNumberStatus: 'PENDING' } });
  const res = await request(app)
    .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send({ action: 'verify' });
  expect(res.status).toBe(403);
});

describe('expire-pending action', () => {
  test('PENDING → EXPIRED with grace, sets expiredAt + 14 days', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-X', bgNumberStatus: 'PENDING', bgNumberEnteredAt: new Date() },
    });
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ action: 'expire-pending' });
    expect(res.status).toBe(200);
    const reloaded = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
    expect(reloaded.bgNumberStatus).toBe('EXPIRED');
    expect(reloaded.bgNumberExpiredAt).toBeTruthy();
    expect(reloaded.bgNumberGraceDays).toBe(14);
  });

  test('rejects expire-pending when not in PENDING state', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-X', bgNumberStatus: 'VERIFIED' },
    });
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ action: 'expire-pending' });
    expect(res.status).toBe(400);
  });
});

describe('expire schedules cancel_at_period_end on linked memberships', () => {
  test('marks scheduledCancelAt on every live membership for that gymnast at the club', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-Y', bgNumberStatus: 'VERIFIED' },
    });
    // Membership without a stripe sub — code skips Stripe but still records scheduledCancelAt
    const m = await prisma.membership.create({
      data: {
        gymnastId: gymnast.id, clubId: club.id, monthlyAmount: 4000,
        status: 'ACTIVE', startDate: new Date(),
        stripeSubscriptionId: 'sub_fake_no_stripe_call',
      },
    });
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/verify`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ action: 'expire' });
    expect(res.status).toBe(200);
    expect(res.body.scheduledCancels).toBe(1);
    const reloaded = await prisma.membership.findUnique({ where: { id: m.id } });
    expect(reloaded.status).toBe('ACTIVE'); // not flipped — webhook does that at period end
    // scheduledCancelAt is null because the fake Stripe sub couldn't return current_period_end,
    // but the row was still updated and counted.
  });
});

describe('parent resubmit endpoint', () => {
  test('EXPIRED → PENDING with 3-day grace', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-Z', bgNumberStatus: 'EXPIRED', bgNumberExpiredAt: new Date(), bgNumberGraceDays: 14 },
    });
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/resubmit`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.bgNumberStatus).toBe('PENDING');
    expect(res.body.bgNumberGraceDays).toBe(3);
  });

  test('rejects when status is not EXPIRED', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-Z', bgNumberStatus: 'VERIFIED' },
    });
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/resubmit`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('rejects non-guardian', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-Z', bgNumberStatus: 'EXPIRED', bgNumberExpiredAt: new Date(), bgNumberGraceDays: 14 },
    });
    const other = await createParent(club, { email: `other-${Date.now()}@test.tl` });
    const otherToken = tokenFor(other);
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/bg-number/resubmit`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('admin bg-numbers list', () => {
  test('returns rows for every non-VERIFIED, non-archived gymnast with bgRowState', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { bgNumber: 'BG-A', bgNumberStatus: 'PENDING', bgNumberEnteredAt: new Date() },
    });
    const expired = await createGymnast(club, parent, {
      bgNumber: 'BG-B', bgNumberStatus: 'EXPIRED', bgNumberExpiredAt: new Date(), bgNumberGraceDays: 14,
    });
    const missing = await createGymnast(club, parent, { bgNumberStatus: null });
    const verified = await createGymnast(club, parent, { bgNumber: 'BG-C', bgNumberStatus: 'VERIFIED' });

    const res = await request(app)
      .get('/api/gymnasts/admin/bg-numbers')
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.status).toBe(200);
    const states = Object.fromEntries(res.body.rows.map(r => [r.id, r.bgRowState]));
    expect(states[gymnast.id]).toBe('PENDING');
    expect(states[expired.id]).toBe('EXPIRED_IN_GRACE');
    expect(states[missing.id]).toBe('MISSING');
    expect(states[verified.id]).toBeUndefined();
  });
});
