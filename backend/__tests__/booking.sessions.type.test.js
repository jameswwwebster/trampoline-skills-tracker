const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, parent, token;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  parent = await createParent(club, { role: 'COACH', email: `coach-type-${Date.now()}@test.tl` });
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

describe('Session capacity accounts for active commitments', () => {
  let club2, coach2, coachToken2, gymnast2, template2, instance2;

  beforeAll(async () => {
    const { createGymnast } = require('./helpers/seed');
    club2 = await createTestClub();
    coach2 = await createParent(club2, { role: 'COACH', email: `cap-coach-${Date.now()}@test.tl` });
    coachToken2 = tokenFor(coach2);
    const parent2 = await createParent(club2);
    gymnast2 = await createGymnast(club2, parent2);
    ({ template: template2, instance: instance2 } = await createSession(club2));

    // Create an ACTIVE commitment — this should count against capacity
    await prisma.commitment.create({
      data: { gymnastId: gymnast2.id, templateId: template2.id, createdById: coach2.id },
    });
  });

  afterAll(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: template2.id } });
  });

  it('GET / includes activeCommitments in bookedCount', async () => {
    const d = instance2.date;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const res = await request(app)
      .get(`/api/booking/sessions?year=${year}&month=${month}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.id === instance2.id);
    expect(sess).toBeDefined();
    expect(sess.bookedCount).toBe(1); // 0 bookings + 1 active commitment
    expect(sess.activeCommitments).toBe(1);
    expect(sess.availableSlots).toBe(template2.openSlots - 1);
  });

  it('GET /:instanceId includes activeCommitments and templateId', async () => {
    const res = await request(app)
      .get(`/api/booking/sessions/${instance2.id}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.status).toBe(200);
    expect(res.body.bookedCount).toBe(1);
    expect(res.body.activeCommitments).toBe(1);
    expect(res.body.templateId).toBe(template2.id);
  });

  it('paused commitment does not count against capacity', async () => {
    await prisma.commitment.updateMany({
      where: { templateId: template2.id },
      data: { status: 'PAUSED' },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance2.id}`)
      .set('Authorization', `Bearer ${coachToken2}`);

    expect(res.body.bookedCount).toBe(0);
    expect(res.body.activeCommitments).toBe(0);

    // Reset for other tests
    await prisma.commitment.updateMany({
      where: { templateId: template2.id },
      data: { status: 'ACTIVE' },
    });
  });
});

describe('GET /api/booking/sessions — DMT visibility for parents', () => {
  let visClub, dmtParent, dmtParentToken, noApprovalParent, noApprovalToken;
  let dmtInstance, trampolineInstance;

  beforeAll(async () => {
    const { createGymnast } = require('./helpers/seed');
    visClub = await createTestClub();

    // Parent whose gymnast IS DMT approved
    dmtParent = await createParent(visClub, { email: `dmt-vis-${Date.now()}@test.tl` });
    const dmtGymnast = await createGymnast(visClub, dmtParent);
    await prisma.gymnast.update({ where: { id: dmtGymnast.id }, data: { dmtApproved: true } });
    dmtParentToken = tokenFor(dmtParent);

    // Parent whose gymnast is NOT DMT approved
    noApprovalParent = await createParent(visClub, { email: `no-dmt-${Date.now()}@test.tl` });
    await createGymnast(visClub, noApprovalParent);
    noApprovalToken = tokenFor(noApprovalParent);

    // Create one DMT session and one TRAMPOLINE session in the same month
    const { instance: di } = await createSession(visClub, undefined, { type: 'DMT' });
    const { instance: ti } = await createSession(visClub, undefined, { type: 'TRAMPOLINE' });
    dmtInstance = di;
    trampolineInstance = ti;
  });

  afterAll(async () => {
    await prisma.sessionInstance.deleteMany({ where: { templateId: { in: [dmtInstance.templateId, trampolineInstance.templateId] } } });
    await prisma.sessionTemplate.deleteMany({ where: { id: { in: [dmtInstance.templateId, trampolineInstance.templateId] } } });
  });

  it('parent with no DMT-approved gymnasts does not see DMT sessions', async () => {
    const d = dmtInstance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${noApprovalToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(s => s.id);
    expect(ids).not.toContain(dmtInstance.id);
    expect(ids).toContain(trampolineInstance.id);
  });

  it('parent with a DMT-approved gymnast sees DMT sessions', async () => {
    const d = dmtInstance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${dmtParentToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map(s => s.id);
    expect(ids).toContain(dmtInstance.id);
  });
});
