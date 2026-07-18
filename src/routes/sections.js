const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Public: ordered list of homepage sections
router.get('/', async (req, res) => {
  const sections = await db.read('sections');
  res.json(sections.sort((a, b) => a.order - b.order));
});

// Admin: add a new homepage section (e.g. "Winter Edit")
router.post('/', requireAdmin, async (req, res) => {
  const { title, layout } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const sections = await db.read('sections');
  const key = slugify(title);
  if (sections.some(s => s.key === key)) {
    return res.status(409).json({ error: 'A section with this name already exists' });
  }
  const maxOrder = sections.reduce((m, s) => Math.max(m, s.order || 0), 0);
  const section = {
    key,
    title: title.trim(),
    layout: layout === 'carousel' ? 'carousel' : 'grid',
    order: maxOrder + 1
  };
  sections.push(section);
  await db.write('sections', sections);
  res.status(201).json(section);
});

router.put('/:key', requireAdmin, async (req, res) => {
  const { title, layout, order } = req.body || {};
  const sections = await db.read('sections');
  const s = sections.find(x => x.key === req.params.key);
  if (!s) return res.status(404).json({ error: 'Section not found' });
  if (title && typeof title === 'string' && title.trim()) s.title = title.trim();
  if (layout === 'carousel' || layout === 'grid') s.layout = layout;
  if (Number.isFinite(Number(order))) s.order = Number(order);
  await db.write('sections', sections);
  res.json(s);
});

router.delete('/:key', requireAdmin, async (req, res) => {
  const sections = await db.read('sections');
  const idx = sections.findIndex(s => s.key === req.params.key);
  if (idx === -1) return res.status(404).json({ error: 'Section not found' });
  if (['shop', 'new', 'bestsellers'].includes(req.params.key)) {
    return res.status(400).json({ error: 'This is a default section and cannot be deleted.' });
  }
  const [removed] = sections.splice(idx, 1);
  await db.write('sections', sections);
  res.json(removed);
});

module.exports = router;
