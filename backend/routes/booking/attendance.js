// backend/routes/booking/attendance.js
const express = require('express');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = require('../../prisma');

async function buildExpectedList(instanceId, clubId) {
  const instance = await prisma.sessionInstance.findUnique({
    where: { id: instanceId },
    include: { template: true },
  });
  if (!instance || instance.template.clubId !== clubId) return null;

  const bookings = await prisma.booking.findMany({
    where: { sessionInstanceId: instanceId, status: 'CONFIRMED' },
    include: { lines: { include: { gymnast: true } } },
  });
  const fromBookings = bookings.flatMap(b =>
    b.lines.map(l => ({
      gymnastId: l.gymnast.id,
      firstName: l.gymnast.firstName,
      lastName: l.gymnast.lastName,
    }))
  );

  const sessionDate = new Date(instance.date);
  sessionDate.setHours(0, 0, 0, 0);

  const commitments = await prisma.commitment.findMany({
    where: {
      templateId: instance.templateId,
      status: 'ACTIVE',
      OR: [
        { startDate: null },
        { startDate: { lte: sessionDate } },
      ],
    },
    include: { gymnast: true },
  });
  const fromCommitments = commitments.map(c => ({
    gymnastId: c.gymnast.id,
    firstName: c.gymnast.firstName,
    lastName: c.gymnast.lastName,
  }));

  const seen = new Set();
  const all = [...fromBookings, ...fromCommitments].filter(g => {
    if (seen.has(g.gymnastId)) return false;
    seen.add(g.gymnastId);
    return true;
  });

  all.sort((a, b) => a.firstName.localeCompare(b.firstName));

  return { instance, list: all };
}

router.get('/:instanceId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const result = await buildExpectedList(req.params.instanceId, req.user.clubId);
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const { instance, list } = result;

    const records = await prisma.attendance.findMany({
      where: { sessionInstanceId: instance.id },
    });
    const statusMap = Object.fromEntries(records.map(r => [r.gymnastId, r.status]));

    const attendees = list.map(g => ({
      gymnastId: g.gymnastId,
      firstName: g.firstName,
      lastName: g.lastName,
      status: statusMap[g.gymnastId] || 'UNMARKED',
    }));

    res.json({
      session: {
        id: instance.id,
        date: instance.date,
        templateName: `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][instance.template.dayOfWeek]} ${instance.template.startTime} (${instance.template.type})`,
        startTime: instance.template.startTime,
        endTime: instance.template.endTime,
      },
      attendees,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:instanceId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      gymnastId: Joi.string().required(),
      status: Joi.string().valid('PRESENT', 'ABSENT').required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await buildExpectedList(req.params.instanceId, req.user.clubId);
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const { instance, list } = result;

    const onList = list.find(g => g.gymnastId === value.gymnastId);
    if (!onList) return res.status(422).json({ error: 'Gymnast is not expected at this session' });

    await prisma.attendance.upsert({
      where: {
        sessionInstanceId_gymnastId: {
          sessionInstanceId: instance.id,
          gymnastId: value.gymnastId,
        },
      },
      create: {
        sessionInstanceId: instance.id,
        gymnastId: value.gymnastId,
        status: value.status,
        markedById: req.user.id,
      },
      update: {
        status: value.status,
        markedById: req.user.id,
        markedAt: new Date(),
      },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'attendance.mark',
      entityType: 'Attendance',
      entityId: instance.id,
      metadata: { gymnastId: value.gymnastId, status: value.status, instanceId: instance.id },
    });

    res.json({
      gymnastId: onList.gymnastId,
      firstName: onList.firstName,
      lastName: onList.lastName,
      status: value.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/attendance/:instanceId/:gymnastId — reset to UNMARKED
router.delete('/:instanceId/:gymnastId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const result = await buildExpectedList(req.params.instanceId, req.user.clubId);
    if (!result) return res.status(404).json({ error: 'Session not found' });

    const { instance, list } = result;

    const onList = list.find(g => g.gymnastId === req.params.gymnastId);
    if (!onList) return res.status(422).json({ error: 'Gymnast is not expected at this session' });

    await prisma.attendance.deleteMany({
      where: { sessionInstanceId: instance.id, gymnastId: req.params.gymnastId },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'attendance.reset',
      entityType: 'Attendance',
      entityId: instance.id,
      metadata: { gymnastId: req.params.gymnastId, instanceId: instance.id },
    });

    res.json({
      gymnastId: onList.gymnastId,
      firstName: onList.firstName,
      lastName: onList.lastName,
      status: 'UNMARKED',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
