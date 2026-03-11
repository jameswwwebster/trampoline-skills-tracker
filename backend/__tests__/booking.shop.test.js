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
      role: 'PARENT',
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
