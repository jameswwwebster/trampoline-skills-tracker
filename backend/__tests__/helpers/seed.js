const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('./db');

const PASSWORD = 'password123';
const HASHED_PASSWORD = bcrypt.hashSync(PASSWORD, 10);

/**
 * Create (or find) the "Trampoline Life" club needed by the register endpoint.
 * Uses upsert so it is safe to call multiple times.
 */
async function ensureTrampolineLifeClub() {
  const existing = await prisma.club.findFirst({ where: { name: 'Trampoline Life' } });
  if (existing) return existing;
  return prisma.club.create({ data: { name: 'Trampoline Life', emailEnabled: false } });
}

/**
 * Create a dedicated test club (used for session/booking tests so we don't
 * pollute the "Trampoline Life" club used by auth).
 */
async function createTestClub() {
  return prisma.club.create({ data: { name: 'Test Club TL', emailEnabled: false } });
}

async function createParent(club, overrides = {}) {
  const unique = Date.now() + Math.random().toString(36).slice(2, 7);
  return prisma.user.create({
    data: {
      email: `parent-${unique}@test.tl`,
      phone: '07700900000',
      password: HASHED_PASSWORD,
      firstName: 'Test',
      lastName: 'Parent',
      role: 'PARENT',
      clubId: club.id,
      ...overrides,
    },
  });
}

async function createGymnast(club, guardian, overrides = {}) {
  const unique = Date.now() + Math.random().toString(36).slice(2, 7);
  return prisma.gymnast.create({
    data: {
      firstName: 'Test',
      lastName: `Gymnast${unique}`,
      dateOfBirth: new Date('2012-01-01'),
      clubId: club.id,
      bgNumberStatus: 'VERIFIED', // avoids BG number check in booking tests
      guardians: { connect: { id: guardian.id } },
      ...overrides,
    },
  });
}

/**
 * Create a session template + instance.
 * @param {object} club
 * @param {Date}   date    defaults to 7 days from now (future session)
 */
async function createSession(club, date) {
  const sessionDate = date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // Normalise to midnight UTC
  sessionDate.setUTCHours(0, 0, 0, 0);

  const template = await prisma.sessionTemplate.create({
    data: {
      clubId: club.id,
      dayOfWeek: sessionDate.getDay(),
      startTime: '10:00',
      endTime: '11:00',
      openSlots: 10,
    },
  });

  const instance = await prisma.sessionInstance.create({
    data: {
      templateId: template.id,
      date: sessionDate,
    },
  });

  return { template, instance };
}

/** Create a CONFIRMED booking for a parent + gymnast on a given session instance. */
async function createConfirmedBooking(parent, gymnast, instance) {
  return prisma.booking.create({
    data: {
      userId: parent.id,
      sessionInstanceId: instance.id,
      status: 'CONFIRMED',
      totalAmount: 600,
      lines: { create: [{ gymnastId: gymnast.id, amount: 600 }] },
    },
    include: { lines: true },
  });
}

/** Create a credit for a user. */
async function createCredit(user, amount = 600, expiresInDays = 30) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  return prisma.credit.create({
    data: { userId: user.id, amount, expiresAt },
  });
}

/** Generate a JWT for a user (same algorithm the app uses). */
function tokenFor(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

/** Create a membership for a gymnast. */
async function createMembership(gymnast, club, overrides = {}) {
  return prisma.membership.create({
    data: {
      gymnastId: gymnast.id,
      clubId: club.id,
      monthlyAmount: 3000,
      status: 'ACTIVE',
      startDate: new Date(),
      ...overrides,
    },
  });
}

module.exports = {
  PASSWORD,
  ensureTrampolineLifeClub,
  createTestClub,
  createParent,
  createGymnast,
  createSession,
  createConfirmedBooking,
  createCredit,
  createMembership,
  tokenFor,
};
