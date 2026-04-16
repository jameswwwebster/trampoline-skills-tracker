const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { auth } = require('../../middleware/auth');
const { SHOP_PRODUCTS } = require('../../data/shopProducts');
const { audit } = require('../../services/auditLogService');

const prisma = require('../../prisma');

// POST /api/booking/shop/orders
// Creates a pending ShopOrder + Stripe PaymentIntent
router.post('/orders', auth, async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    // Validate items and compute server-side prices
    const validatedItems = [];
    let total = 0;

    for (const item of items) {
      const product = SHOP_PRODUCTS.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Unknown product: ${item.productId}` });
      }

      const variant = product.variants.find(v => v.label === item.size);
      if (!variant) {
        return res.status(400).json({ error: `Unknown size "${item.size}" for product "${item.productId}"` });
      }

      const qty = parseInt(item.quantity, 10);
      if (!qty || qty < 1 || qty > 10) {
        return res.status(400).json({ error: 'quantity must be between 1 and 10' });
      }

      if (product.customisation?.required && !item.customisation?.trim()) {
        return res.status(400).json({ error: `customisation is required for ${product.name}` });
      }

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        size: variant.label,
        quantity: qty,
        customisation: item.customisation?.trim() || null,
        price: variant.price,
      });

      total += variant.price * qty;
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'gbp',
      metadata: {
        type: 'shop_order',
        userId: req.user.id,
      },
    });

    // Create ShopOrder with items
    const order = await prisma.shopOrder.create({
      data: {
        userId: req.user.id,
        stripePaymentIntentId: paymentIntent.id,
        total,
        items: {
          create: validatedItems,
        },
      },
      include: { items: true },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'shop.order.created',
      entityType: 'ShopOrder',
      entityId: order.id,
      metadata: { total, itemCount: validatedItems.length },
    });

    res.status(201).json({
      orderId: order.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Shop order creation error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/booking/shop/my-orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await prisma.shopOrder.findMany({
      where: {
        userId: req.user.id,
        status: { not: 'PENDING_PAYMENT' },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    console.error('My orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/booking/shop/orders/:id
// Returns a single order (must belong to current user)
router.get('/orders/:id', auth, async (req, res) => {
  try {
    const order = await prisma.shopOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
