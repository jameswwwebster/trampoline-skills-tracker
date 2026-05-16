require('./helpers/env');
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { cleanDatabase } = require('./helpers/db');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
      }),
    },
  }));
});

let app;
let token;
let userId;

beforeAll(async () => {
  app = createTestApp();
  // Create a test user
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const user = await prisma.user.create({
    data: {
      email: 'shop-test@test.tl',
      password: await bcrypt.hash('password', 10),
      firstName: 'Shop',
      lastName: 'Test',
      role: 'ADULT',
    },
  });
  userId = user.id;
  token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/shop/orders', () => {
  it('creates a pending shop order and returns clientSecret', async () => {
    const res = await request(app)
      .post('/api/booking/shop/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { productId: 'hoodie', size: 'Adult M', quantity: 1, customisation: 'JW' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.orderId).toBeDefined();

    const order = await prisma.shopOrder.findUnique({ where: { id: res.body.orderId }, include: { items: true } });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.items).toHaveLength(1);
    expect(order.total).toBe(2000); // £20 in pence
  });

  it('rejects unknown productId', async () => {
    const res = await request(app)
      .post('/api/booking/shop/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 'nonexistent', size: 'M', quantity: 1 }] });

    expect(res.status).toBe(400);
  });

  it('rejects unknown size', async () => {
    const res = await request(app)
      .post('/api/booking/shop/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: 'hoodie', size: 'XXXL', quantity: 1, customisation: 'JW' }] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/booking/shop/my-orders', () => {
  it('returns only ORDERED/ARRIVED/FULFILLED orders for current user', async () => {
    const res = await request(app)
      .get('/api/booking/shop/my-orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // PENDING_PAYMENT orders should not appear
    res.body.forEach(o => {
      expect(o.status).not.toBe('PENDING_PAYMENT');
    });
  });
});

describe('PATCH /api/booking/shop/admin/orders/:orderId/items/:itemId', () => {
  let adminToken, parentUserId, parentToken, order;

  beforeAll(async () => {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    // Hub admin user — note no clubId needed since item update doesn't club-scope
    const admin = await prisma.user.create({
      data: { email: `shop-admin-${Date.now()}@test.tl`, password: await bcrypt.hash('pw', 10), firstName: 'Admin', lastName: 'X', role: 'CLUB_ADMIN' },
    });
    adminToken = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET);
    const parent = await prisma.user.create({
      data: { email: `shop-parent-${Date.now()}@test.tl`, password: await bcrypt.hash('pw', 10), firstName: 'Parent', lastName: 'X', role: 'ADULT' },
    });
    parentUserId = parent.id;
    parentToken = jwt.sign({ userId: parent.id }, process.env.JWT_SECRET);

    order = await prisma.shopOrder.create({
      data: {
        userId: parent.id, status: 'ORDERED', stripePaymentIntentId: `pi_test_${Date.now()}`,
        total: 4000,
        items: { create: [
          { productId: 'hoodie', productName: 'Hoodie', size: 'M', quantity: 1, price: 2000 },
          { productId: 'tshirt', productName: 'T-shirt', size: 'L', quantity: 1, price: 2000 },
        ] },
      },
      include: { items: true },
    });
  });

  it('updates item status and recomputes order status', async () => {
    const item = order.items[0];
    const res = await request(app)
      .patch(`/api/booking/shop/admin/orders/${order.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ORDERED_FROM_SUPPLIER' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ORDERED'); // not all items arrived yet
    const fresh = await prisma.shopOrderItem.findUnique({ where: { id: item.id } });
    expect(fresh.status).toBe('ORDERED_FROM_SUPPLIER');
  });

  it('persists supplier text', async () => {
    const item = order.items[0];
    const res = await request(app)
      .patch(`/api/booking/shop/admin/orders/${order.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier: 'Champion' });
    expect(res.status).toBe(200);
    const fresh = await prisma.shopOrderItem.findUnique({ where: { id: item.id } });
    expect(fresh.supplier).toBe('Champion');
  });

  it('flips order status to ARRIVED when all items ARRIVED', async () => {
    for (const it of order.items) {
      await request(app)
        .patch(`/api/booking/shop/admin/orders/${order.id}/items/${it.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARRIVED' });
    }
    const reloaded = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    expect(reloaded.status).toBe('ARRIVED');
  });

  it('flips to FULFILLED when all items FULFILLED', async () => {
    for (const it of order.items) {
      await request(app)
        .patch(`/api/booking/shop/admin/orders/${order.id}/items/${it.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FULFILLED' });
    }
    const reloaded = await prisma.shopOrder.findUnique({ where: { id: order.id } });
    expect(reloaded.status).toBe('FULFILLED');
  });

  it('rejects invalid status', async () => {
    const item = order.items[0];
    const res = await request(app)
      .patch(`/api/booking/shop/admin/orders/${order.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('non-admin gets 403', async () => {
    const item = order.items[0];
    const res = await request(app)
      .patch(`/api/booking/shop/admin/orders/${order.id}/items/${item.id}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ status: 'ARRIVED' });
    expect(res.status).toBe(403);
  });
});
