const request = require('supertest');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const app = require('../server');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, tokenFor } = require('./helpers/seed');

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '..');
const WELFARE_DIR = path.join(STORAGE_ROOT, 'uploads', 'welfare');

describe('Welfare attachments', () => {
  let club, admin, adminToken, parent, parentToken, report;

  beforeEach(async () => {
    await cleanDatabase();
    club = await createTestClub();
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `welf-admin-${Date.now()}@test.tl` });
    parent = await createParent(club, { email: `welf-parent-${Date.now()}@test.tl` });
    adminToken = tokenFor(admin);
    parentToken = tokenFor(parent);
    report = await prisma.welfareReport.create({
      data: {
        clubId: club.id, reportedById: admin.id,
        incidentDate: new Date(), concernType: 'OTHER', severity: 'MINOR',
        description: 'test',
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('uploads two images and persists rows + files', async () => {
    const res = await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', Buffer.from('fake png 1'), { filename: 'a.png', contentType: 'image/png' })
      .attach('files', Buffer.from('fake jpeg 2'), { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.length).toBe(2);
    const rows = await prisma.welfareAttachment.findMany({ where: { welfareReportId: report.id } });
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(fs.existsSync(path.join(STORAGE_ROOT, r.storedPath))).toBe(true);
    }
  });

  test('rejects unsupported mime type', async () => {
    const res = await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });

  test('rejects oversized file', async () => {
    const big = Buffer.alloc(26 * 1024 * 1024, 0); // 26 MB
    const res = await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', big, { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  test('non-admin gets 403', async () => {
    const res = await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${parentToken}`)
      .attach('files', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  test('delete attachment removes row + file', async () => {
    const upload = await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', Buffer.from('hello'), { filename: 'a.png', contentType: 'image/png' });
    const att = upload.body[0];
    const stored = (await prisma.welfareAttachment.findUnique({ where: { id: att.id } })).storedPath;
    const abs = path.join(STORAGE_ROOT, stored);
    expect(fs.existsSync(abs)).toBe(true);
    const del = await request(app)
      .delete(`/api/welfare/${report.id}/attachments/${att.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    expect(await prisma.welfareAttachment.findUnique({ where: { id: att.id } })).toBeNull();
    expect(fs.existsSync(abs)).toBe(false);
  });

  test('deleting the welfare report cascades attachments and removes the folder', async () => {
    await request(app)
      .post(`/api/welfare/${report.id}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' });
    const dir = path.join(WELFARE_DIR, report.id);
    expect(fs.existsSync(dir)).toBe(true);
    const del = await request(app)
      .delete(`/api/welfare/${report.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    expect(await prisma.welfareAttachment.findMany({ where: { welfareReportId: report.id } })).toEqual([]);
    expect(fs.existsSync(dir)).toBe(false);
  });
});
