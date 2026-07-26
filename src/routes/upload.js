const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
    }
    cb(null, true);
  }
});

// Admin: upload a single image, get back a URL to store on a product/category
router.post('/', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (5MB max).' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No image file was received.' });

    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

// Admin: upload several images at once (e.g. a product's whole gallery in one go).
// Returns a urls[] array in the same order the files were selected, plus a
// per-file errors[] array so one bad file doesn't fail the whole batch.
router.post('/multiple', requireAdmin, (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'One or more images are too large (5MB max each).'
        : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 10 images at a time.'
        : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No image files were received.' });

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.status(201).json({ urls });
  });
});

module.exports = router;
