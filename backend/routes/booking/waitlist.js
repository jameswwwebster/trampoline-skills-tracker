const express = require('express');
const { auth } = require('../../middleware/auth');
const { processWaitlist } = require('../../services/waitlistService');

const router = express.Router();
const prisma = require('../../prisma');

// POST /api/booking/waitlist/:instanceId — join waitlist
router.post('/:instanceId', auth, async (req, res) => {
  try {
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.instanceId },
      include: {
        template: true,
        bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      },
    });

    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (instance.cancelledAt) {
      return res.status(400).json({ error: 'Session is cancelled' });
    }

    // Check session is actually full
    const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
    const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
    if (bookedCount < capacity) {
      return res.status(400).json({ error: 'Session has available slots — book directly' });
    }

    // Upsert so re-joining a previously expired entry works
    const entry = await prisma.waitlistEntry.upsert({
      where: { sessionInstanceId_userId: { sessionInstanceId: instance.id, userId: req.user.id } },
      create: { sessionInstanceId: instance.id, userId: req.user.id, status: 'WAITING' },
      update: { status: 'WAITING', offerExpiresAt: null },
    });

    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/waitlist/:instanceId — leave waitlist
router.delete('/:instanceId', auth, async (req, res) => {
  try {
    await prisma.waitlistEntry.deleteMany({
      where: { sessionInstanceId: req.params.instanceId, userId: req.user.id },
    });
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/waitlist/my — all active waitlist entries + offers for current user
router.get('/my', auth, async (req, res) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['WAITING', 'OFFERED'] },
      },
      include: {
        sessionInstance: {
          include: { template: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
