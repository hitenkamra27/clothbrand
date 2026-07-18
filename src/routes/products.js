const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

function validateProduct(body, { partial = false } = {}) {
  const errors = [];
  const p = {};

  const strField = (key, required = true) => {
    if (body[key] === undefined) {
      if (required && !partial) errors.push(`${key} is required`);
      return;
    }
    if (typeof body[key] !== 'string' || !body[key].trim()) {
      errors.push(`${key} must be a non-empty string`);
      return;
    }
    p[key] = body[key].trim();
  };

  strField('name');
  strField('imgFront');
  strField('imgBack', false);
  strField('sizes');
  strField('gender');
  strField('wear');
  strField('type');
  strField('color', false);
  strField('brand', false);
  strField('material', false);

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('price must be a positive number');
    else p.price = price;
  } else if (!partial) {
    errors.push('price is required');
  }

  if (body.salePrice !== undefined) {
    if (body.salePrice === null || body.salePrice === '') {
      p.salePrice = null;
    } else {
      const salePrice = Number(body.salePrice);
      if (!Number.isFinite(salePrice) || salePrice < 0) errors.push('salePrice must be a positive number or empty');
      else p.salePrice = salePrice;
    }
  }

  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.push('rating must be between 0 and 5');
    else p.rating = rating;
  }

  if (body.reviewCount !== undefined) {
    const reviewCount = Number(body.reviewCount);
    if (!Number.isFinite(reviewCount) || reviewCount < 0) errors.push('reviewCount must be a positive number');
    else p.reviewCount = Math.floor(reviewCount);
  }

  if (body.isNew !== undefined) p.isNew = !!body.isNew;

  if (body.sections !== undefined) {
    if (!Array.isArray(body.sections) || !body.sections.every(s => typeof s === 'string')) {
      errors.push('sections must be an array of section keys');
    } else {
      p.sections = body.sections;
    }
  } else if (!partial) {
    p.sections = ['shop'];
  }

  if (p.gender && !['men', 'women', 'kids', 'unisex'].includes(p.gender)) {
    errors.push('gender must be men, women, kids, or unisex');
  }

  return { errors, p };
}

function applyFilters(products, q) {
  let items = products;

  const multi = (val) => (val === undefined ? null : String(val).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

  const genders = multi(q.gender);
  if (genders) items = items.filter(p => genders.includes(String(p.gender).toLowerCase()));

  const wears = multi(q.wear);
  if (wears) items = items.filter(p => wears.includes(String(p.wear).toLowerCase()));

  const types = multi(q.type);
  if (types) items = items.filter(p => types.includes(String(p.type).toLowerCase()));

  const colors = multi(q.color);
  if (colors) items = items.filter(p => p.color && colors.includes(String(p.color).toLowerCase()));

  const brands = multi(q.brand);
  if (brands) items = items.filter(p => p.brand && brands.includes(String(p.brand).toLowerCase()));

  const materials = multi(q.material);
  if (materials) items = items.filter(p => p.material && materials.includes(String(p.material).toLowerCase()));

  const sizes = multi(q.size);
  if (sizes) items = items.filter(p => {
    const productSizes = String(p.sizes || '').split('·').map(s => s.trim().toLowerCase());
    return sizes.some(s => productSizes.includes(s));
  });

  if (q.section) items = items.filter(p => Array.isArray(p.sections) && p.sections.includes(q.section));
  if (q.isNew === 'true') items = items.filter(p => !!p.isNew);
  if (q.sale === 'true') items = items.filter(p => p.salePrice != null && p.salePrice < p.price);

  if (q.minPrice !== undefined) {
    const min = Number(q.minPrice);
    if (Number.isFinite(min)) items = items.filter(p => (p.salePrice ?? p.price) >= min);
  }
  if (q.maxPrice !== undefined) {
    const max = Number(q.maxPrice);
    if (Number.isFinite(max)) items = items.filter(p => (p.salePrice ?? p.price) <= max);
  }

  if (q.minRating !== undefined) {
    const min = Number(q.minRating);
    if (Number.isFinite(min)) items = items.filter(p => (p.rating || 0) >= min);
  }

  if (q.q) {
    const term = String(q.q).trim().toLowerCase();
    if (term) items = items.filter(p =>
      p.name.toLowerCase().includes(term) ||
      String(p.brand || '').toLowerCase().includes(term) ||
      String(p.type || '').toLowerCase().includes(term) ||
      String(p.color || '').toLowerCase().includes(term)
    );
  }

  return items;
}

function applySort(items, sort) {
  const sorted = items.slice();
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
    case 'price-desc':
      return sorted.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'popularity':
      return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    case 'newest':
      return sorted.sort((a, b) => (b.isNew === a.isNew) ? 0 : (b.isNew ? 1 : -1));
    default:
      return sorted; // no sort requested — keep catalog order
  }
}

// Public: list products. With no query params, returns the plain array
// (kept for the homepage). With any filter/sort/page param, returns a
// paginated { items, total, page, pageSize, totalPages } object instead.
router.get('/', async (req, res) => {
  const products = await db.read('products');

  if (Object.keys(req.query).length === 0) {
    return res.json(products);
  }

  const filtered = applyFilters(products, req.query);
  const sorted = applySort(filtered, req.query.sort);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(60, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  res.json({ items, total, page, pageSize, totalPages });
});

// Public: available filter values for a given base scope (e.g. ?gender=men)
// so the sidebar only ever shows options that actually exist in that scope.
router.get('/facets', async (req, res) => {
  const products = await db.read('products');
  // Facets are computed on everything EXCEPT the dimension being asked about
  // would ideally use "everything except that filter" logic; keeping this
  // simple (computed on the gender/wear scope only) is the right tradeoff
  // for a catalog this size.
  const scoped = applyFilters(products, {
    gender: req.query.gender,
    wear: req.query.wear,
    section: req.query.section,
    isNew: req.query.isNew,
    sale: req.query.sale
  });

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const prices = scoped.map(p => p.salePrice ?? p.price);

  res.json({
    colors: uniq(scoped.map(p => p.color)).sort(),
    brands: uniq(scoped.map(p => p.brand)).sort(),
    materials: uniq(scoped.map(p => p.material)).sort(),
    sizes: uniq(scoped.flatMap(p => String(p.sizes || '').split('·').map(s => s.trim()))).sort(),
    types: uniq(scoped.map(p => p.type)).sort(),
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    count: scoped.length
  });
});

// Admin: create product
// Public: single product (for the product detail page)
router.get('/:id', async (req, res) => {
  const products = await db.read('products');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Public: a handful of related products (same category), excluding itself
router.get('/:id/related', async (req, res) => {
  const products = await db.read('products');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 4));
  const related = products
    .filter(p => p.id !== product.id && (p.type === product.type || p.wear === product.wear))
    .slice(0, limit);
  res.json(related);
});

router.post('/', requireAdmin, async (req, res) => {
  const { errors, p } = validateProduct(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const products = await db.read('products');
  const id = db.nextId(products, 'p');
  const product = { id, ...p };
  products.push(product);
  await db.write('products', products);
  res.status(201).json(product);
});

// Admin: update product
router.put('/:id', requireAdmin, async (req, res) => {
  const { errors, p } = validateProduct(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const products = await db.read('products');
  const idx = products.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  products[idx] = { ...products[idx], ...p };
  await db.write('products', products);
  res.json(products[idx]);
});

// Admin: delete product
router.delete('/:id', requireAdmin, async (req, res) => {
  const products = await db.read('products');
  const idx = products.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const [removed] = products.splice(idx, 1);
  await db.write('products', products);
  res.json(removed);
});

module.exports = router;
