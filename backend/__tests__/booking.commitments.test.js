const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, createMembership, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, coach, coachToken, parent, parentToken, gymnast, template;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `commit-admin-${Date.now()}@test.tl` });
  coach = await createParent(club, { role: 'COACH', email: `commit-coach-${Date.now()}@test.tl` });
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  await createMembership(gymnast, club);
  const sess = await createSession(club);
  template = sess.template;
  adminToken = tokenFor(admin);
  coachToken = tokenFor(coach);
  parentToken = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// Helper: create a commitment directly in DB for reuse across tests
async function seedCommitment(overrides = {}) {
  return prisma.commitment.create({
    data: {
      gymnastId: gymnast.id,
      templateId: template.id,
      createdById: coach.id,
      ...overrides,
    },
  });
}

describe('POST /api/commitments', () => {
  afterEach(async () => {
    await prisma.commitment.deleteMany({});
  });

  it('coach can create a commitment', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.createdById).toBe(coach.id);
  });

  it('returns 409 if commitment already exists', async () => {
    await seedCommitment();
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(409);
  });

  it('returns 404 if gymnast not in club', async () => {
    const otherClub = await createTestClub();
    const otherGymnast = await createGymnast(otherClub, parent);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: otherGymnast.id, templateId: template.id });

    expect(res.status).toBe(404);
  });

  it('returns 400 if template not in club', async () => {
    const otherClub = await createTestClub();
    const { template: otherTemplate } = await createSession(otherClub);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: otherTemplate.id });

    expect(res.status).toBe(400);
  });

  it('returns 422 if gymnast has no active membership', async () => {
    const noMembershipGymnast = await createGymnast(club, parent);
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: noMembershipGymnast.id, templateId: template.id });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/active membership/);
  });

  it('returns 422 if gymnast BG number is not verified', async () => {
    const noBgGymnast = await createGymnast(club, parent, { bgNumberStatus: 'PENDING' });
    await createMembership(noBgGymnast, club);
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: noBgGymnast.id, templateId: template.id });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/British Gymnastics/);
  });

  it('returns 403 if parent tries to create commitment', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(403);
  });

  it('creates an audit log entry', async () => {
    await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.create' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ gymnastId: gymnast.id, templateId: template.id });
  });
});

describe('DELETE /api/commitments/:id', () => {
  let commitment;
  beforeEach(async () => { commitment = await seedCommitment(); });
  afterEach(async () => { await prisma.commitment.deleteMany({}); });

  it('coach can delete a commitment', async () => {
    const res = await request(app)
      .delete(`/api/commitments/${commitment.id}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const found = await prisma.commitment.findUnique({ where: { id: commitment.id } });
    expect(found).toBeNull();
  });

  it('returns 404 for unknown commitment', async () => {
    const res = await request(app)
      .delete('/api/commitments/nonexistent-id')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/commitments/:id/status', () => {
  let commitment;
  beforeEach(async () => { commitment = await seedCommitment(); });
  afterEach(async () => { await prisma.commitment.deleteMany({}); });

  it('coach can pause a commitment', async () => {
    const res = await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAUSED');
    expect(res.body.pausedAt).toBeTruthy();
    expect(res.body.pausedById).toBe(coach.id);
  });

  it('coach can resume a commitment', async () => {
    // First pause it
    await prisma.commitment.update({
      where: { id: commitment.id },
      data: { status: 'PAUSED', pausedAt: new Date(), pausedById: coach.id },
    });

    const res = await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.pausedAt).toBeNull();
    expect(res.body.pausedById).toBeNull();
  });

  it('creates an audit log entry on status change', async () => {
    await request(app)
      .patch(`/api/commitments/${commitment.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.status' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ status: 'PAUSED' });
  });
});

describe('GET /api/commitments?templateId=xxx', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('admin lists commitments for a template', async () => {
    const res = await request(app)
      .get(`/api/commitments?templateId=${template.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(commitment.id);
    expect(res.body[0].gymnast.firstName).toBeDefined();
  });

  it('returns 400 if templateId is absent', async () => {
    const res = await request(app)
      .get('/api/commitments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('returns 403 for parent', async () => {
    const res = await request(app)
      .get(`/api/commitments?templateId=${template.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/commitments/gymnast/:gymnastId', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('admin lists commitments for a gymnast', async () => {
    const res = await request(app)
      .get(`/api/commitments/gymnast/${gymnast.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(commitment.id);
    expect(res.body[0].template.dayOfWeek).toBeDefined();
  });
});

describe('GET /api/commitments/mine?templateId=xxx', () => {
  let commitment;
  beforeAll(async () => {
    await prisma.commitment.deleteMany({});
    commitment = await seedCommitment();
  });
  afterAll(async () => { await prisma.commitment.deleteMany({}); });

  it('parent sees their gymnast commitment status', async () => {
    const res = await request(app)
      .get(`/api/commitments/mine?templateId=${template.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some(c => c.gymnastId === gymnast.id)).toBe(true);
    expect(res.body[0].status).toBe('ACTIVE');
  });

  it('returns 400 if templateId is absent', async () => {
    const res = await request(app)
      .get('/api/commitments/mine')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(400);
  });

  it('does not return commitments for other users gymnasts', async () => {
    const otherParent = await createParent(club, { email: `other-${Date.now()}@test.tl` });
    const otherToken = tokenFor(otherParent);

    const res = await request(app)
      .get(`/api/commitments/mine?templateId=${template.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('POST /api/commitments — competitive slots cap', () => {
  let cappedTemplate;

  beforeAll(async () => {
    const { template: t } = await createSession(club, undefined, { competitiveSlots: 1 });
    cappedTemplate = t;
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: cappedTemplate.id } });
  });

  it('creates as ACTIVE when under cap', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: cappedTemplate.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('creates as WAITLISTED when at cap', async () => {
    // Fill the cap
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate.id, createdById: coach.id, status: 'ACTIVE' },
    });

    const gymnast2 = await createGymnast(club, parent);
    await createMembership(gymnast2, club);

    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast2.id, templateId: cappedTemplate.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITLISTED');
  });

  it('creates as ACTIVE when no cap is set', async () => {
    const res = await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast.id, templateId: template.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('audit action is commitment.waitlisted when waitlisted', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const gymnast3 = await createGymnast(club, parent);
    await createMembership(gymnast3, club);

    await request(app)
      .post('/api/commitments')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ gymnastId: gymnast3.id, templateId: cappedTemplate.id });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.waitlisted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ gymnastId: gymnast3.id, templateId: cappedTemplate.id });
  });
});

describe('PATCH /api/commitments/:id/status — transitions', () => {
  let cappedTemplate2;

  beforeAll(async () => {
    const { template: t } = await createSession(club, undefined, { competitiveSlots: 1 });
    cappedTemplate2 = t;
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: cappedTemplate2.id } });
  });

  it('promotes WAITLISTED -> ACTIVE when slot available', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('returns 422 promoting WAITLISTED -> ACTIVE when cap is full', async () => {
    const gymnast4 = await createGymnast(club, parent);
    await createMembership(gymnast4, club);

    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast4.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/No competitive slot/);
  });

  it('returns 422 resuming PAUSED -> ACTIVE when cap is full', async () => {
    const gymnast5 = await createGymnast(club, parent);
    await createMembership(gymnast5, club);

    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'ACTIVE' },
    });
    const paused = await prisma.commitment.create({
      data: { gymnastId: gymnast5.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'PAUSED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${paused.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Competitive slots are full/);
  });

  it('returns 422 for WAITLISTED -> PAUSED transition', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    const res = await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'PAUSED' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Invalid status transition/);
  });

  it('audit action is commitment.promoted for WAITLISTED -> ACTIVE', async () => {
    const waitlisted = await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: cappedTemplate2.id, createdById: coach.id, status: 'WAITLISTED' },
    });

    await request(app)
      .patch(`/api/commitments/${waitlisted.id}/status`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ status: 'ACTIVE' });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'commitment.promoted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ templateId: cappedTemplate2.id });
  });
});
