const request = require('supertest');
const app = require('../server');

describe('POST /api/booking/bookings', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).post('/api/booking/bookings').send({});
    expect(res.status).toBe(401);
  });
});
