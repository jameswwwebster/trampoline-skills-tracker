// backend/__tests__/booking.attendance.test.js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, createConfirmedBooking, tokenFor } = require('./helpers/seed');

const app = createTestApp();

let club, otherClub, admin, adminToken, coach, coachToken, parent, gymnast1, gymnast2,
    template, instance, parentToken, otherAdmin, otherAdminToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  otherClub = await createTestClub();

  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `att-admin-${Date.now()}@test.tl` });
  coach = await createParent(club, { role: 'COACH', email: `att-coach-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `att-parent-${Date.now()}@test.tl` });
  otherAdmin = await createParent(otherClub, { role: 'CLUB_ADMIN', email: `att-other-${Date.now()}@test.tl` });

  adminToken = tokenFor(admin);
  coachToken = tokenFor(coach);
  parentToken = tokenFor(parent);
  otherAdminToken = tokenFor(otherAdmin);

  gymnast1 = await createGymnast(club, parent, { firstName: 'Alice', lastName: 'Smith' });
  gymnast2 = await createGymnast(club, parent, { firstName: 'Bob', lastName: 'Jones' });

  const sess = await createSession(club, new Date());
  template = sess.template;
  instance = sess.instance;
});

afterEach(async () => {
  await prisma.attendance.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.commitment.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

async function createCommitment(gymnast, tmpl, status = 'ACTIVE', startDate = null) {
  return prisma.commitment.create({
    data: {
      gymnastId: gymnast.id,
      templateId: tmpl.id,
      status,
      startDate,
      createdById: admin.id,
    },
  });
}

describe('GET /api/booking/attendance/:instanceId', () => {
  it('returns UNMARKED attendee from CONFIRMED booking', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({ id: instance.id });
    expect(res.body.attendees).toHaveLength(1);
    expect(res.body.attendees[0]).toMatchObject({
      gymnastId: gymnast1.id,
      firstName: 'Alice',
      status: 'UNMARKED',
    });
  });

  it('returns UNMARKED attendee from ACTIVE commitment with no startDate', async () => {
    await createCommitment(gymnast1, template, 'ACTIVE', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
    expect(res.body.attendees[0].gymnastId).toBe(gymnast1.id);
    expect(res.body.attendees[0].status).toBe('UNMARKED');
  });

  it('returns UNMARKED attendee from ACTIVE commitment with startDate in the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await createCommitment(gymnast1, template, 'ACTIVE', yesterday);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
  });

  it('excludes commitment with startDate in the future', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await createCommitment(gymnast1, template, 'ACTIVE', tomorrow);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(0);
  });

  it('excludes PAUSED commitment gymnasts', async () => {
    await createCommitment(gymnast1, template, 'PAUSED', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(0);
  });

  it('deduplicates gymnast appearing in both booking and commitment', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await createCommitment(gymnast1, template, 'ACTIVE', null);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees).toHaveLength(1);
  });

  it('returns PRESENT for gymnast with attendance record', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await prisma.attendance.create({
      data: {
        sessionInstanceId: instance.id,
        gymnastId: gymnast1.id,
        status: 'PRESENT',
        markedById: admin.id,
      },
    });

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].status).toBe('PRESENT');
  });

  it('returns ABSENT for gymnast with ABSENT attendance record', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
    await prisma.attendance.create({
      data: {
        sessionInstanceId: instance.id,
        gymnastId: gymnast1.id,
        status: 'ABSENT',
        markedById: admin.id,
      },
    });

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].status).toBe('ABSENT');
  });

  it('allows COACH to access', async () => {
    await createConfirmedBooking(parent, gymnast1, instance);

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
  });

  it('returns attendees sorted by firstName', async () => {
    await createConfirmedBooking(parent, gymnast1, instance); // Alice
    await createCommitment(gymnast2, template, 'ACTIVE', null); // Bob

    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.attendees[0].firstName).toBe('Alice');
    expect(res.body.attendees[1].firstName).toBe('Bob');
  });

  it('returns 404 for instance from a different club', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`);

    expect(res.status).toBe(401);
  });

  it('returns 403 for ADULT role', async () => {
    const res = await request(app)
      .get(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/booking/attendance/:instanceId', () => {
  beforeEach(async () => {
    await createConfirmedBooking(parent, gymnast1, instance);
  });

  it('creates PRESENT record for gymnast on list', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      gymnastId: gymnast1.id,
      firstName: 'Alice',
      status: 'PRESENT',
    });

    const record = await prisma.attendance.findUnique({
      where: { sessionInstanceId_gymnastId: { sessionInstanceId: instance.id, gymnastId: gymnast1.id } },
    });
    expect(record).not.toBeNull();
    expect(record.status).toBe('PRESENT');
    expect(record.markedById).toBe(admin.id);
  });

  it('upserts — second POST with ABSENT updates the record', async () => {
    await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'ABSENT' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ABSENT');

    const count = await prisma.attendance.count({
      where: { sessionInstanceId: instance.id, gymnastId: gymnast1.id },
    });
    expect(count).toBe(1);
  });

  it('returns 422 when gymnast is not on the expected list', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast2.id, status: 'PRESENT' });

    expect(res.status).toBe(422);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'MAYBE' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for instance from a different club', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for ADULT role', async () => {
    const res = await request(app)
      .post(`/api/booking/attendance/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ gymnastId: gymnast1.id, status: 'PRESENT' });

    expect(res.status).toBe(403);
  });
});
