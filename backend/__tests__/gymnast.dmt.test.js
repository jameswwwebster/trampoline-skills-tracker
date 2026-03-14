const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, parent, gymnast, token;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  token = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/gymnasts/bookable-for-me', () => {
  it('includes dmtApproved field (default false)', async () => {
    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const g = res.body.find(g => g.id === gymnast.id);
    expect(g).toBeDefined();
    expect(g.dmtApproved).toBe(false);
  });

  it('returns dmtApproved=true after approval', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { dmtApproved: true, dmtApprovedAt: new Date() },
    });

    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    const g = res.body.find(g => g.id === gymnast.id);
    expect(g.dmtApproved).toBe(true);
  });

  it('includes dmtApproved for linked child gymnasts (the children select path)', async () => {
    const childGymnast = await createGymnast(club, parent, { dmtApproved: true, dmtApprovedAt: new Date() });

    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    const g = res.body.find(g => g.id === childGymnast.id);
    expect(g).toBeDefined();
    expect(g.dmtApproved).toBe(true);
  });
});

describe('PATCH /api/gymnasts/:id/dmt-approval', () => {
  let coach, coachToken;

  beforeAll(async () => {
    coach = await createParent(club, { role: 'COACH', email: `dmt-coach-${Date.now()}@test.tl` });
    coachToken = tokenFor(coach);
  });

  it('coach can approve a gymnast for DMT', async () => {
    // reset
    await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: false, dmtApprovedAt: null, dmtApprovedById: null } });

    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approved: true });

    expect(res.status).toBe(200);
    expect(res.body.dmtApproved).toBe(true);
    expect(res.body.dmtApprovedAt).toBeTruthy();
    expect(res.body.dmtApprovedById).toBe(coach.id);
  });

  it('coach can revoke DMT approval', async () => {
    // Set all three fields so the test verifies they are cleared
    await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: true, dmtApprovedAt: new Date(), dmtApprovedById: coach.id } });

    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approved: false });

    expect(res.status).toBe(200);
    expect(res.body.dmtApproved).toBe(false);
    expect(res.body.dmtApprovedAt).toBeNull();
    expect(res.body.dmtApprovedById).toBeNull();
  });

  it('parent cannot change DMT approval', async () => {
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true });

    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
      .send({ approved: true });

    expect(res.status).toBe(401);
  });

  it('creates an audit log entry on approval', async () => {
    await prisma.gymnast.update({ where: { id: gymnast.id }, data: { dmtApproved: false, dmtApprovedAt: null, dmtApprovedById: null } });

    await request(app)
      .patch(`/api/gymnasts/${gymnast.id}/dmt-approval`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approved: true });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'gymnast.dmt_approval' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ approved: true, gymnastId: gymnast.id });
  });
});
