// One-time migration: imports your existing data/*.json files (or, if
// you're moving from an older copy of this project, export those
// collections to data/*.json first) into Supabase — one real table per
// collection (see src/db.js for why).
//
// Usage: node scripts/migrate-to-supabase.js
//
// Safe to re-run: each collection is fully replaced from the JSON file,
// so running it twice just re-imports the same data (it won't duplicate).
// Creates all tables automatically if they don't exist yet.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COLLECTIONS = ['products', 'categories', 'sections', 'orders', 'customers', 'wishlists', 'settings'];
const MAP_SHAPED = new Set(['wishlists']);
// categories and sections identify documents by `.key`, not `.id` —
// see the matching note in src/db.js.
const ID_FIELD = { categories: 'key', sections: 'key' };
function idOf(name, item) {
  return String(item[ID_FIELD[name] || 'id']);
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('SUPABASE_DB_URL is not set in .env — set it first, then re-run this script.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  for (const name of COLLECTIONS) {
    await pool.query(`
      create table if not exists "${name}" (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
  }
  console.log('Connected to Supabase. Importing...\n');

  for (const name of COLLECTIONS) {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ${name}: no data/${name}.json found, skipping`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = raw ? JSON.parse(raw) : (MAP_SHAPED.has(name) ? {} : []);

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from "${name}"`);
      let count = 0;
      if (MAP_SHAPED.has(name)) {
        for (const [id, value] of Object.entries(parsed)) {
          await client.query(`insert into "${name}" (id, data) values ($1, $2)`, [id, JSON.stringify(value)]);
          count++;
        }
      } else {
        for (const item of parsed) {
          await client.query(`insert into "${name}" (id, data) values ($1, $2)`, [idOf(name, item), JSON.stringify(item)]);
          count++;
        }
      }
      await client.query('commit');
      console.log(`  ${name}: imported ${count} row(s)`);
    } catch (err) {
      await client.query('rollback');
      console.error(`  ${name}: failed to import — ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log('\nDone. Your original data/*.json files are untouched — keep them as a backup.');
  await pool.end();
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
