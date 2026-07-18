const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Tiny per-file write queue so two admin requests writing at the same
// moment can't corrupt a JSON file (JSON files are not transactional).
const queues = {};
function withLock(file, fn) {
  const prev = queues[file] || Promise.resolve();
  const next = prev.then(fn, fn);
  queues[file] = next.catch(() => {}); // don't let one failure jam the queue
  return next;
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readSync(name) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf-8').trim();
  return raw ? JSON.parse(raw) : [];
}

function writeSync(name, data) {
  const p = filePath(name);
  // Write to a temp file then rename, so a crash mid-write can't leave
  // a half-written / corrupted JSON file behind.
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

function read(name) {
  return withLock(name, () => readSync(name));
}

function write(name, data) {
  return withLock(name, () => writeSync(name, data));
}

function nextId(items, prefix) {
  let max = 0;
  for (const it of items) {
    const n = parseInt(String(it.id).replace(prefix, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

module.exports = { read, write, nextId, DATA_DIR };
