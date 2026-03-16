/**
 * Parent auth flows:
 *  - register
 *  - login
 *  - GET /me
 *  - forgot-password / reset-password
 */

const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const { ensureTrampolineLifeClub, createParent, tokenFor, PASSWORD } = require('../helpers/seed');

// Prevent real emails during tests
jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendMembershipCreatedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const app = createTestApp();

let club;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ─── Registration ────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const unique = () => `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  it('creates an account and returns a token', async () => {
    const email = `${unique()}@test.tl`;
    const res = await request(app).post('/api/auth/register').send({
      email,
      phone: '07700900001',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('ADULT');
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    const email = `${unique()}@test.tl`;
    await request(app).post('/api/auth/register').send({
      email, phone: '07700900002', password: 'password123', firstName: 'Alice', lastName: 'Smith',
    });

    const res = await request(app).post('/api/auth/register').send({
      email, phone: '07700900003', password: 'password123', firstName: 'Alice', lastName: 'Smith',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('rejects missing phone', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `${unique()}@test.tl`,
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    expect(res.status).toBe(400);
  });

  it('rejects password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `${unique()}@test.tl`,
      phone: '07700900004',
      password: 'abc',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    expect(res.status).toBe(400);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let parent;

  beforeAll(async () => {
    parent = await createParent(club);
  });

  it('returns a token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: parent.email,
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe(parent.id);
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: parent.email,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.tl',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let parent;

  beforeAll(async () => {
    parent = await createParent(club);
  });

  it('returns the current user for a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(parent.id);
    expect(res.body.email).toBe(parent.email);
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// ─── Forgot / Reset Password ──────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  let parent;

  beforeAll(async () => {
    parent = await createParent(club);
  });

  it('responds 200 (success: true) for an existing email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: parent.email });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('responds 200 (success: true) for a non-existent email — does not reveal existence', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.tl' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  let parent;
  let resetToken;

  beforeAll(async () => {
    parent = await createParent(club);

    // Plant a known reset token directly in the DB
    resetToken = 'valid-reset-token-abc123';
    await prisma.user.update({
      where: { id: parent.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      },
    });
  });

  it('resets the password with a valid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      password: 'newpassword123',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify new password works
    const loginRes = await request(app).post('/api/auth/login').send({
      email: parent.email,
      password: 'newpassword123',
    });
    expect(loginRes.status).toBe(200);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'completely-wrong-token',
      password: 'newpassword123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('rejects an expired token', async () => {
    const expiredToken = 'expired-token-xyz';
    await prisma.user.update({
      where: { id: parent.id },
      data: {
        passwordResetToken: expiredToken,
        passwordResetTokenExpiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await request(app).post('/api/auth/reset-password').send({
      token: expiredToken,
      password: 'newpassword123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('rejects a password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      password: 'abc',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a request missing the token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      password: 'newpassword123',
    });
    expect(res.status).toBe(400);
  });
});
