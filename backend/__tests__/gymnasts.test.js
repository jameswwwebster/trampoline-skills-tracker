const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  createTestClub,
  createParent,
  createGymnast,
  tokenFor,
} = require('./helpers/seed');

const testApp = createTestApp();
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

describe('PATCH /api/gymnasts/:id/health-notes', () => {
  it('updates health notes for a guardian', async () => {
    const res = await request(testApp)
      .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ healthNotes: 'Asthma' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
    expect(updated.healthNotes).toBe('Asthma');
  });

  it('stores null when empty string sent', async () => {
    const res = await request(testApp)
      .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ healthNotes: '' });

    expect(res.status).toBe(200);
    const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
    expect(updated.healthNotes).toBeNull();
  });

  it('stores null when null sent', async () => {
    const res = await request(testApp)
      .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ healthNotes: null });

    expect(res.status).toBe(200);
    const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
    expect(updated.healthNotes).toBeNull();
  });

  it('returns 404 for gymnast in a different club', async () => {
    const otherClub = await createTestClub();
    const otherParent = await createParent(otherClub);
    const otherGymnast = await createGymnast(otherClub, otherParent);

    const res = await request(testApp)
      .patch(`/api/gymnasts/${otherGymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ healthNotes: 'Something' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-guardian, non-admin user', async () => {
    const otherParent = await createParent(club);
    const otherToken = tokenFor(otherParent);

    const res = await request(testApp)
      .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ healthNotes: 'Something' });

    expect(res.status).toBe(403);
  });

  it('stores "none" when the "none" sentinel is sent', async () => {
    const res = await request(testApp)
      .patch(`/api/gymnasts/${gymnast.id}/health-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ healthNotes: 'none' });

    expect(res.status).toBe(200);
    const updated = await prisma.gymnast.findUnique({ where: { id: gymnast.id } });
    expect(updated.healthNotes).toBe('none');
  });
});
