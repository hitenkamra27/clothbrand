const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUser || !expectedHash) {
    console.error('ADMIN_USERNAME / ADMIN_PASSWORD_HASH not set in .env');
    return res.status(500).json({ error: 'Admin login is not configured on the server.' });
  }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Compare username with a fixed-length-safe check, then verify the
  // password hash. bcrypt.compare itself is timing-safe for the hash part.
  const usernameOk = username === expectedUser;
  const passwordOk = await bcrypt.compare(password, expectedHash);

  if (!usernameOk || !passwordOk) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.isAdmin = true;
    req.session.username = username;
    res.json({ ok: true });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('studio.sid');
    res.json({ ok: true });
  });
});

router.get('/status', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
