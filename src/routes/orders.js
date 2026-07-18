const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // generous, but stops a script from spamming fake orders
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many orders placed from this connection. Please try again shortly.' }
});

const VALID_STATUSES = ['pending', 'processing', 'shipped', 'in_transit', 'delivered', 'cancelled'];
const VALID_PAYMENT_METHODS = ['cod', 'gokwik'];

function validateOrder(body) {
  const errors = [];
  const { items, customer, paymentMethod } = body || {};

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Your bag is empty.');
  } else {
    for (const item of items) {
      if (!item || typeof item.name !== 'string' || !item.name.trim()) { errors.push('Each item needs a name.'); break; }
      if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) { errors.push('Each item needs a valid price.'); break; }
      if (!Number.isFinite(Number(item.qty)) || Number(item.qty) < 1) { errors.push('Each item needs a valid quantity.'); break; }
    }
  }

  if (!customer || typeof customer !== 'object') {
    errors.push('Delivery details are required.');
  } else {
    ['name', 'phone', 'address', 'city', 'state', 'pincode'].forEach((f) => {
      if (typeof customer[f] !== 'string' || !customer[f].trim()) errors.push(`${f} is required`);
    });
    if (customer.phone && !/^[0-9]{10}$/.test(customer.phone.trim())) {
      errors.push('phone must be a 10-digit number');
    }
    if (customer.pincode && !/^[0-9]{4,8}$/.test(customer.pincode.trim())) {
      errors.push('pincode looks invalid');
    }
  }

  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push('paymentMethod must be cod or gokwik');
  }

  return errors;
}

// Public: place an order (the actual "checkout" action)
router.post('/', orderLimiter, async (req, res) => {
  const errors = validateOrder(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const { items, customer, paymentMethod, note } = req.body;
  const cleanItems = items.map(i => ({
    name: String(i.name).trim(),
    price: Number(i.price),
    qty: Math.max(1, Math.floor(Number(i.qty)))
  }));
  const subtotal = cleanItems.reduce((s, i) => s + i.price * i.qty, 0);

  const orders = await db.read('orders');
  const id = db.nextId(orders.length ? orders : [{ id: 'ord0' }], 'ord');
  const order = {
    id,
    items: cleanItems,
    subtotal,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
      email: (customer.email || '').trim(),
      address: customer.address.trim(),
      city: customer.city.trim(),
      state: customer.state.trim(),
      pincode: customer.pincode.trim()
    },
    paymentMethod,
    note: (note || '').trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  await db.write('orders', orders);
  res.status(201).json(order);
});

// Admin: list all orders
router.get('/', requireAdmin, async (req, res) => {
  const orders = await db.read('orders');
  res.json(orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Admin: update order status
router.put('/:id', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const orders = await db.read('orders');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  await db.write('orders', orders);
  res.json(order);
});

module.exports = router;
