const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Public: full category tree (Topwear > T-Shirts, Polos... / Bottomwear > Jeans, Joggers...)
router.get('/', async (req, res) => {
  const categories = await db.read('categories');
  res.json(categories);
});

// Admin: add a new wear group (e.g. "Outerwear")
router.post('/', requireAdmin, async (req, res) => {
  const { label, unisex } = req.body || {};
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  const categories = await db.read('categories');
  const key = slugify(label);
  if (categories.some(c => c.key === key)) {
    return res.status(409).json({ error: 'A category with this name already exists' });
  }
  const category = { key, label: label.trim(), unisex: !!unisex, types: [] };
  categories.push(category);
  await db.write('categories', categories);
  res.status(201).json(category);
});

// Admin: rename / delete a wear group
router.put('/:key', requireAdmin, async (req, res) => {
  const { label } = req.body || {};
  const categories = await db.read('categories');
  const cat = categories.find(c => c.key === req.params.key);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (label && typeof label === 'string' && label.trim()) cat.label = label.trim();
  await db.write('categories', categories);
  res.json(cat);
});

router.delete('/:key', requireAdmin, async (req, res) => {
  const categories = await db.read('categories');
  const idx = categories.findIndex(c => c.key === req.params.key);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const [removed] = categories.splice(idx, 1);
  await db.write('categories', categories);
  res.json(removed);
});

// Admin: add a new type under a wear group (e.g. Bottomwear > "Joggers")
router.post('/:key/types', requireAdmin, async (req, res) => {
  const { label } = req.body || {};
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  const categories = await db.read('categories');
  const cat = categories.find(c => c.key === req.params.key);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const typeKey = slugify(label);
  if (cat.types.some(t => t.key === typeKey)) {
    return res.status(409).json({ error: 'A type with this name already exists in this category' });
  }
  const type = { key: typeKey, label: label.trim() };
  cat.types.push(type);
  await db.write('categories', categories);
  res.status(201).json(cat);
});

router.delete('/:key/types/:typeKey', requireAdmin, async (req, res) => {
  const categories = await db.read('categories');
  const cat = categories.find(c => c.key === req.params.key);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  cat.types = cat.types.filter(t => t.key !== req.params.typeKey);
  await db.write('categories', categories);
  res.json(cat);
});

module.exports = router;
