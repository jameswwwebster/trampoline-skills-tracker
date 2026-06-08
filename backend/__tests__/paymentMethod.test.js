require('./helpers/env');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, tokenFor } = require('./helpers/seed');

// Stripe SDK mocked — jest.mock() factories can't close over outer scope,
// so we build the mock inside the factory and look it up via the SDK
// constructor afterwards.
jest.mock('stripe', () => {
  const stripeMock = {
    customers: { create: jest.fn(), retrieve: jest.fn(), update: jest.fn() },
    paymentMethods: { retrieve: jest.fn(), list: jest.fn(), attach: jest.fn() },
    subscriptions: { list: jest.fn(), update: jest.fn() },
    setupIntents: { create: jest.fn() },
    invoices: { list: jest.fn() },
  };
  return jest.fn(() => stripeMock);
});

const app = require('../server');
const Stripe = require('stripe');
const stripeMock = Stripe('test-key'); // returns the same singleton mock per the factory

describe('Payment method + invoices', () => {
  let club, member, memberToken, admin, adminToken, otherClub, otherCoach, otherToken;

  beforeEach(async () => {
    await cleanDatabase();
    Object.values(stripeMock).forEach(group => Object.values(group).forEach(fn => fn.mockClear && fn.mockClear()));
    stripeMock.customers.update.mockResolvedValue({});
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [] });
    stripeMock.paymentMethods.attach.mockResolvedValue({});
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    stripeMock.subscriptions.update.mockResolvedValue({});
    stripeMock.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_xyz' });
    stripeMock.invoices.list.mockResolvedValue({ data: [] });

    club = await createTestClub();
    member = await createParent(club, { email: `pm-member-${Date.now()}@test.tl` });
    memberToken = tokenFor(member);
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `pm-admin-${Date.now()}@test.tl` });
    adminToken = tokenFor(admin);
    otherClub = await createTestClub();
    otherCoach = await createParent(otherClub, { role: 'COACH', email: `pm-other-${Date.now()}@test.tl` });
    otherToken = tokenFor(otherCoach);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('GET /payment-method returns null when member has no Stripe customer', async () => {
    const res = await request(app)
      .get('/api/booking/payment-method')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.paymentMethod).toBeNull();
    expect(res.body.customerId).toBeNull();
  });

  test('GET /payment-method returns brand/last4/exp when customer has a default PM', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_aaaa' } });
    stripeMock.customers.retrieve.mockResolvedValue({
      id: 'cus_aaaa',
      invoice_settings: { default_payment_method: 'pm_card123' },
    });
    stripeMock.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_card123', type: 'card',
      card: { brand: 'visa', last4: '4242', exp_month: 3, exp_year: 2028, funding: 'credit' },
    });
    const res = await request(app)
      .get('/api/booking/payment-method')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.paymentMethod).toEqual({
      id: 'pm_card123', brand: 'visa', last4: '4242', expMonth: 3, expYear: 2028, funding: 'credit',
    });
  });

  test('POST /setup-intent creates a Stripe customer if missing and returns client_secret', async () => {
    stripeMock.customers.create.mockResolvedValue({ id: 'cus_new' });
    const res = await request(app)
      .post('/api/booking/payment-method/setup-intent')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe('seti_secret_xyz');
    expect(stripeMock.customers.create).toHaveBeenCalledWith(expect.objectContaining({ email: member.email }));
    const reloaded = await prisma.user.findUnique({ where: { id: member.id } });
    expect(reloaded.stripeCustomerId).toBe('cus_new');
  });

  test('POST /confirm sets default + updates each live subscription', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_bbbb' } });
    stripeMock.subscriptions.list.mockResolvedValue({
      data: [
        { id: 'sub_active', status: 'active' },
        { id: 'sub_past_due', status: 'past_due' },
        { id: 'sub_cancelled', status: 'canceled' }, // should be skipped
      ],
    });
    const res = await request(app)
      .post('/api/booking/payment-method/confirm')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ paymentMethodId: 'pm_new' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subsUpdated).toBe(2);
    expect(stripeMock.customers.update).toHaveBeenCalledWith('cus_bbbb', {
      invoice_settings: { default_payment_method: 'pm_new' },
    });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_active', { default_payment_method: 'pm_new' });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('sub_past_due', { default_payment_method: 'pm_new' });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalledWith('sub_cancelled', expect.anything());
  });

  test('GET /invoices returns mapped invoice list trimmed to last year', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_cccc' } });
    stripeMock.invoices.list.mockResolvedValue({
      data: [
        {
          id: 'in_1', number: 'TL-001',
          created: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
          total: 4500, amount_paid: 4500, currency: 'gbp', status: 'paid',
          hosted_invoice_url: 'https://stripe/inv1', invoice_pdf: 'https://stripe/inv1.pdf',
          lines: { data: [{ description: 'Monthly membership', amount: 4500 }] },
        },
      ],
    });
    const res = await request(app)
      .get('/api/booking/invoices')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]).toMatchObject({
      id: 'in_1', total: 4500, status: 'paid',
      hostedInvoiceUrl: 'https://stripe/inv1',
    });
  });

  test('member-self endpoints 401 without auth', async () => {
    expect((await request(app).get('/api/booking/payment-method')).status).toBe(401);
    expect((await request(app).post('/api/booking/payment-method/setup-intent')).status).toBe(401);
    expect((await request(app).post('/api/booking/payment-method/confirm').send({ paymentMethodId: 'pm_x' })).status).toBe(401);
    expect((await request(app).get('/api/booking/invoices')).status).toBe(401);
  });

  test('admin in same club can GET /admin/users/:id/payment-method', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_dddd' } });
    stripeMock.customers.retrieve.mockResolvedValue({
      id: 'cus_dddd',
      invoice_settings: { default_payment_method: 'pm_visa' },
    });
    stripeMock.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_visa', type: 'card',
      card: { brand: 'visa', last4: '0001', exp_month: 12, exp_year: 2030, funding: 'debit' },
    });
    const res = await request(app)
      .get(`/api/booking/admin/users/${member.id}/payment-method`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.paymentMethod.last4).toBe('0001');
  });

  test('coach in a different club is forbidden', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_eeee' } });
    const res = await request(app)
      .get(`/api/booking/admin/users/${member.id}/payment-method`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('non-staff member is forbidden from admin endpoints', async () => {
    const res = await request(app)
      .get(`/api/booking/admin/users/${member.id}/payment-method`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('admin GET /admin/users/:id/invoices returns the list', async () => {
    await prisma.user.update({ where: { id: member.id }, data: { stripeCustomerId: 'cus_ffff' } });
    stripeMock.invoices.list.mockResolvedValue({
      data: [{
        id: 'in_a', number: 'TL-A', created: Math.floor(Date.now() / 1000),
        total: 1000, amount_paid: 1000, currency: 'gbp', status: 'paid',
        hosted_invoice_url: 'https://stripe/x', invoice_pdf: null,
        lines: { data: [{ description: 'x', amount: 1000 }] },
      }],
    });
    const res = await request(app)
      .get(`/api/booking/admin/users/${member.id}/invoices`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
  });
});
