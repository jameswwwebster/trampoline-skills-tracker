const request = require('supertest');
const app = require('../server');

// These tests require a test DB — they test route shape and auth guards only
describe('GET /api/booking/sessions', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/booking/sessions?year=2026&month=3');
    expect(res.status).toBe(401);
  });
});
