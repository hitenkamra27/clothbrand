require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const db = require('./src/db');
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const categoryRoutes = require('./src/routes/categories');
const sectionRoutes = require('./src/routes/sections');
const orderRoutes = require('./src/routes/orders');
const configRoutes = require('./src/routes/config');
const customerRoutes = require('./src/routes/customers');
const uploadRoutes = require('./src/routes/upload');
const settingsRoutes = require('./src/routes/settings');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-this-to-a-long-random-string') {
  console.warn('\n⚠️  WARNING: SESSION_SECRET is missing or still the default placeholder.');
  console.warn('   Set a real random value in .env before deploying — see .env.example.\n');
}

app.set('trust proxy', 1); // needed on Render/Railway so secure cookies work behind their proxy

app.use(helmet({
  contentSecurityPolicy: false // the storefront pulls fonts/images from a few external CDNs; tighten this once you finalize your asset hosts
}));
app.use(express.json({ limit: '1mb' }));

app.use(session({
  name: 'studio.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,          // JavaScript in the browser cannot read this cookie
    sameSite: 'lax',         // basic CSRF protection
    secure: isProd,          // only sent over HTTPS in production
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  }
}));

// ---------- API ----------
// Never let a browser, Render's edge, or an intermediate proxy cache API
// responses. Without this, a GET right after a DELETE/PUT could still be
// served a stale cached copy — which looks exactly like "deleting doesn't
// work" even though the delete succeeded on the server.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);

// ---------- Admin dashboard page gating ----------
// The dashboard HTML itself is only ever served to a browser holding a
// valid admin session cookie. Anyone else gets bounced to the login page,
// so there's nothing meaningful to "view source" on without logging in first.
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

app.get('/admin/dashboard.html', (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
  }
  return res.redirect('/admin/login.html');
});

app.get('/admin/login.html', (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard.html');
  }
  next();
});

app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ---------- Public storefront ----------
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => res.status(404).send('Not found'));

const PORT = process.env.PORT || 3000;

db.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Hive & Ash server running at http://localhost:${PORT}`);
      console.log(`Admin panel:            http://localhost:${PORT}/admin`);
    });
  })
  .catch((err) => {
    console.error('\n✗ Could not start server — Supabase connection failed:');
    console.error(`  ${err.message}\n`);
    process.exit(1);
  });
