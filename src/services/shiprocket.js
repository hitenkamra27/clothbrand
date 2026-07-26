/*
 * Shiprocket Shipping service
 * ------------------------------------------------------------------
 * This one talks to Shiprocket's real, publicly documented REST API
 * (https://apidocs.shiprocket.in), so — unlike the checkout/payment side —
 * it's fully implemented and works as soon as you set the three env vars
 * below. Nothing here is a placeholder.
 *
 * TO GO LIVE:
 *   1. Sign up at https://www.shiprocket.in and add at least one Pickup
 *      Location under Settings → Pickup Addresses. Note its exact name.
 *   2. Put your Shiprocket login email/password and that pickup location
 *      name into SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD / SHIPROCKET_PICKUP_LOCATION
 *      in .env.
 *   3. That's it — createShipmentForOrder() below will start creating real
 *      Shiprocket orders as soon as those are set.
 *
 * Auth tokens are valid for 240 hours (10 days); we cache and refresh
 * automatically so callers never have to think about it.
 */
const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let cachedTokenAt = 0;
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // refresh a day early

function isConfigured() {
  return !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

async function getToken() {
  if (!isConfigured()) {
    throw new Error('Shiprocket is not configured — set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env.');
  }
  if (cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    })
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.message || 'Shiprocket login failed — check SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD.');
  }
  cachedToken = data.token;
  cachedTokenAt = Date.now();
  return cachedToken;
}

async function shiprocketFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Shiprocket API error (${res.status}) on ${path}`);
  }
  return data;
}

// Creates a Shiprocket order + shipment from one of our internal `order` objects
// (the shape built in src/routes/orders.js). Returns Shiprocket's order/shipment IDs.
async function createShipmentForOrder(order) {
  if (!process.env.SHIPROCKET_PICKUP_LOCATION) {
    throw new Error('SHIPROCKET_PICKUP_LOCATION is not set in .env — add the pickup location name from your Shiprocket dashboard.');
  }
  const payload = {
    order_id: order.id,
    order_date: (order.createdAt || new Date().toISOString()).slice(0, 16).replace('T', ' '),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: order.customer.name,
    billing_last_name: '',
    billing_address: order.customer.address,
    billing_city: order.customer.city,
    billing_pincode: order.customer.pincode,
    billing_state: order.customer.state,
    billing_country: 'India',
    billing_email: order.customer.email || 'no-reply@example.com',
    billing_phone: order.customer.phone,
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({
      name: i.name,
      units: i.qty,
      selling_price: i.price
    })),
    payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.subtotal,
    // Package dimensions/weight matter for accurate courier rates — these are
    // safe generic defaults for small apparel; tune per-product if you start
    // shipping bulkier items.
    length: 20,
    breadth: 15,
    height: 5,
    weight: 0.5
  };

  return shiprocketFetch('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function trackShipment(shipmentId) {
  return shiprocketFetch(`/courier/track/shipment/${shipmentId}`);
}

module.exports = { isConfigured, getToken, createShipmentForOrder, trackShipment };
