# Hive & Ash — Backend + Admin Panel

Your site now has a real backend. Products, categories (Shop → Bottomwear →
Joggers, etc.), and homepage sections all live in `/data/*.json` on the
server and are edited through a password-protected admin panel — not by
hand-editing HTML.

## What changed from the static file

- `public/index.html` is your original storefront, unchanged in look and feel,
  but it now **fetches** products/categories/sections from the server instead
  of having them hardcoded. All the cart, filter, mega-menu, and carousel
  behavior works exactly as before.
- A small Express server (`server.js`) serves the site and a JSON API.
- `/admin` is a login-protected dashboard for managing everything.

## 1. Install

```bash
npm install
```

## 2. Set your real admin password

Never put your password directly in a file. Generate a hash instead:

```bash
npm run hash-password -- "your-new-strong-password"
```

Copy the printed line into your `.env` file (copy `.env.example` to `.env`
first if you haven't). Also set `SESSION_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

A demo `.env` is included so the site runs immediately — **change the
password and session secret before you show this to anyone else.**
Demo login: username `admin`, password `ChangeMe123!`.

## 3. Run it

```bash
npm start
```

- Storefront: http://localhost:3000
- Admin panel: http://localhost:3000/admin

## How the security actually works

- Your password is never stored in plain text anywhere, and never sent to
  the browser. Only a one-way bcrypt hash lives in `.env`.
- Logging in creates a server-side session; the browser only holds a random
  session ID in an `httpOnly` cookie, which JavaScript **cannot read** (so it
  can't be stolen via the page's own scripts). `view page source` on any page
  shows nothing password- or session-related.
- `/admin/dashboard.html` is only served by the server to a browser that
  already has a valid session — visiting it while logged out just redirects
  to the login page.
- Every product/category/section-editing API route checks the session
  server-side before doing anything, regardless of what the browser sends.
- Login attempts are rate-limited (10 per 15 minutes per IP) to slow down
  password guessing.
- `.env` is in `.gitignore` — never commit it or upload it anywhere public.

## Using the admin panel

- **Overview** — at-a-glance stats: product/category/order counts, orders
  that need action (pending/processing), and this month's revenue, plus
  quick lists of orders needing attention and recently touched products.
- **Products** — add, edit, delete. Pick a gender, category, and type; check
  which homepage sections it should appear in (Shop, New Arrivals, Best
  Sellers, or any custom section you've added). Images can be pasted as a
  URL or uploaded directly (drag-and-drop isn't wired up, but the "Upload
  Image" button handles single and multi-image uploads).
- **Categories** — this is your "Shop" mega menu. Add a new category (e.g.
  "Outerwear"), then add types inside it (e.g. "Parkas"). It shows up in the
  Shop menu and mobile drawer immediately — clicking it filters the shop
  grid, same as Bottomwear → Joggers does today.
- **Homepage Sections** — add a whole new homepage block (e.g. "Winter
  Edit"), choose a grid or side-scrolling carousel layout, then assign
  products to it from the Products tab. It appears on the homepage between
  Best Sellers and the Brand Story section automatically.
- **Orders** — update status as a package moves through
  pending → processing → shipped → in transit → delivered (or cancel).
  Moving an order to "processing" auto-books it with Shiprocket if
  `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` are set (see the Shiprocket
  section below).
- **Settings** — customize the live storefront without touching code:
  store name, footer tagline, announcement bar messages, contact
  email/phone, social links (Instagram/TikTok/Pinterest — an icon hides
  itself in the footer until you fill in its URL), and the free shipping
  threshold. Saving here updates the site immediately; no redeploy needed.
  The bottom of this tab also shows a read-only status of which
  integrations (Shiprocket, Google Sign-In) have credentials configured in
  `.env` — that part's intentionally not editable from the browser, since
  it involves secret keys.

## Phase 1: Category pages (new)

Every category — Men, Women, Kids, Footwear, Accessories, New Arrivals, Best
Sellers, Sale — now has its own real page at `/category.html` instead of
just scrolling/filtering the homepage. Examples:
- `/category.html?gender=men`
- `/category.html?wear=footwear`
- `/category.html?sale=true`
- `/category.html?q=jeans` (search)

Each category page has: a hero banner, a filter sidebar (gender, category,
price range, color, size, brand, material, rating), a sort dropdown
(newest/popularity/price/rating), active-filter chips, pagination + infinite
scroll, Quick View (opens product details without leaving the grid), Compare
(pick up to 4 products and see them side by side), and wishlist hearts on
every card.

**New in the data model:** products now also have `color`, `brand`,
`material`, `rating`, `reviewCount`, and an optional `salePrice`. The admin
product form has been updated to manage all of these, plus a "Kids" gender
option and the new "Footwear" category (Sneakers/Boots/Sandals/Formal Shoes).

**Cart and Wishlist now persist in the browser (localStorage)** so they
survive navigating between the homepage and category pages — previously the
cart only lived in memory and would empty out on page change, which no
longer works now that the site is multi-page.

**Not built yet (next phases):** full checkout (address, real payment,
Shiprocket Checkout), product detail pages (currently Quick View covers this on category
pages), user account dashboard, admin analytics/orders view, live search
suggestions, and everything else in the original big feature list. The
"Checkout →" button in the cart currently shows a message explaining it's
coming next rather than silently doing nothing.

## Deploying (Render / Railway / a VPS)

1. Push this folder to a Git repo (`.env` will be excluded automatically).
2. On Render/Railway: create a new **Web Service** from that repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. In the host's dashboard, set environment variables (don't upload `.env`
   itself): `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`,
   `SUPABASE_DB_URL`, `NODE_ENV=production`, and
   the `SHIPROCKET_*` vars from `.env.example` if you're using Shiprocket.
4. Once deployed over HTTPS, cookies are automatically marked `secure`
   (see `NODE_ENV` check in `server.js`), which is required for the session
   cookie to work correctly in production.

### Database (Supabase)
Data lives in Supabase/Postgres (`src/db.js`), connected to directly via the
`pg` package using Supabase's connection-pooler URL — not JSON files, and
no Supabase client library needed. Each collection gets its own real
table — `products`, `categories`, `sections`, `orders`, `customers`,
`wishlists` — so they show up separately in Supabase's Table Editor and you
can query/filter/export any one of them on its own. Each row stores its
document as a `data jsonb` column rather than a column per field, since
products/orders/customers have fields that vary and evolve over time.

All six tables are created automatically the first time the server
connects — no manual SQL step needed. If you'd rather create them yourself
ahead of time (e.g. to review the schema first), this is the exact
statement, repeated once per table name above:

```sql
create table if not exists products (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- repeat for categories, sections, orders, customers, wishlists
```

Set `SUPABASE_DB_URL` in `.env` to your project's pooler connection string
(see `.env.example` for exactly where to find it in your Supabase project).
If you're moving from an older copy of this project with real data in
`data/*.json`, run `npm run migrate-to-supabase` once after that to import
it.

## Shiprocket

- **Shipping** is fully wired up (`src/services/shiprocket.js`) using
  Shiprocket's real API — set `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, and
  `SHIPROCKET_PICKUP_LOCATION` in `.env` and orders get booked with a
  courier automatically the moment you mark them "processing" in `/admin`.
- **Checkout/payment** (`public/js/shiprocket.js`) needs Shiprocket's
  integration team to hand you a channel ID + SDK snippet for a custom
  site — see the comment at the top of that file for the exact steps. Until
  then the site keeps taking orders via Cash on Delivery.

## Project structure

```
server.js                 Express app, sessions, security headers, routing
src/db.js                 Supabase (Postgres) read/write layer — one table per collection (used by all routes)
src/services/shiprocket.js  Shiprocket shipping API (auth, order booking, tracking)
src/middleware/requireAdmin.js   Blocks admin-only routes without a session
src/routes/auth.js        Login / logout / session status
src/routes/products.js    Product CRUD
src/routes/categories.js  Category + type CRUD (the Shop menu)
src/routes/sections.js    Homepage section CRUD
src/routes/orders.js      Order placement + admin status updates (triggers Shiprocket)
src/routes/config.js      Public-safe config (Shiprocket checkout, Google client ID)
src/routes/settings.js    Site customization (store name, announcement bar, socials, etc.) — read by everyone, written by admin only
src/routes/customers.js   Customer accounts — signup/login, Google sign-in, mobile OTP, forgot/reset password
public/index.html         The storefront (your original design)
public/js/main.js         Fetches data from the API and renders the page
public/js/shop-common.js  Shared across every page — cart, nav, and now live site-settings (announcement bar, footer socials)
public/js/shiprocket.js   Shiprocket Checkout/payment adapter (see above)
public/reset-password.html  Standalone page the "forgot password" email links to
admin/login.html          Admin login screen
admin/dashboard.html      Admin dashboard (Overview / Products / Categories / Sections / Orders / Settings)
admin/admin.js            Dashboard logic
scripts/hash-password.js  CLI to generate a bcrypt hash for .env
scripts/migrate-to-supabase.js  One-time importer from data/*.json into Supabase
```
