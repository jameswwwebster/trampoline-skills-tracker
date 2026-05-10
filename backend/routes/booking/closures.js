const express = require('express');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');

const router = express.Router();
const prisma = require('../../prisma');

const closureSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  reason: Joi.string().required(),
});

// GET /api/booking/closures
router.get('/', auth, async (req, res) => {
  try {
    const closures = await prisma.closurePeriod.findMany({
      where: { clubId: req.user.clubId },
      orderBy: { startDate: 'asc' },
    });
    res.json(closures);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/closures — admin only
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error, value } = closureSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const clubId = req.user.clubId;
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    const closure = await prisma.closurePeriod.create({
      data: { clubId, startDate: start, endDate: end, reason: value.reason },
    });

    // Cancel affected session instances and issue credits
    const instances = await prisma.sessionInstance.findMany({
      where: {
        date: { gte: start, lte: end },
        cancelledAt: null,
        template: { is: { clubId } },
      },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { lines: true },
        },
      },
    });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    for (const instance of instances) {
      await prisma.sessionInstance.update({
        where: { id: instance.id },
        data: { cancelledAt: new Date(), cancellationReason: value.reason },
      });

      for (const booking of instance.bookings) {
        const activeLines = booking.lines.filter(l => !l.cancelledAt);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' },
        });
        if (activeLines.length > 0) {
          await prisma.$transaction(
            activeLines.map((line) =>
              prisma.credit.create({
                data: {
                  userId: booking.userId,
                  amount: line.amount,
                  expiresAt,
                  sourceBookingId: booking.id,
                },
              })
            )
          );
        }
      }
    }

    res.status(201).json(closure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/closures/:id — admin only
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const closure = await prisma.closurePeriod.findUnique({ where: { id: req.params.id } });
    if (!closure) return res.status(404).json({ error: 'Closure not found' });
    if (closure.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    await prisma.closurePeriod.delete({ where: { id: req.params.id } });
    res.json({ message: 'Closure period deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
