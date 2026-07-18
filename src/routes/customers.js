const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // 20 attempts per IP per window (signup + login combined)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function safeProfile(c) {
  if (!c) return null;
  return { id: c.id, name: c.name, email: c.email, picture: c.picture || null, provider: c.provider };
}

async function findByEmail(email) {
  const customers = await db.read('customers');
  return customers.find(c => c.email.toLowerCase() === String(email).toLowerCase());
}

function startSession(req, res, customer, cb) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.customerId = customer.id;
    cb();
  });
}

// ---------- Sign up with email + password ----------
router.post('/signup', authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = await findByEmail(email.trim());
  if (existing) {
    return res.status(409).json({
      error: existing.provider === 'google'
        ? 'This email already has an account via Google Sign-In. Use "Continue with Google" instead.'
        : 'An account with this email already exists. Try signing in instead.'
    });
  }

  const customers = await db.read('customers');
  const id = db.nextId(customers.length ? customers : [{ id: 'cus0' }], 'cus');
  const passwordHash = await bcrypt.hash(password, 10);
  const customer = {
    id,
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    provider: 'password',
    picture: null,
    createdAt: new Date().toISOString()
  };
  customers.push(customer);
  await db.write('customers', customers);

  startSession(req, res, customer, () => res.status(201).json({ ok: true, customer: safeProfile(customer) }));
});

// ---------- Sign in with email + password ----------
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const customer = await findByEmail(email.trim());
  if (!customer || !customer.passwordHash) {
    if (customer && customer.provider === 'google') {
      return res.status(401).json({ error: 'This email uses Google Sign-In. Use "Continue with Google" instead.' });
    }
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const ok = await bcrypt.compare(password, customer.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  startSession(req, res, customer, () => res.json({ ok: true, customer: safeProfile(customer) }));
});

// ---------- Continue with Google (verifies the ID token server-side) ----------
router.post('/google', authLimiter, async (req, res) => {
  const { credential } = req.body || {};
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }
  if (!googleClient) {
    return res.status(500).json({ error: 'Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID).' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Could not verify Google sign-in. Please try again.' });
  }

  if (!payload || !payload.email) {
    return res.status(401).json({ error: 'Google did not return an email for this account.' });
  }

  const customers = await db.read('customers');
  let customer = customers.find(c => c.email.toLowerCase() === payload.email.toLowerCase());

  if (!customer) {
    const id = db.nextId(customers.length ? customers : [{ id: 'cus0' }], 'cus');
    customer = {
      id,
      name: payload.name || payload.email.split('@')[0],
      email: payload.email,
      passwordHash: null,
      provider: 'google',
      googleId: payload.sub,
      picture: payload.picture || null,
      createdAt: new Date().toISOString()
    };
    customers.push(customer);
  } else {
    // Link the Google identity to an existing (e.g. password) account with the same email.
    customer.googleId = payload.sub;
    customer.picture = payload.picture || customer.picture || null;
    if (!customer.provider) customer.provider = 'google';
  }
  await db.write('customers', customers);

  startSession(req, res, customer, () => res.json({ ok: true, customer: safeProfile(customer) }));
});

// ---------- Current session ----------
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.customerId) return res.status(401).json({ error: 'Not signed in.' });
  const customers = await db.read('customers');
  const customer = customers.find(c => c.id === req.session.customerId);
  if (!customer) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ customer: safeProfile(customer) });
});

// ---------- Sign out ----------
router.post('/logout', (req, res) => {
  if (req.session) {
    delete req.session.customerId;
  }
  res.json({ ok: true });
});

module.exports = router;
