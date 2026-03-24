/**
 * Builds a minimal Express app mounting only the routes under test.
 * Avoids importing server.js which runs cron jobs and startup DB calls.
 */
const express = require('express');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/auth', require('../../routes/auth'));
  app.use('/api/booking/templates', require('../../routes/booking/templates'));
  app.use('/api/booking/sessions', require('../../routes/booking/sessions'));
  app.use('/api/booking/bookings', require('../../routes/booking/bookings'));
  app.use('/api/booking/credits', require('../../routes/booking/credits'));
  app.use('/api/booking/charges', require('../../routes/booking/charges'));
  app.use('/api/booking/waitlist', require('../../routes/booking/waitlist'));
  app.use('/api/booking/memberships', require('../../routes/booking/memberships'));
  app.use('/api/commitments', require('../../routes/booking/commitments'));
  app.use('/api/booking/shop/admin', require('../../routes/booking/shopAdmin'));
  app.use('/api/booking/shop', require('../../routes/booking/shop'));
  app.use('/api/gymnasts', require('../../routes/gymnasts'));
  app.use('/api/booking/attendance', require('../../routes/booking/attendance'));
  app.use('/api/booking/recurring-credits', require('../../routes/booking/recurringCredits'));
  app.use('/api/dashboard', require('../../routes/dashboard'));

  // Generic error handler
  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = { createTestApp };
