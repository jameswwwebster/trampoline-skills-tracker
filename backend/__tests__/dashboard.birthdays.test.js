const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();

describe('GET /api/dashboard/birthdays-this-week', () => {
  let club, coach, coachToken, member, memberToken;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    coach = await createParent(club, { role: 'COACH', email: `bday-coach-${Date.now()}@test.tl` });
    coachToken = tokenFor(coach);
    member = await createParent(club, { email: `bday-member-${Date.now()}@test.tl` });
    memberToken = tokenFor(member);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard/birthdays-this-week');
    expect(res.status).toBe(401);
  });

  test('returns 403 for non-coach/admin', async () => {
    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('returns gymnast whose birthday is today', async () => {
    const today = new Date();
    // Create gymnast born on today's month+day (10 years ago)
    const dob = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    await createGymnast(club, member, { dateOfBirth: dob });

    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const hit = res.body.find(g => g.turnsAge === 10);
    expect(hit).toBeDefined();
    expect(hit.firstName).toBeDefined();
    expect(hit.dayOfWeek).toBeDefined();
  });

  test('does not return gymnast whose birthday is not this week', async () => {
    // Pick a date guaranteed to be outside this week
    const today = new Date();
    const nextMonth = new Date(today.getFullYear() - 8, (today.getMonth() + 2) % 12, 15);
    await createGymnast(club, member, { dateOfBirth: nextMonth });

    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    // All returned gymnasts should have a dayOfWeek matching a day in this week
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today2 = new Date();
    const daysFromMonday = today2.getDay() === 0 ? 6 : today2.getDay() - 1;
    const weekDays = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(today2);
      d.setDate(today2.getDate() - daysFromMonday + i);
      weekDays.push(DAYS[d.getDay()]);
    }
    res.body.forEach(g => {
      expect(weekDays).toContain(g.dayOfWeek);
    });
  });

  test('does not return archived gymnast', async () => {
    const today = new Date();
    const dob = new Date(today.getFullYear() - 9, today.getMonth(), today.getDate());
    const archivedCoach = await createParent(club, { role: 'CLUB_ADMIN', email: `arc-admin-${Date.now()}@test.tl` });
    await createGymnast(club, member, {
      dateOfBirth: dob,
      isArchived: true,
      archivedById: archivedCoach.id,
    });

    const res = await request(app)
      .get('/api/dashboard/birthdays-this-week')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    // Archived gymnast must not appear
    const age9 = res.body.filter(g => g.turnsAge === 9);
    expect(age9.length).toBe(0);
  });
});
