const express = require('express');
const Joi = require('joi');
const { auth } = require('../middleware/auth');

const VALID_TYPES = ['SESSION_REMINDER'];

const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
});

module.exports = (prisma) => {
  const router = express.Router();

  // GET /api/push/vapid-public-key
  router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  });

  // GET /api/push/preferences
  router.get('/preferences', auth, async (req, res) => {
    try {
      const prefs = await prisma.pushNotificationPreference.findMany({
        where: { userId: req.user.id },
      });
      const result = {};
      for (const p of prefs) {
        result[p.notificationType] = p.enabled;
      }
      res.json(result);
    } catch (err) {
      console.error('Get preferences error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/push/subscribe
  router.post('/subscribe', auth, async (req, res) => {
    const { error, value } = subscribeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint: value.endpoint },
        update: { p256dh: value.keys.p256dh, auth: value.keys.auth, userId: req.user.id },
        create: {
          userId: req.user.id,
          endpoint: value.endpoint,
          p256dh: value.keys.p256dh,
          auth: value.keys.auth,
        },
      });

      await Promise.all(
        VALID_TYPES.map((notificationType) =>
          prisma.pushNotificationPreference.upsert({
            where: { userId_notificationType: { userId: req.user.id, notificationType } },
            update: {},
            create: { userId: req.user.id, notificationType, enabled: true },
          })
        )
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Subscribe error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // DELETE /api/push/subscribe
  router.delete('/subscribe', auth, async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    try {
      await prisma.pushSubscription.delete({ where: { endpoint } });
      res.json({ ok: true });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Subscription not found' });
      console.error('Unsubscribe error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PATCH /api/push/preferences
  router.patch('/preferences', auth, async (req, res) => {
    const { notificationType, enabled } = req.body;

    if (!VALID_TYPES.includes(notificationType)) {
      return res.status(400).json({ error: `Unknown notification type: ${notificationType}` });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    try {
      await prisma.pushNotificationPreference.upsert({
        where: { userId_notificationType: { userId: req.user.id, notificationType } },
        update: { enabled },
        create: { userId: req.user.id, notificationType, enabled },
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Preferences error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
