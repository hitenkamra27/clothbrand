const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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
  return {
    id: c.id, name: c.name, email: c.email, picture: c.picture || null, provider: c.provider,
    phone: c.phone || null, phoneVerified: !!c.phoneVerified
  };
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

/* ===================== FORGOT / RESET PASSWORD =====================
   Token is generated and only ever stored as a hash (never the raw token)
   server-side — same pattern as the OTP hashing below. Delivery is
   pluggable, see sendPasswordResetEmail(). Until a real SMTP provider is
   configured, the reset link is logged server-side and also returned in
   the API response outside production, so the whole flow is testable
   without a live email account.
====================================================================== */
// token (hashed) -> { customerId, expiresAt }
const resetTokens = new Map();
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

let mailer = null;
function getMailer() {
  if (mailer) return mailer;
  if (!process.env.SMTP_HOST) return null;
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return mailer;
}

// Plug in any SMTP provider here (Gmail app password, SendGrid, Resend,
// Amazon SES, etc. all speak SMTP) using your own credentials — add them
// to .env, never hardcode them.
async function sendPasswordResetEmail(email, resetLink) {
  const transport = getMailer();
  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Reset your Hive & Ash password',
        text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`
      });
      return;
    } catch (err) {
      console.error('Password reset email send failed, falling back to console log:', err.message);
    }
  }
  // Fallback: no SMTP provider configured (or the call failed) — log it instead.
  console.log(`[Password reset email to ${email}] ${resetLink}`);
}

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' }
});

router.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to find out which emails have accounts.
  const genericOk = {
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.'
  };

  const customer = await findByEmail(email.trim());
  if (!customer || customer.provider === 'google') {
    // Google-only accounts have no password to reset — say nothing extra,
    // same generic response either way.
    return res.json(genericOk);
  }

  const token = crypto.randomBytes(32).toString('hex');
  resetTokens.set(hashToken(token), { customerId: customer.id, expiresAt: Date.now() + RESET_TOKEN_TTL_MS });

  const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const resetLink = `${siteUrl}/reset-password.html?token=${token}`;
  await sendPasswordResetEmail(customer.email, resetLink);

  res.json({
    ...genericOk,
    // Only present outside production — lets you test the whole flow without a live SMTP account.
    devResetLink: process.env.NODE_ENV === 'production' ? undefined : resetLink
  });
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Missing or invalid reset link.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const record = resetTokens.get(hashToken(token));
  if (!record || Date.now() > record.expiresAt) {
    resetTokens.delete(hashToken(token));
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  }

  const customers = await db.read('customers');
  const customer = customers.find(c => c.id === record.customerId);
  if (!customer) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });

  customer.passwordHash = await bcrypt.hash(password, 10);
  await db.write('customers', customers);
  resetTokens.delete(hashToken(token));

  res.json({ ok: true, message: 'Your password has been reset. You can now sign in.' });
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

function requireCustomer(req, res, next) {
  if (!req.session || !req.session.customerId) return res.status(401).json({ error: 'Please sign in first.' });
  next();
}

// ---------- Order History (this customer's own orders only) ----------
router.get('/orders', requireCustomer, async (req, res) => {
  const orders = await db.read('orders');
  const mine = orders
    .filter(o => o.customerId === req.session.customerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(mine);
});

// ---------- Saved Items (server-backed wishlist, syncs across devices when signed in) ----------
const MAX_WISHLIST_ITEMS = 200;

async function readWishlists() {
  const data = await db.read('wishlists');
  return (data && !Array.isArray(data)) ? data : {};
}

router.get('/wishlist', requireCustomer, async (req, res) => {
  const wishlists = await readWishlists();
  res.json({ items: wishlists[req.session.customerId] || [] });
});

// Bulk replace — used once at sign-in to merge whatever was saved locally
// (as a guest) with whatever was already saved to this account.
router.put('/wishlist', requireCustomer, async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array.' });

  const clean = items
    .filter(i => i && typeof i.id === 'string' && typeof i.name === 'string')
    .slice(0, MAX_WISHLIST_ITEMS)
    .map(i => ({ id: i.id, name: i.name, price: Number(i.price) || 0, img: i.img || '' }));

  const wishlists = await readWishlists();
  wishlists[req.session.customerId] = clean;
  await db.write('wishlists', wishlists);
  res.json({ items: clean });
});

router.post('/wishlist', requireCustomer, async (req, res) => {
  const { id, name, price, img } = req.body || {};
  if (typeof id !== 'string' || typeof name !== 'string') {
    return res.status(400).json({ error: 'A product id and name are required.' });
  }
  const wishlists = await readWishlists();
  const current = wishlists[req.session.customerId] || [];
  if (!current.some(i => i.id === id)) {
    if (current.length >= MAX_WISHLIST_ITEMS) {
      return res.status(400).json({ error: `You can save up to ${MAX_WISHLIST_ITEMS} items.` });
    }
    current.push({ id, name, price: Number(price) || 0, img: img || '' });
  }
  wishlists[req.session.customerId] = current;
  await db.write('wishlists', wishlists);
  res.status(201).json({ items: current });
});

router.delete('/wishlist/:id', requireCustomer, async (req, res) => {
  const wishlists = await readWishlists();
  const current = (wishlists[req.session.customerId] || []).filter(i => i.id !== req.params.id);
  wishlists[req.session.customerId] = current;
  await db.write('wishlists', wishlists);
  res.json({ items: current });
});

// ---------- Account Settings: update display name ----------
router.put('/profile', requireCustomer, async (req, res) => {
  const { name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  const customers = await db.read('customers');
  const customer = customers.find(c => c.id === req.session.customerId);
  if (!customer) return res.status(401).json({ error: 'Not signed in.' });
  customer.name = name.trim();
  await db.write('customers', customers);
  res.json({ customer: safeProfile(customer) });
});

/* ===================== MOBILE NUMBER VERIFICATION (OTP) =====================
   OTPs are generated and checked here on the server (never trust a client-side
   check for this). Delivery is pluggable — see sendOtpSms() below. Until a real
   SMS provider is wired in, the code is logged server-side and also returned to
   the client outside production, so the whole flow is fully testable without a
   live SMS account.
============================================================================== */

// customerId -> { phone, hash, expiresAt, attempts, lastSentAt }
const otpStore = new Map();
const PHONE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile numbers
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// ---------- SMS delivery ----------
// Plug in a real provider (MSG91, Fast2SMS, Twilio, etc.) here using your own
// account credentials — add them to .env, never hardcode them. Example shown
// for MSG91 (popular for Indian OTP delivery); swap for your provider of choice.
async function sendOtpSms(phone, otp) {
  const message = `${otp} is your Hive & Ash verification code. It expires in 5 minutes. Do not share this with anyone.`;

  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    try {
      await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: process.env.MSG91_AUTH_KEY },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: `91${phone}`,
          otp
        })
      });
      return;
    } catch (err) {
      console.error('MSG91 send failed, falling back to console log:', err.message);
    }
  }

  // Fallback: no SMS provider configured (or the call failed) — log it instead.
  console.log(`[SMS to +91${phone}] ${message}`);
}

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 send/verify attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please try again shortly.' }
});

router.post('/otp/send', otpLimiter, requireCustomer, async (req, res) => {
  const { phone } = req.body || {};
  if (typeof phone !== 'string' || !PHONE_RE.test(phone.trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
  }
  const cleanPhone = phone.trim();

  const existing = otpStore.get(req.session.customerId);
  if (existing && Date.now() - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec}s before requesting another code.` });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  otpStore.set(req.session.customerId, {
    phone: cleanPhone,
    hash: hashOtp(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: Date.now()
  });

  await sendOtpSms(cleanPhone, otp);

  res.json({
    ok: true,
    message: `A verification code was sent to +91 ${cleanPhone}.`,
    // Only present outside production — lets you test the full flow without a live SMS account.
    devOtp: process.env.NODE_ENV === 'production' ? undefined : otp
  });
});

router.post('/otp/verify', otpLimiter, requireCustomer, async (req, res) => {
  const { otp } = req.body || {};
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({ error: 'Enter the 6-digit code.' });
  }

  const record = otpStore.get(req.session.customerId);
  if (!record) return res.status(400).json({ error: 'Request a new code first.' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(req.session.customerId);
    return res.status(400).json({ error: 'That code expired. Request a new one.' });
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(req.session.customerId);
    return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
  }

  if (hashOtp(otp.trim()) !== record.hash) {
    record.attempts += 1;
    return res.status(400).json({ error: `Incorrect code. ${OTP_MAX_ATTEMPTS - record.attempts} attempt(s) left.` });
  }

  const customers = await db.read('customers');
  const customer = customers.find(c => c.id === req.session.customerId);
  if (!customer) return res.status(401).json({ error: 'Not signed in.' });

  customer.phone = record.phone;
  customer.phoneVerified = true;
  await db.write('customers', customers);
  otpStore.delete(req.session.customerId);

  res.json({ ok: true, customer: safeProfile(customer) });
});

module.exports = router;
