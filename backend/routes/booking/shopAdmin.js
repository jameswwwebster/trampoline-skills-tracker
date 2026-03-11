const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');
const shopEmailService = require('../../services/shopEmailService');

const prisma = new PrismaClient();
const STAFF_ROLES = ['CLUB_ADMIN', 'COACH'];

// GET /api/booking/shop/admin/orders
router.get('/orders', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { status: { not: 'PENDING_PAYMENT' } };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const orders = await prisma.shopOrder.findMany({
      where,
      include: {
        items: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PATCH /api/booking/shop/admin/orders/:id/status
router.patch('/orders/:id/status', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const { status } = req.body;
    const validTransitions = {
      ORDERED: 'ARRIVED',
      ARRIVED: 'FULFILLED',
    };

    const order = await prisma.shopOrder.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'PENDING_PAYMENT') return res.status(400).json({ error: 'Order not yet paid' });

    const expectedNext = validTransitions[order.status];
    if (!expectedNext || status !== expectedNext) {
      return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
    }

    const updated = await prisma.shopOrder.update({
      where: { id: order.id },
      data: { status },
      include: { items: true, user: { select: { id: true, name: true, email: true } } },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: `shop.order.${status.toLowerCase()}`,
      entityType: 'ShopOrder',
      entityId: order.id,
      metadata: { previousStatus: order.status, newStatus: status },
    });

    // Send email notification
    try {
      if (status === 'ARRIVED') {
        await shopEmailService.sendOrderArrivedEmail(order.user, updated);
      } else if (status === 'FULFILLED') {
        await shopEmailService.sendOrderFulfilledEmail(order.user, updated);
      }
    } catch (emailErr) {
      console.error('Shop email failed (non-fatal):', emailErr.message);
    }

    res.json(updated);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
