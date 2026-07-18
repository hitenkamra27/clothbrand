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

  function persist(){ writeLocal(KEY, saved); listeners.forEach(fn => fn(saved)); }
  function onChange(fn){ listeners.push(fn); }

  function has(id){ return saved.some(p => p.id === id); }
  function toggle(id, name, price, img){
    if(has(id)) saved = saved.filter(p => p.id !== id);
    else saved.push({ id, name, price, img });
    persist();
    return has(id);
  }
  function remove(id){ saved = saved.filter(p => p.id !== id); persist(); }
  function getItems(){ return saved; }
  function count(){ return saved.length; }

  return { has, toggle, remove, getItems, count, onChange };
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
