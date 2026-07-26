const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Settings is a single-document collection — always exactly one row with
// this fixed id, holding every site-customization field.
const SETTINGS_ID = 'site';

const DEFAULTS = {
  id: SETTINGS_ID,
  storeName: 'Hive & Ash',
  tagline: 'Considered clothing for daily wear. Designed with intent, built to last beyond the season.',
  logoUrl: '',
  contactEmail: '',
  contactPhone: '',
  instagramUrl: '',
  tiktokUrl: '',
  pinterestUrl: '',
  announcements: [
    'Free shipping on orders over ₹1,999',
    'New season now live',
    'Designed in-house, made to last'
  ],
  freeShippingThreshold: 1999
};

async function readSettings() {
  const rows = await db.read('settings');
  const existing = rows.find((r) => r.id === SETTINGS_ID);
  return existing ? { ...DEFAULTS, ...existing } : DEFAULTS;
}

// Public: the storefront (announcement bar, footer socials, etc.) reads this.
router.get('/', async (req, res) => {
  res.json(await readSettings());
});

// Admin: update any subset of fields.
router.put('/', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const current = await readSettings();

  const next = { ...current, id: SETTINGS_ID };

  if (typeof body.storeName === 'string' && body.storeName.trim()) next.storeName = body.storeName.trim();
  if (typeof body.tagline === 'string') next.tagline = body.tagline.trim();
  if (typeof body.logoUrl === 'string') next.logoUrl = body.logoUrl.trim();
  if (typeof body.contactEmail === 'string') next.contactEmail = body.contactEmail.trim();
  if (typeof body.contactPhone === 'string') next.contactPhone = body.contactPhone.trim();
  if (typeof body.instagramUrl === 'string') next.instagramUrl = body.instagramUrl.trim();
  if (typeof body.tiktokUrl === 'string') next.tiktokUrl = body.tiktokUrl.trim();
  if (typeof body.pinterestUrl === 'string') next.pinterestUrl = body.pinterestUrl.trim();
  if (Array.isArray(body.announcements)) {
    const clean = body.announcements.map((a) => String(a || '').trim()).filter(Boolean).slice(0, 6);
    if (clean.length) next.announcements = clean;
  }
  if (body.freeShippingThreshold !== undefined) {
    const n = Number(body.freeShippingThreshold);
    if (Number.isFinite(n) && n >= 0) next.freeShippingThreshold = n;
  }

  const rows = await db.read('settings');
  const filtered = rows.filter((r) => r.id !== SETTINGS_ID);
  filtered.push(next);
  await db.write('settings', filtered);

  res.json(next);
});

module.exports = router;
