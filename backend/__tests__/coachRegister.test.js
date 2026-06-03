const request = require('supertest');
const app = require('../server');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, tokenFor } = require('./helpers/seed');

describe('Coach register share-token flow', () => {
  let club, admin, adminToken, parent, parentToken, gymnast, template, instance;

  beforeEach(async () => {
    await cleanDatabase();
    club = await createTestClub();
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `cov-admin-${Date.now()}@test.tl` });
    parent = await createParent(club, { email: `cov-parent-${Date.now()}@test.tl` });
    adminToken = tokenFor(admin);
    parentToken = tokenFor(parent);
    gymnast = await createGymnast(club, parent, {
      bgNumber: 'BG-XYZ', bgNumberStatus: 'VERIFIED',
      healthNotes: 'Asthma — inhaler in bag',
      emergencyContactName: 'Emergency Contact', emergencyContactPhone: '+44 7000 000000', emergencyContactRelationship: 'Parent',
      dateOfBirth: new Date(Date.UTC(2014, 5, 1)),
    });
    ({ template, instance } = await createSession(club));
    await prisma.booking.create({
      data: {
        userId: parent.id, sessionInstanceId: instance.id,
        status: 'CONFIRMED', totalAmount: 600,
        lines: { create: [{ gymnastId: gymnast.id, amount: 600 }] },
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('admin can create a token and the URL works without auth', async () => {
    const create = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    expect(create.status).toBe(201);
    expect(create.body.token).toBeTruthy();
    expect(create.body.url).toMatch(/\/api\/booking\/coach-register\//);

    const view = await request(app).get(`/api/booking/coach-register/${create.body.token}`);
    expect(view.status).toBe(200);
    expect(view.headers['content-type']).toMatch(/text\/html/);
    expect(view.text).toContain(gymnast.firstName);
    expect(view.text).toContain('Asthma'); // health notes
    expect(view.text).toContain('Emergency Contact');
  });

  test('non-admin gets 403 on create', async () => {
    const res = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ expiresInHours: 24 });
    expect(res.status).toBe(403);
  });

  test('invalid expiresInHours is rejected', async () => {
    const res = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 999 });
    expect(res.status).toBe(400);
  });

  test('expired token returns 404 with expired-message page', async () => {
    const create = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    await prisma.sessionRegisterToken.update({ where: { id: create.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const view = await request(app).get(`/api/booking/coach-register/${create.body.token}`);
    expect(view.status).toBe(404);
    expect(view.text).toContain('Link expired');
  });

  test('unknown token returns 404', async () => {
    const view = await request(app).get('/api/booking/coach-register/totally-not-real');
    expect(view.status).toBe(404);
  });

  test('viewing bumps viewCount + lastViewedAt', async () => {
    const create = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    await request(app).get(`/api/booking/coach-register/${create.body.token}`);
    await request(app).get(`/api/booking/coach-register/${create.body.token}`);
    const row = await prisma.sessionRegisterToken.findUnique({ where: { id: create.body.id } });
    expect(row.viewCount).toBe(2);
    expect(row.lastViewedAt).toBeTruthy();
  });

  test('revoke disables the token', async () => {
    const create = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    const revoke = await request(app)
      .delete(`/api/booking/admin/sessions/register-tokens/${create.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revoke.status).toBe(200);
    const view = await request(app).get(`/api/booking/coach-register/${create.body.token}`);
    expect(view.status).toBe(404);
  });

  test('list endpoint returns only live tokens for that session', async () => {
    const live = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    const expired = await request(app)
      .post(`/api/booking/admin/sessions/${instance.id}/register-token`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 24 });
    await prisma.sessionRegisterToken.update({ where: { id: expired.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const list = await request(app)
      .get(`/api/booking/admin/sessions/${instance.id}/register-tokens`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const ids = list.body.map(t => t.id);
    expect(ids).toContain(live.body.id);
    expect(ids).not.toContain(expired.body.id);
  });
});
