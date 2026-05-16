const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');
const shopEmailService = require('../../services/shopEmailService');

const prisma = require('../../prisma');
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

const ITEM_STATUSES = ['AWAITING', 'ORDERED_FROM_SUPPLIER', 'ARRIVED', 'FULFILLED'];

// Derive the order-level status from the item-level statuses.
// PENDING_PAYMENT is never returned — that's the pre-payment state and
// items don't exist there in the new flow.
function deriveOrderStatus(items) {
  if (items.length === 0) return 'ORDERED';
  if (items.every(i => i.status === 'FULFILLED')) return 'FULFILLED';
  if (items.every(i => i.status === 'ARRIVED' || i.status === 'FULFILLED')) return 'ARRIVED';
  return 'ORDERED';
}

// PATCH /api/booking/shop/admin/orders/:orderId/items/:itemId
// Body: { status?, supplier? }
router.patch('/orders/:orderId/items/:itemId', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const { status, supplier } = req.body;

    if (status !== undefined && !ITEM_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${ITEM_STATUSES.join(', ')}` });
    }
    if (supplier !== undefined && typeof supplier !== 'string') {
      return res.status(400).json({ error: 'supplier must be a string' });
    }

    const item = await prisma.shopOrderItem.findUnique({
      where: { id: req.params.itemId },
      include: { order: { include: { items: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
    });
    if (!item || item.orderId !== req.params.orderId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const data = {};
    if (status !== undefined) data.status = status;
    if (supplier !== undefined) data.supplier = supplier === '' ? null : supplier.slice(0, 120);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await prisma.shopOrderItem.update({ where: { id: item.id }, data });

    // Recompute the parent order's derived status. Don't touch the order
    // if it's still PENDING_PAYMENT (shouldn't happen — items only become
    // editable post-payment — but defensive).
    const prevOrderStatus = item.order.status;
    let newOrderStatus = prevOrderStatus;
    if (prevOrderStatus !== 'PENDING_PAYMENT') {
      const refreshedItems = item.order.items.map(i =>
        i.id === item.id ? { ...i, status: data.status ?? i.status } : i
      );
      newOrderStatus = deriveOrderStatus(refreshedItems);
      if (newOrderStatus !== prevOrderStatus) {
        await prisma.shopOrder.update({ where: { id: item.order.id }, data: { status: newOrderStatus } });
      }
    }

    const updated = await prisma.shopOrder.findUnique({
      where: { id: item.order.id },
      include: { items: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'shop.order.item.update',
      entityType: 'ShopOrderItem',
      entityId: item.id,
      metadata: {
        orderId: item.order.id,
        previousItemStatus: item.status,
        newItemStatus: data.status ?? item.status,
        supplierSet: supplier !== undefined,
        orderStatusBefore: prevOrderStatus,
        orderStatusAfter: newOrderStatus,
      },
    });

    // Mirror the previous behaviour: when the order-level status crosses
    // a milestone we email the customer.
    try {
      if (newOrderStatus !== prevOrderStatus) {
        if (newOrderStatus === 'ARRIVED') {
          await shopEmailService.sendOrderArrivedEmail(updated.user, updated);
        } else if (newOrderStatus === 'FULFILLED') {
          await shopEmailService.sendOrderFulfilledEmail(updated.user, updated);
        }
      }
    } catch (emailErr) {
      console.error('Shop email failed (non-fatal):', emailErr.message);
    }

    res.json(updated);
  } catch (err) {
    console.error('Update order item error:', err);
    res.status(500).json({ error: 'Failed to update order item' });
  }
});

// GET /api/booking/shop/admin/orders/pending-count
router.get('/orders/pending-count', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const count = await prisma.shopOrder.count({
      where: { status: { in: ['ORDERED', 'ARRIVED'] } },
    });
    res.json({ count });
  } catch (err) {
    console.error('Pending order count error:', err);
    res.status(500).json({ error: 'Failed to fetch pending order count' });
  }
});

module.exports = router;
