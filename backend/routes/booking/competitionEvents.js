const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

const eventSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().optional().allow(null),
  entryDeadline: Joi.date().required(),
  lateEntryFee: Joi.number().integer().min(0).optional().allow(null),
  description: Joi.string().optional().allow('', null),
  categories: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      skillCompetitionIds: Joi.array().items(Joi.string()).default([]),
    })
  ).required(),
  priceTiers: Joi.array().items(
    Joi.object({
      entryNumber: Joi.number().integer().min(1).required(),
      price: Joi.number().integer().min(0).required(),
    })
  ).required(),
});

// GET /api/booking/competition-events
router.get('/', auth, async (req, res) => {
  try {
    const events = await prisma.competitionEvent.findMany({
      where: { clubId: req.user.clubId },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
        _count: { select: { entries: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/competition-events/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
        entries: {
          include: {
            gymnast: true,
            categories: { include: { category: true } },
          },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-events
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.create({
      data: {
        clubId: req.user.clubId,
        name: value.name,
        location: value.location,
        startDate: new Date(value.startDate),
        endDate: value.endDate ? new Date(value.endDate) : null,
        entryDeadline: new Date(value.entryDeadline),
        lateEntryFee: value.lateEntryFee ?? null,
        description: value.description ?? null,
        categories: {
          create: value.categories.map(c => ({
            name: c.name,
            ...(c.skillCompetitionIds.length > 0 ? {
              skillCompetitions: {
                create: c.skillCompetitionIds.map(sid => ({ skillCompetitionId: sid })),
              },
            } : {}),
          })),
        },
        priceTiers: {
          create: value.priceTiers.map(t => ({
            entryNumber: t.entryNumber,
            price: t.price,
          })),
        },
      },
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
      },
    });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/competition-events/:id
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const patchSchema = Joi.object({
    name: Joi.string(),
    location: Joi.string(),
    startDate: Joi.date(),
    endDate: Joi.date().allow(null),
    entryDeadline: Joi.date(),
    lateEntryFee: Joi.number().integer().min(0).allow(null),
    description: Joi.string().allow('', null),
  });
  const { error, value } = patchSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const existing = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const data = {};
    if (value.name) data.name = value.name;
    if (value.location) data.location = value.location;
    if (value.startDate) data.startDate = new Date(value.startDate);
    if ('endDate' in value) data.endDate = value.endDate ? new Date(value.endDate) : null;
    if (value.entryDeadline) data.entryDeadline = new Date(value.entryDeadline);
    if ('lateEntryFee' in value) data.lateEntryFee = value.lateEntryFee;
    if ('description' in value) data.description = value.description;

    const updated = await prisma.competitionEvent.update({
      where: { id: req.params.id },
      data,
      include: {
        categories: { include: { skillCompetitions: true } },
        priceTiers: { orderBy: { entryNumber: 'asc' } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/competition-events/:id
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const existing = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.competitionEvent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/competition-events/:id/eligible
router.get('/:id/eligible', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        categories: {
          include: {
            skillCompetitions: {
              include: {
                skillCompetition: { include: { levels: true } },
              },
            },
          },
        },
        entries: { select: { gymnastId: true } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const alreadyInvited = new Set(event.entries.map(e => e.gymnastId));

    const result = await Promise.all(event.categories.map(async (cat) => {
      const levelIds = cat.skillCompetitions.flatMap(sc =>
        sc.skillCompetition.levels.map(l => l.levelId)
      );

      let gymnasts;
      if (levelIds.length === 0) {
        gymnasts = await prisma.gymnast.findMany({
          where: { clubId: req.user.clubId, isArchived: false },
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
      } else {
        gymnasts = await prisma.gymnast.findMany({
          where: {
            clubId: req.user.clubId,
            isArchived: false,
            levelProgress: {
              some: { levelId: { in: levelIds }, status: 'COMPLETED' },
            },
          },
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        gymnasts: gymnasts.map(g => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          alreadyInvited: alreadyInvited.has(g.id),
        })),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-events/:id/invite
router.post('/:id/invite', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
    categoryIds: Joi.array().items(Joi.string()).default([]),
    priceOverride: Joi.number().integer().min(0).allow(null).default(null),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    let created = 0;
    for (const gymnastId of value.gymnastIds) {
      const existing = await prisma.competitionEntry.findUnique({
        where: { competitionEventId_gymnastId: { competitionEventId: event.id, gymnastId } },
      });
      if (!existing) {
        await prisma.competitionEntry.create({
          data: {
            competitionEventId: event.id,
            gymnastId,
            adminPriceOverride: value.priceOverride,
            categories: value.categoryIds.length > 0 ? {
              create: value.categoryIds.map(cid => ({ categoryId: cid })),
            } : undefined,
          },
        });
        created++;
      } else {
        // Update existing entry: set categories and/or price override
        const updates = {};
        if (value.priceOverride !== null) updates.adminPriceOverride = value.priceOverride;
        if (Object.keys(updates).length > 0) {
          await prisma.competitionEntry.update({ where: { id: existing.id }, data: updates });
        }
        if (value.categoryIds.length > 0) {
          for (const cid of value.categoryIds) {
            await prisma.competitionEntryCategory.upsert({
              where: { entryId_categoryId: { entryId: existing.id, categoryId: cid } },
              create: { entryId: existing.id, categoryId: cid },
              update: {},
            });
          }
        }
      }
    }

    res.status(201).json({ created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /:id/all-gymnasts — all non-archived gymnasts for manual inviting
router.get('/:id/all-gymnasts', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: { entries: { select: { gymnastId: true, id: true } } },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const invitedMap = new Map(event.entries.map(e => [e.gymnastId, e.id]));

    const gymnasts = await prisma.gymnast.findMany({
      where: { clubId: req.user.clubId, isArchived: false },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    res.json(gymnasts.map(g => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      alreadyInvited: invitedMap.has(g.id),
      entryId: invitedMap.get(g.id) || null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /:id/categories — add a category to an existing event
router.post('/:id/categories', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    name: Joi.string().required(),
    skillCompetitionIds: Joi.array().items(Joi.string()).default([]),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const category = await prisma.competitionCategory.create({
      data: {
        competitionEventId: event.id,
        name: value.name,
        skillCompetitions: value.skillCompetitionIds.length > 0 ? {
          create: value.skillCompetitionIds.map(sid => ({ skillCompetitionId: sid })),
        } : undefined,
      },
      include: { skillCompetitions: true },
    });
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /:id/categories/:catId — rename a category
router.patch('/:id/categories/:catId', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    name: Joi.string().required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const category = await prisma.competitionCategory.findFirst({
      where: { id: req.params.catId, competitionEventId: event.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const updated = await prisma.competitionCategory.update({
      where: { id: category.id },
      data: { name: value.name },
      include: { skillCompetitions: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /:id/categories/:catId — remove a category
router.delete('/:id/categories/:catId', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const event = await prisma.competitionEvent.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!event) return res.status(404).json({ error: 'Not found' });

    const category = await prisma.competitionCategory.findFirst({
      where: { id: req.params.catId, competitionEventId: event.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // competitionEntryCategory has no cascade from the category side — delete manually
    await prisma.competitionEntryCategory.deleteMany({ where: { categoryId: category.id } });
    await prisma.competitionCategory.delete({ where: { id: category.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
