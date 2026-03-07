const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// DELETE /api/booking/admin/gymnasts/:id
// Remove a gymnast (child) — cleans up all booking data
router.delete('/gymnasts/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: req.params.id },
      include: { guardians: { select: { id: true } } },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });
    if (gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    await deleteGymnast(gymnast.id);

    res.json({ message: 'Gymnast removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/admin/members/:userId
// Remove a member and all their gymnasts — cleans up all booking data
router.delete('/members/:userId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { guardedGymnasts: { select: { id: true } } },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    // Delete each gymnast and their booking data
    for (const g of user.guardedGymnasts) {
      await deleteGymnast(g.id);
    }

    // Delete user's own booking data
    await prisma.waitlistEntry.deleteMany({ where: { userId: req.params.userId } });
    await prisma.credit.deleteMany({ where: { userId: req.params.userId } });

    // Cancel bookings (keep records for history but remove association)
    const bookings = await prisma.booking.findMany({
      where: { userId: req.params.userId },
      include: { lines: true },
    });
    for (const b of bookings) {
      await prisma.bookingLine.deleteMany({ where: { bookingId: b.id } });
    }
    await prisma.booking.deleteMany({ where: { userId: req.params.userId } });

    // Delete the user
    await prisma.user.delete({ where: { id: req.params.userId } });

    res.json({ message: 'Member and their gymnasts removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function deleteGymnast(gymnastId) {
  // Cancel active bookings and remove lines
  const bookings = await prisma.booking.findMany({
    where: { lines: { some: { gymnastId } } },
    include: { lines: { where: { gymnastId } } },
  });

  for (const b of bookings) {
    await prisma.bookingLine.deleteMany({ where: { bookingId: b.id, gymnastId } });
    // If booking has no more lines, delete it too
    const remaining = await prisma.bookingLine.count({ where: { bookingId: b.id } });
    if (remaining === 0) {
      await prisma.booking.delete({ where: { id: b.id } });
    }
  }

  await prisma.consent.deleteMany({ where: { gymnastId } });
  await prisma.membership.deleteMany({ where: { gymnastId } });
  await prisma.gymnast.delete({ where: { id: gymnastId } });
}

module.exports = router;
