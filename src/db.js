// Supabase-backed data layer (direct Postgres connection via the `pg`
// package, using Supabase's connection-pooler URL). Keeps the exact same
// read/write/nextId interface the JSON-file/MongoDB versions had, so none
// of the route files need to change — read('products') still returns an
// array of every document, write('products', data) still replaces the
// whole collection.
//
// Storage shape: a REAL, SEPARATE Postgres table per collection —
// `products`, `categories`, `sections`, `orders`, `customers`,
// `wishlists` — each holding rows of (id text primary key, data jsonb).
// Every table shows up on its own in Supabase's Table Editor, so you can
// browse/query/filter customers separately from products, etc. Each row
// still stores its document as one jsonb column rather than a column per
// field, since products/orders/customers have fields that vary and
// change over time — this is the standard "structured where it matters,
// flexible where it doesn't" middle ground for a Postgres-backed app
// that isn't hand-writing a migration for every new field a route adds.
//
// `wishlists` is the one collection with a different shape everywhere it's
// used (src/routes/customers.js): it's a single object keyed by customer
// id — { [customerId]: [savedItem, ...] } — not an array of documents. It
// still gets a real table of its own; each row is just
// (id = customerId, data = that customer's saved-items array).
//
// SEEDING: products/categories/sections ship with real starter content in
// data/*.json (the original catalog this project was built from). If a
// table is completely empty the first time the server connects — which
// happens on a brand-new Supabase database, e.g. right after switching
// databases — it's auto-imported from that file, once. This is why a
// fresh Supabase project isn't empty by default. customers/orders/
// wishlists are deliberately never auto-seeded (no fake accounts/orders
// dropped into a live database).
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['products', 'categories', 'sections', 'orders', 'customers', 'wishlists', 'settings'];
const MAP_SHAPED = new Set(['wishlists']);
const SEEDABLE = new Set(['products', 'categories', 'sections']);
const DATA_DIR = path.join(__dirname, '..', 'data');

// Most collections identify each document by `.id` (products, orders,
// customers, settings). categories and sections identify theirs by `.key`
// instead (see src/routes/categories.js and src/routes/sections.js) — using
// the wrong field here would silently collapse every row down to one, since
// every document's `.id` would be the same `undefined`.
const ID_FIELD = { categories: 'key', sections: 'key' };
function idOf(name, item) {
  return String(item[ID_FIELD[name] || 'id']);
}

let pool;
let tablesEnsured = false;

function connect() {
  if (pool) return ensureTables(pool).then(() => pool);
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    return Promise.reject(new Error(
      'SUPABASE_DB_URL is not set — copy .env.example to .env and fill it in (see README for Supabase setup steps).'
    ));
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase's pooler requires SSL
  });
  return ensureTables(pool).then(() => {
    console.log('Connected to Supabase ✓');
    return pool;
  });
}

async function ensureTables(p) {
  if (tablesEnsured) return;
  for (const name of COLLECTIONS) {
    // Collection names come only from our own fixed constant above (never
    // user input), so building the identifier this way is safe.
    await p.query(`
      create table if not exists "${name}" (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
  }
  for (const name of SEEDABLE) {
    await seedIfEmpty(p, name);
  }
  tablesEnsured = true;
}

async function seedIfEmpty(p, name) {
  const { rows } = await p.query(`select 1 from "${name}" limit 1`);
  if (rows.length) return; // already has data — never overwrite

  const filePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return;
  let items;
  try {
    items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return;
  }
  if (!Array.isArray(items) || !items.length) return;

  for (const item of items) {
    await p.query(
      `insert into "${name}" (id, data) values ($1, $2) on conflict (id) do nothing`,
      [idOf(name, item), JSON.stringify(item)]
    );
  }
  console.log(`Seeded "${name}" with ${items.length} starter item(s) from data/${name}.json`);
}

function assertKnown(name) {
  if (!COLLECTIONS.includes(name)) {
    throw new Error(`Unknown collection "${name}" — add it to COLLECTIONS in src/db.js first.`);
  }
}

// Tiny per-collection write queue so two admin requests writing at the
// same moment can't interleave and corrupt a "replace whole collection"
// write.
const queues = {};
function withLock(name, fn) {
  const prev = queues[name] || Promise.resolve();
  const next = prev.then(fn, fn);
  queues[name] = next.catch(() => {}); // don't let one failure jam the queue
  return next;
}

async function readRaw(name) {
  assertKnown(name);
  const p = await connect();
  const { rows } = await p.query(`select id, data from "${name}" order by updated_at asc`);
  if (MAP_SHAPED.has(name)) {
    const map = {};
    for (const row of rows) map[row.id] = row.data;
    return map;
  }
  return rows.map((row) => row.data);
}

async function writeRaw(name, items) {
  assertKnown(name);
  const p = await connect();
  const client = await p.connect();
  try {
    await client.query('begin');
    await client.query(`delete from "${name}"`);
    if (MAP_SHAPED.has(name)) {
      for (const [id, value] of Object.entries(items || {})) {
        await client.query(`insert into "${name}" (id, data) values ($1, $2)`, [id, JSON.stringify(value)]);
      }
    } else {
      for (const item of items) {
        await client.query(`insert into "${name}" (id, data) values ($1, $2)`, [idOf(name, item), JSON.stringify(item)]);
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

function read(name) {
  return withLock(name, () => readRaw(name));
}

function write(name, data) {
  return withLock(name, () => writeRaw(name, data));
}

function nextId(items, prefix) {
  let max = 0;
  for (const it of items) {
    const n = parseInt(String(it.id).replace(prefix, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

module.exports = { read, write, nextId, connect, COLLECTIONS };
