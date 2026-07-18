(function(){
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  let product = null;
  let selectedSize = null;
  let qty = 1;
  let CATEGORIES = [];

  const layout = document.getElementById('pdpLayout');

  function categoryLabel(wearKey, typeKey, categories){
    const cat = categories.find(c => c.key === wearKey);
    const type = cat && cat.types.find(t => t.key === typeKey);
    return { wearLabel: cat ? cat.label : wearKey, typeLabel: type ? type.label : typeKey };
  }

  function renderBreadcrumb(p, categories){
    const { wearLabel, typeLabel } = categoryLabel(p.wear, p.type, categories);
    const crumb = document.getElementById('pdpBreadcrumb');
    crumb.innerHTML = `
      <a href="/">Home</a> <span class="sep">/</span>
      <a href="${buildCategoryUrl({ wear: p.wear })}">${escapeHtml(wearLabel)}</a> <span class="sep">/</span>
      ${typeLabel && typeLabel !== wearLabel ? `<a href="${buildCategoryUrl({ wear: p.wear, type: p.type })}">${escapeHtml(typeLabel)}</a> <span class="sep">/</span>` : ''}
      <span class="current">${escapeHtml(p.name)}</span>
    `;
  }

  function renderLayout(p){
    document.getElementById('pageTitle').textContent = `${p.name} — STUDIO`;
    const sizes = String(p.sizes || '').split('·').map(s => s.trim()).filter(Boolean);
    const onSale = p.salePrice != null && p.salePrice < p.price;
    const images = [p.imgFront, p.imgBack || p.imgFront].filter((v, i, a) => a.indexOf(v) === i);

    layout.innerHTML = `
      <div class="pdp-gallery">
        <div class="pdp-gallery-main">
          <img id="pdpMainImg" src="${escapeHtml(images[0])}" alt="${escapeHtml(p.name)}">
        </div>
        ${images.length > 1 ? `
          <div class="pdp-gallery-thumbs" id="pdpThumbs">
            ${images.map((img, i) => `<button class="${i === 0 ? 'active' : ''}" data-img="${escapeHtml(img)}"><img src="${escapeHtml(img)}" alt=""></button>`).join('')}
          </div>` : ''}
      </div>
      <div class="pdp-info">
        <div class="pdp-brand">${escapeHtml(p.brand || 'STUDIO')}</div>
        <h1 class="pdp-name">${escapeHtml(p.name)}</h1>
        <div class="pdp-rating">
          <svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.3L18 21l-6-4.3L6 21l1.5-7.7L2 9h7z"/></svg>
          ${(p.rating || 0).toFixed(1)} · ${p.reviewCount || 0} reviews
        </div>
        <div class="pdp-price">
          ${onSale ? `<span class="price-strike">${fmtRupee(p.price)}</span> <span class="price-sale">${fmtRupee(p.salePrice)}</span>` : fmtRupee(p.price)}
        </div>
        <div class="pdp-meta-row">
          <span>Color: <b>${escapeHtml(p.color || '—')}</b></span>
          <span>Material: <b>${escapeHtml(p.material || '—')}</b></span>
        </div>

        ${sizes.length ? `
          <div class="pdp-section-label">Size</div>
          <div class="pdp-sizes" id="pdpSizes">
            ${sizes.map(s => `<button data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
          </div>` : ''}

        <div class="pdp-section-label">Quantity</div>
        <div class="pdp-qty" id="pdpQty">
          <button id="pdpQtyDec" aria-label="Decrease quantity">−</button>
          <span id="pdpQtyVal">1</span>
          <button id="pdpQtyInc" aria-label="Increase quantity">+</button>
        </div>

        <div class="pdp-actions">
          <button class="pdp-add-bag" id="pdpAddBag">+ Add to Bag</button>
          <button class="pdp-wishlist-btn" id="pdpWishlistBtn" aria-label="Save to wishlist">
            <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2 5 5.4 5c2 0 3.4 1 4.6 2.6C11.2 6 12.6 5 14.6 5 18 5 19.6 8.4 18 11.7 15.5 16.3 12 21 12 21z"/></svg>
          </button>
        </div>

        <div class="pdp-accordion">
          <div class="pdp-accordion-item open">
            <button type="button" data-accordion-toggle>Description <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <div class="pdp-accordion-body">${escapeHtml(p.name)} in ${escapeHtml(p.color || 'a considered colorway')}, made from ${escapeHtml(p.material || 'quality materials')}. Part of the ${escapeHtml(p.brand || 'STUDIO')} line.</div>
          </div>
          <div class="pdp-accordion-item">
            <button type="button" data-accordion-toggle>Shipping &amp; Returns <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <div class="pdp-accordion-body">Free shipping on orders over ₹1,999. Estimated delivery in 3–6 business days. Easy 14-day returns on unworn items with tags attached.</div>
          </div>
          <div class="pdp-accordion-item">
            <button type="button" data-accordion-toggle>Size Guide <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
            <div class="pdp-accordion-body">Available sizes: ${escapeHtml(p.sizes || '—')}. If you're between sizes, we recommend sizing up for a relaxed fit.</div>
          </div>
        </div>
      </div>
    `;

    // Gallery thumbnail switching
    const thumbs = document.getElementById('pdpThumbs');
    if(thumbs){
      thumbs.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-img]');
        if(!btn) return;
        document.getElementById('pdpMainImg').src = btn.dataset.img;
        thumbs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }

    // Size selection
    const sizesEl = document.getElementById('pdpSizes');
    if(sizesEl){
      sizesEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-size]');
        if(!btn) return;
        sizesEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = btn.dataset.size;
      });
    } else {
      selectedSize = null;
    }

    // Quantity
    qty = 1;
    document.getElementById('pdpQtyDec').addEventListener('click', () => {
      qty = Math.max(1, qty - 1);
      document.getElementById('pdpQtyVal').textContent = qty;
    });
    document.getElementById('pdpQtyInc').addEventListener('click', () => {
      qty = Math.min(10, qty + 1);
      document.getElementById('pdpQtyVal').textContent = qty;
    });

    // Accordion
    document.querySelectorAll('[data-accordion-toggle]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.pdp-accordion-item').classList.toggle('open'));
    });

    // Add to bag
    document.getElementById('pdpAddBag').addEventListener('click', () => {
      if(sizesEl && !selectedSize){
        alert('Please select a size.');
        return;
      }
      const price = Number(p.salePrice ?? p.price);
      for(let i = 0; i < qty; i++){
        Cart.add(p.id, selectedSize ? `${p.name} (${selectedSize})` : p.name, price, p.imgFront);
      }
      const btn = document.getElementById('pdpAddBag');
      btn.textContent = 'Added ✓';
      setTimeout(() => { btn.textContent = '+ Add to Bag'; }, 1400);
    });

    // Wishlist
    const wishBtn = document.getElementById('pdpWishlistBtn');
    wishBtn.classList.toggle('saved', Wishlist.has(p.id));
    wishBtn.addEventListener('click', () => {
      const saved = Wishlist.toggle(p.id, p.name, Number(p.salePrice ?? p.price), p.imgFront);
      wishBtn.classList.toggle('saved', saved);
    });
  }

  function relatedCardHTML(p){
    const onSale = p.salePrice != null && p.salePrice < p.price;
    return `
      <a href="/product.html?id=${escapeHtml(p.id)}" class="product-card" style="text-decoration:none;color:inherit;">
        <div class="product-media">
          ${onSale ? '<span class="badge-sale">Sale</span>' : (p.isNew ? '<span class="tag-new">New</span>' : '')}
          <img class="front" src="${escapeHtml(p.imgFront)}" alt="${escapeHtml(p.name)}">
          <img class="back" src="${escapeHtml(p.imgBack || p.imgFront)}" alt="">
        </div>
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-sizes">${escapeHtml(p.sizes)}</div>
          </div>
          <div class="product-price">${onSale ? `<span class="price-strike">${fmtRupee(p.price)}</span> <span class="price-sale">${fmtRupee(p.salePrice)}</span>` : fmtRupee(p.price)}</div>
        </div>
      </a>`;
  }

  async function loadRelated(){
    try {
      const related = await fetch(`/api/products/${encodeURIComponent(productId)}/related?limit=4`).then(r => r.json());
      if(Array.isArray(related) && related.length){
        document.getElementById('pdpRelatedGrid').innerHTML = related.map(relatedCardHTML).join('');
        document.getElementById('pdpRelatedSection').hidden = false;
      }
    } catch(err){
      console.error('Could not load related products', err);
    }
  }

  /* ===================== SHARED CHROME (header/cart/wishlist/mobile nav) ===================== */
  function wireChrome(){
    const veil = document.getElementById('veil');
    const cartPanel = document.getElementById('cartPanel');
    const wishlistPanel = document.getElementById('wishlistPanel');
    const accountPanel = document.getElementById('accountPanel');
    const mobileNavPanel = document.getElementById('mobileNavPanel');
    const cartBody = document.getElementById('cartBody');
    const cartFoot = document.getElementById('cartFoot');
    const bagCount = document.getElementById('bagCount');
    const wishlistBody = document.getElementById('wishlistBody');
    const wishlistCount = document.getElementById('wishlistCount');
    const FREE_SHIP_THRESHOLD = 1999;

    function openPanel(panel){ veil.classList.add('active'); panel.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeAllPanels(){
      veil.classList.remove('active');
      [cartPanel, wishlistPanel, accountPanel, mobileNavPanel].forEach(p => p && p.classList.remove('active'));
      const burger = document.getElementById('burgerBtn');
      if(burger){ burger.classList.remove('open'); burger.setAttribute('aria-expanded','false'); }
      document.body.style.overflow = '';
    }
    veil.addEventListener('click', closeAllPanels);
    document.getElementById('cartOpenBtn').addEventListener('click', () => openPanel(cartPanel));
    document.getElementById('cartCloseBtn').addEventListener('click', closeAllPanels);
    document.getElementById('wishlistOpenBtn').addEventListener('click', () => openPanel(wishlistPanel));
    document.getElementById('wishlistCloseBtn').addEventListener('click', closeAllPanels);
    document.getElementById('accountOpenBtn').addEventListener('click', () => openPanel(accountPanel));
    document.getElementById('accountCloseBtn').addEventListener('click', closeAllPanels);
    window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeAllPanels(); });

    const burger = document.getElementById('burgerBtn');
    burger.addEventListener('click', () => mobileNavPanel.classList.contains('active') ? closeAllPanels() : (openPanel(mobileNavPanel), burger.classList.add('open')));
    document.getElementById('mobileNavCloseBtn').addEventListener('click', closeAllPanels);
    const shopToggle = document.getElementById('mobileShopToggle');
    if(shopToggle) shopToggle.addEventListener('click', () => document.getElementById('mobileShopAccordion').classList.toggle('open'));
    const mobileAccountBtn = document.getElementById('mobileAccountBtn');
    if(mobileAccountBtn) mobileAccountBtn.addEventListener('click', () => { closeAllPanels(); openPanel(accountPanel); });
    const mobileBagBtn = document.getElementById('mobileBagBtn');
    if(mobileBagBtn) mobileBagBtn.addEventListener('click', () => { closeAllPanels(); openPanel(cartPanel); });

    const mobileMount = document.getElementById('mobileCatGroups');
    if(mobileMount){
      mobileMount.innerHTML = CATEGORIES.map(cat => `
        <div class="mobile-cat-group">
          <h5>${escapeHtml(cat.label)}</h5>
          <a href="${buildCategoryUrl({ wear: cat.key })}" class="mobile-cat-link">All ${escapeHtml(cat.label)}</a>
          ${cat.types.map(t => `<a href="${buildCategoryUrl({ wear: cat.key, type: t.key })}" class="mobile-cat-link">${escapeHtml(t.label)}</a>`).join('')}
        </div>`).join('');
    }
    const featureCol = document.getElementById('megaFeatureCol');
    if(featureCol){
      featureCol.insertAdjacentHTML('beforebegin', CATEGORIES.map(cat => `
        <div class="mega-col">
          <h4>${escapeHtml(cat.label)}</h4>
          <ul>
            <li><a href="${buildCategoryUrl({ wear: cat.key })}">All ${escapeHtml(cat.label)}</a></li>
            ${cat.types.map(t => `<li><a href="${buildCategoryUrl({ wear: cat.key, type: t.key })}">${escapeHtml(t.label)}</a></li>`).join('')}
          </ul>
        </div>`).join(''));
    }
    const megaTrigger = document.getElementById('megaTrigger');
    const megaTriggerLink = document.getElementById('megaTriggerLink');
    if(megaTriggerLink){
      megaTriggerLink.addEventListener('click', (e) => {
        if(window.innerWidth <= 900) return;
        e.preventDefault();
        megaTrigger.classList.toggle('open');
      });
      document.addEventListener('click', (e) => { if(!megaTrigger.contains(e.target)) megaTrigger.classList.remove('open'); });
    }

    setupHeaderSearch();

    function renderCart(){
      const items = Cart.getItems();
      bagCount.textContent = Cart.count();
      bagCount.classList.toggle('show', Cart.count() > 0);
      if(items.length === 0){
        cartBody.innerHTML = `<div class="cart-empty"><span>Your bag is empty.</span></div>`;
        cartFoot.innerHTML = '';
        return;
      }
      cartBody.innerHTML = items.map(item => `
        <div class="cart-item">
          <img src="${item.img}" alt="${escapeHtml(item.name)}">
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(item.name)}</div>
            <div class="cart-item-meta">${fmtRupee(item.price)} each</div>
            <div class="cart-item-row">
              <div class="qty-control">
                <button data-action="dec" data-id="${escapeHtml(item.id)}">−</button><span>${item.qty}</span><button data-action="inc" data-id="${escapeHtml(item.id)}">+</button>
              </div>
              <span class="cart-item-price">${fmtRupee(item.price * item.qty)}</span>
            </div>
            <button class="cart-item-remove" data-action="remove" data-id="${escapeHtml(item.id)}">Remove</button>
          </div>
        </div>`).join('');
      const subtotal = Cart.subtotal();
      const remaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
      cartFoot.innerHTML = `
        <div class="cart-progress"><i style="width:${Math.min(100,(subtotal/FREE_SHIP_THRESHOLD)*100)}%"></i></div>
        <div class="cart-shipping-note">${remaining > 0 ? `Add <b>${fmtRupee(remaining)}</b> more for free shipping.` : `<b>Free shipping unlocked ✓</b>`}</div>
        <div class="cart-subtotal-row"><span>Subtotal</span><span>${fmtRupee(subtotal)}</span></div>
        <button class="cart-checkout" id="cartCheckoutBtn" title="Full checkout coming soon">Checkout →</button>`;
    }
    function renderWishlist(){
      const items = Wishlist.getItems();
      wishlistCount.textContent = items.length;
      wishlistCount.classList.toggle('show', items.length > 0);
      wishlistBody.innerHTML = items.length === 0
        ? `<div class="cart-empty"><span>Nothing saved yet.</span></div>`
        : items.map(item => `
          <div class="wishlist-item">
            <img src="${item.img}" alt="${escapeHtml(item.name)}">
            <div class="wishlist-item-info">
              <div class="wishlist-item-name">${escapeHtml(item.name)}</div>
              <div class="wishlist-item-price">${fmtRupee(item.price)}</div>
              <div class="wishlist-item-actions">
                <button class="wishlist-move" data-wishlist-move="${escapeHtml(item.id)}">Move to bag</button>
                <button class="wishlist-remove" data-wishlist-remove="${escapeHtml(item.id)}">Remove</button>
              </div>
            </div>
          </div>`).join('');
    }
    Cart.onChange(renderCart);
    Wishlist.onChange(renderWishlist);
    renderCart();
    renderWishlist();

    cartBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      if(btn.dataset.action === 'inc') Cart.changeQty(btn.dataset.id, 1);
      if(btn.dataset.action === 'dec') Cart.changeQty(btn.dataset.id, -1);
      if(btn.dataset.action === 'remove') Cart.remove(btn.dataset.id);
    });
    wishlistBody.addEventListener('click', (e) => {
      const moveId = e.target.closest('[data-wishlist-move]')?.dataset.wishlistMove;
      const removeId = e.target.closest('[data-wishlist-remove]')?.dataset.wishlistRemove;
      if(moveId){ const item = Wishlist.getItems().find(i => i.id === moveId); if(item) Cart.add(item.id, item.name, item.price, item.img); Wishlist.remove(moveId); }
      if(removeId) Wishlist.remove(removeId);
    });
    document.body.addEventListener('click', (e) => {
      if(e.target.closest('#cartCheckoutBtn')){
        e.preventDefault();
        alert('Full checkout (address, payment, GoKwik) is coming in the next phase. Your bag is saved and will carry over.');
      }
    });
  }

  async function boot(){
    if(!productId){
      layout.innerHTML = `<div class="pdp-loading">No product specified. <a href="/category.html">Browse all products →</a></div>`;
      return;
    }
    try {
      CATEGORIES = await fetch('/api/categories').then(r => r.json());
    } catch(e){ CATEGORIES = []; }

    wireChrome();

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
      if(!res.ok) throw new Error('not found');
      product = await res.json();
    } catch(err){
      layout.innerHTML = `<div class="pdp-loading">We couldn't find that product. <a href="/category.html">Browse all products →</a></div>`;
      return;
    }

    renderBreadcrumb(product, CATEGORIES);
    renderLayout(product);
    loadRelated();
  }

  boot();
})();
