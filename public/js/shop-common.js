/* Shared across every page (index.html, category.html). Load this before
   any page-specific script. All state is localStorage-backed so it survives
   navigating between pages — a plain in-memory array would lose the cart
   the moment someone clicks from the homepage to a category page. */

function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtRupee(n){
  return '₹' + Number(n).toLocaleString('en-IN');
}

function readLocal(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e){ return fallback; }
}
function writeLocal(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){ /* storage unavailable */ }
}

function setupHeaderSearch(){
  const btn = document.getElementById('headerSearchBtn');
  const bar = document.getElementById('headerSearchBar');
  const input = document.getElementById('headerSearchInput');
  const closeBtn = document.getElementById('headerSearchClose');
  const form = document.getElementById('headerSearchForm');
  if(!btn || !bar || !input || !form) return;

  function open(){ bar.classList.add('open'); setTimeout(() => input.focus(), 150); }
  function close(){ bar.classList.remove('open'); }

  btn.addEventListener('click', () => bar.classList.contains('open') ? close() : open());
  closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if(e.key === 'Escape') close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const term = input.value.trim();
    if(term) window.location.href = buildCategoryUrl({ q: term });
  });

  // If we just arrived on the category page via a search, reflect the term back into the box.
  const params = new URLSearchParams(window.location.search);
  if(params.get('q')) input.value = params.get('q');
}

function buildCategoryUrl(params){
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if(v !== undefined && v !== null && v !== '') usp.set(k, v);
  });
  const qs = usp.toString();
  return '/category.html' + (qs ? '?' + qs : '');
}

/* ===================== CART ===================== */
const Cart = (function(){
  const KEY = 'studio_cart';
  let items = readLocal(KEY, []); // [{id,name,price,img,qty}]
  const listeners = [];

  function persist(){ writeLocal(KEY, items); listeners.forEach(fn => fn(items)); }
  function onChange(fn){ listeners.push(fn); }

  function add(id, name, price, img){
    const existing = items.find(i => i.id === id);
    if(existing) existing.qty += 1;
    else items.push({ id, name, price, img, qty: 1 });
    persist();
  }
  function changeQty(id, delta){
    const item = items.find(i => i.id === id);
    if(!item) return;
    item.qty += delta;
    if(item.qty <= 0) items = items.filter(i => i.id !== id);
    persist();
  }
  function remove(id){ items = items.filter(i => i.id !== id); persist(); }
  function clear(){ items = []; persist(); }
  function getItems(){ return items; }
  function count(){ return items.reduce((s,i) => s + i.qty, 0); }
  function subtotal(){ return items.reduce((s,i) => s + i.price * i.qty, 0); }

  return { add, changeQty, remove, clear, getItems, count, subtotal, onChange };
})();

/* ===================== WISHLIST ===================== */
const Wishlist = (function(){
  const KEY = 'studio_wishlist';
  let saved = readLocal(KEY, []); // [{id,name,price,img}]
  const listeners = [];
  let syncEnabled = false;

  function persist(){ writeLocal(KEY, saved); listeners.forEach(fn => fn(saved)); }
  function onChange(fn){ listeners.push(fn); }

  function pushToServer(){
    if(!syncEnabled) return;
    fetch('/api/customers/wishlist', {
      method: 'PUT', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: saved })
    }).catch(() => { /* best-effort — local state stays correct either way */ });
  }

  function has(id){ return saved.some(p => p.id === id); }
  function toggle(id, name, price, img){
    if(has(id)) saved = saved.filter(p => p.id !== id);
    else saved.push({ id, name, price, img });
    persist();
    pushToServer();
    return has(id);
  }
  function remove(id){ saved = saved.filter(p => p.id !== id); persist(); pushToServer(); }
  function getItems(){ return saved; }
  function count(){ return saved.length; }

  // Called once, right after a successful sign-in: merges whatever was saved
  // locally (as a guest) with whatever's already on the account, so nothing
  // gets lost either way, then keeps saving to the server from then on.
  async function syncFromServer(){
    try {
      const res = await fetch('/api/customers/wishlist', { credentials: 'same-origin', cache: 'no-store' });
      if(!res.ok) throw new Error('not signed in');
      const { items } = await res.json();
      const merged = Array.isArray(items) ? items.slice() : [];
      saved.forEach(local => { if(!merged.some(i => i.id === local.id)) merged.push(local); });
      saved = merged;
      persist();
      syncEnabled = true;
      pushToServer();
    } catch(e){ /* not signed in, or request failed — keep working locally */ }
  }

  // Called on sign-out: local saved items stay put for guest browsing,
  // they just stop being written back to any account.
  function disableSync(){ syncEnabled = false; }

  return { has, toggle, remove, getItems, count, onChange, syncFromServer, disableSync };
})();

/* ===================== COMPARE (new: side-by-side spec comparison) ===================== */
const Compare = (function(){
  const KEY = 'studio_compare';
  const MAX = 4;
  let items = readLocal(KEY, []); // [{id,name,price,img,color,material,rating,sizes,brand}]
  const listeners = [];

  function persist(){ writeLocal(KEY, items); listeners.forEach(fn => fn(items)); }
  function onChange(fn){ listeners.push(fn); }

  function has(id){ return items.some(p => p.id === id); }
  function toggle(product){
    if(has(product.id)){
      items = items.filter(p => p.id !== product.id);
    } else {
      if(items.length >= MAX){
        return { ok: false, reason: `You can compare up to ${MAX} products at a time.` };
      }
      items.push(product);
    }
    persist();
    return { ok: true };
  }
  function remove(id){ items = items.filter(p => p.id !== id); persist(); }
  function clear(){ items = []; persist(); }
  function getItems(){ return items; }
  function count(){ return items.length; }

  return { has, toggle, remove, clear, getItems, count, onChange, MAX };
})();

/* ===================== LIVE NAV (Footwear/Accessories/New Arrivals/Best Sellers, etc.) =====================
   The flat nav links for unisex categories (e.g. Footwear, Accessories) and homepage
   sections (e.g. New Arrivals, Best Sellers, plus any custom section an admin adds)
   are generated here from the real /api/categories and /api/sections data — so
   deleting a category or section in the admin panel removes its nav link everywhere,
   automatically, with no HTML to hand-edit. Runs on every page that includes this file. */
async function renderLiveNav(){
  const catSlots = document.querySelectorAll('[data-nav-slot="categories"]');
  const secSlots = document.querySelectorAll('[data-nav-slot="sections"]');
  const mobileSecSlots = document.querySelectorAll('[data-nav-slot="mobile-sections"]');
  if(!catSlots.length && !secSlots.length && !mobileSecSlots.length) return;

  try {
    const [categories, sections] = await Promise.all([
      fetch('/api/categories', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sections', { cache: 'no-store' }).then(r => r.json())
    ]);

    // Flat top-level category shortcuts only make sense for unisex categories
    // (Footwear, Accessories, etc.) — gendered ones (Topwear, Bottomwear) already
    // live inside the Shop mega-menu under Men/Women, so they're not duplicated here.
    const unisexCats = (categories || []).filter(c => c.unisex);
    const catHtml = unisexCats.map(c => `<li><a href="${buildCategoryUrl({ wear: c.key })}">${escapeHtml(c.label)}</a></li>`).join('');
    catSlots.forEach(slot => { slot.outerHTML = catHtml; });

    // "shop" is the default catalog and already has its own nav entry — skip it here.
    const sortedSections = (sections || []).filter(s => s.key !== 'shop').sort((a, b) => a.order - b.order);
    const secHtml = sortedSections.map(s => `<li><a href="${buildCategoryUrl({ section: s.key })}">${escapeHtml(s.title)}</a></li>`).join('');
    secSlots.forEach(slot => { slot.outerHTML = secHtml; });

    const mobileSecHtml = sortedSections.map(s => `<a href="${buildCategoryUrl({ section: s.key })}" class="mobile-link-row mobile-link">${escapeHtml(s.title)}</a>`).join('');
    mobileSecSlots.forEach(slot => { slot.outerHTML = mobileSecHtml; });
  } catch (e) {
    // If the fetch fails for any reason, don't leave empty placeholder tags sitting in the nav.
    catSlots.forEach(slot => slot.remove());
    secSlots.forEach(slot => slot.remove());
    mobileSecSlots.forEach(slot => slot.remove());
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', renderLiveNav);
}else{
  renderLiveNav();
}

/* ===================== SITE SETTINGS (announcement bar + footer + shipping) =====================
   Pulls store-wide customization (announcement messages, footer tagline, social
   links, free shipping threshold) from /api/settings, set from the admin panel's
   Settings tab. Falls back to whatever's already in the HTML if the fetch fails,
   so the page never breaks.

   window.getSiteSettings() is exposed so page-specific scripts (main.js,
   category.js, product.js, info.js) can reuse the same fetch for their cart's
   free-shipping progress bar instead of each hitting the API separately. */
let __siteSettingsPromise = null;
function getSiteSettings(){
  if (__siteSettingsPromise) return __siteSettingsPromise;
  __siteSettingsPromise = fetch('/api/settings', { cache: 'no-store' })
    .then(r => r.json())
    .then(s => { window.__siteSettings = s; return s; })
    .catch(() => null);
  return __siteSettingsPromise;
}
window.getSiteSettings = getSiteSettings;

// Safe to call from anywhere, any time — reads the cached value (once loaded)
// with a sane fallback before it has. Pages call getSiteSettings().then(...) once
// at startup to prime the cache and re-render whatever needs the real number.
function freeShipThreshold(){
  const v = window.__siteSettings && window.__siteSettings.freeShippingThreshold;
  return (typeof v === 'number' && !isNaN(v)) ? v : 1999;
}
window.freeShipThreshold = freeShipThreshold;

async function applySiteSettings(){
  const settings = await getSiteSettings();
  if (!settings) return;

  const track = document.querySelector('.announce-track');
  if (track && Array.isArray(settings.announcements) && settings.announcements.length) {
    const spans = settings.announcements.map(a => `<span>${escapeHtml(a)}</span>`);
    // Duplicate the sequence once so the CSS marquee loop has no visible seam.
    track.innerHTML = spans.concat(spans).join('');
  }

  const tagline = document.querySelector('.footer-brand p');
  if (tagline && settings.tagline) tagline.textContent = settings.tagline;

  const socialMap = {
    Instagram: settings.instagramUrl,
    TikTok: settings.tiktokUrl,
    Pinterest: settings.pinterestUrl
  };
  document.querySelectorAll('.footer-socials a').forEach(a => {
    const url = socialMap[a.textContent.trim()];
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.hidden = false;
    } else {
      a.hidden = true; // no link configured yet — don't show a dead "#" link
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', applySiteSettings);
}else{
  applySiteSettings();
}
