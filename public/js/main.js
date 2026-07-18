    const header = document.getElementById('siteHeader');
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    });

    /* escapeHtml, Cart, Wishlist, Compare are defined in shop-common.js (loaded before this file) */

    /* ===================== DATA (fetched from the backend) ===================== */
    let CATEGORIES = [];  // Shop menu: [{ key, label, unisex, types:[{key,label}] }]
    let SECTIONS = [];    // Homepage sections: [{ key, title, layout, order }]
    let PRODUCTS = [];    // All products

    function categoryLabels(){
      const typeLabels = {};
      const wearLabels = {};
      CATEGORIES.forEach(c => {
        wearLabels[c.key] = c.label;
        c.types.forEach(t => { typeLabels[t.key] = t.label; });
      });
      return { typeLabels, wearLabels };
    }

    /* ===================== PRODUCT CARD RENDERING ===================== */
    function productCardHTML(p){
      const back = p.imgBack || p.imgFront;
      const saved = Wishlist.has(p.id);
      return `
      <div class="product-card" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${Number(p.price)}" data-img="${escapeHtml(p.imgFront)}" data-gender="${escapeHtml(p.gender)}" data-wear="${escapeHtml(p.wear)}" data-type="${escapeHtml(p.type)}">
        <div class="product-media">
          ${p.isNew ? '<span class="tag-new">New</span>' : ''}
          <button class="heart-btn${saved ? ' saved' : ''}" data-wishlist-toggle aria-label="Save to wishlist">
            <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2 5 5.4 5c2 0 3.4 1 4.6 2.6C11.2 6 12.6 5 14.6 5 18 5 19.6 8.4 18 11.7 15.5 16.3 12 21 12 21z"/></svg>
          </button>
          <img class="front" src="${escapeHtml(p.imgFront)}" alt="${escapeHtml(p.name)} — front">
          <img class="back" src="${escapeHtml(back)}" alt="${escapeHtml(p.name)} — back">
          <div class="product-bracket"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>
        </div>
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-sizes">${escapeHtml(p.sizes)}</div>
          </div>
          <div class="product-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
          <button class="add-to-bag" data-add-to-bag>+ Bag</button>
        </div>
      </div>`;
    }

    function productsFor(key){
      return PRODUCTS.filter(p => Array.isArray(p.sections) && p.sections.includes(key));
    }

    // The homepage is a preview, not the full catalog — cap how much shows here
    // so it doesn't turn into an endless scroll. Full browsing lives on the
    // dedicated category pages via "View All".
    const HOMEPAGE_PREVIEW_LIMIT = { shop: 8, new: 4, bestsellers: 8, extra: 8 };

    const DEFAULT_SECTION_KEYS = ['shop', 'new', 'bestsellers'];

    function renderHomepageSections(){
      const shopGrid = document.getElementById('shopGrid');
      if (shopGrid) shopGrid.innerHTML = productsFor('shop').slice(0, HOMEPAGE_PREVIEW_LIMIT.shop).map(productCardHTML).join('') || '<p style="color:var(--grey);">No products in this section yet.</p>';

      const newGrid = document.getElementById('newGrid');
      if (newGrid) newGrid.innerHTML = productsFor('new').slice(0, HOMEPAGE_PREVIEW_LIMIT.new).map(productCardHTML).join('');

      const bestGrid = document.getElementById('carouselViewport');
      if (bestGrid) bestGrid.innerHTML = productsFor('bestsellers').slice(0, HOMEPAGE_PREVIEW_LIMIT.bestsellers).map(productCardHTML).join('');

      const mount = document.getElementById('extraSectionsMount');
      if (!mount) return;
      mount.innerHTML = '';
      SECTIONS.filter(s => !DEFAULT_SECTION_KEYS.includes(s.key)).forEach(s => {
        const items = productsFor(s.key).slice(0, HOMEPAGE_PREVIEW_LIMIT.extra);
        if (s.layout === 'carousel') {
          mount.insertAdjacentHTML('beforeend', `
            <section class="section" id="section-${escapeHtml(s.key)}">
              <div class="carousel-head">
                <h2 class="section-title">${escapeHtml(s.title)}</h2>
                <div class="carousel-nav">
                  <a href="${buildCategoryUrl({ section: s.key })}" class="section-link" style="margin-right:16px;">View All →</a>
                  <button class="carousel-arrow" data-carousel-prev aria-label="Previous items">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button class="carousel-arrow" data-carousel-next aria-label="Next items">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
              <div class="carousel-viewport" data-carousel-viewport>
                ${items.map(productCardHTML).join('')}
              </div>
            </section>`);
        } else {
          mount.insertAdjacentHTML('beforeend', `
            <section class="section" id="section-${escapeHtml(s.key)}">
              <div class="section-head">
                <h2 class="section-title">${escapeHtml(s.title)}</h2>
                <a href="${buildCategoryUrl({ section: s.key })}" class="section-link">View All →</a>
              </div>
              <div class="product-grid">
                ${items.map(productCardHTML).join('') || '<p style="color:var(--grey);">No products in this section yet.</p>'}
              </div>
            </section>`);
        }
      });
    }

    /* ===================== MENU RENDERING (desktop mega menu + mobile drawer) ===================== */
    function megaColumnHTML(cat){
      return `
        <div class="mega-col">
          <h4>${escapeHtml(cat.label)}</h4>
          <ul>
            <li><a href="#shop" data-wear="${escapeHtml(cat.key)}"${cat.unisex ? ' data-gender="unisex"' : ''}>All ${escapeHtml(cat.label)}</a></li>
            ${cat.types.map(t => `<li><a href="#shop" data-type="${escapeHtml(t.key)}">${escapeHtml(t.label)}</a></li>`).join('')}
          </ul>
        </div>`;
    }

    function mobileGroupHTML(cat){
      return `
        <div class="mobile-cat-group">
          <h5>${escapeHtml(cat.label)}</h5>
          <a href="#shop" class="mobile-cat-link" data-wear="${escapeHtml(cat.key)}"${cat.unisex ? ' data-gender="unisex"' : ''}>All ${escapeHtml(cat.label)}</a>
          ${cat.types.map(t => `<a href="#shop" class="mobile-cat-link" data-type="${escapeHtml(t.key)}">${escapeHtml(t.label)}</a>`).join('')}
        </div>`;
    }

    function renderMenus(){
      const featureCol = document.getElementById('megaFeatureCol');
      if (featureCol) {
        featureCol.insertAdjacentHTML('beforebegin', CATEGORIES.map(megaColumnHTML).join(''));
      }
      const mobileMount = document.getElementById('mobileCatGroups');
      if (mobileMount) {
        mobileMount.innerHTML = CATEGORIES.map(mobileGroupHTML).join('');
      }
    }

    /* ===================== CATEGORY MEGA MENU (desktop) ===================== */
    function setupMegaMenu(){
      const trigger = document.getElementById('megaTrigger');
      const triggerLink = document.getElementById('megaTriggerLink');
      const menu = document.getElementById('megaMenu');
      const genderBtns = document.querySelectorAll('.mega-gender-btn');
      const megaViewAll = document.getElementById('megaViewAll');
      let currentGender = 'men';

      function openMenu(){ trigger.classList.add('open'); }
      function closeMenu(){ trigger.classList.remove('open'); }

      // Mega menu only exists/opens above the 900px mobile breakpoint.
      triggerLink.addEventListener('click', (e) => {
        if(window.innerWidth <= 900) return; // mobile drawer handles nav below this width
        if(trigger.classList.contains('open')){
          closeMenu();
        }else{
          e.preventDefault();
          openMenu();
        }
      });
      document.addEventListener('click', (e) => {
        if(!trigger.contains(e.target)) closeMenu();
      });
      window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeMenu(); });

      genderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          genderBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentGender = btn.dataset.gender;
        });
      });

      // Event delegation: category links are rendered dynamically, so we
      // listen on the menu container rather than on each link directly.
      // Clicking a category now takes you to its own category page (with
      // real filters/sort/pagination) instead of filtering the homepage.
      menu.addEventListener('click', (e) => {
        const link = e.target.closest('.mega-col a[data-wear], .mega-col a[data-type]');
        if(!link) return;
        e.preventDefault();
        const gender = link.dataset.gender || currentGender;
        window.location.href = buildCategoryUrl({ gender, wear: link.dataset.wear || undefined, type: link.dataset.type || undefined });
      });

      megaViewAll.addEventListener('click', (e) => { e.preventDefault(); window.location.href = buildCategoryUrl({}); });
    }

    // Any "View All Products" link anywhere on the homepage (shop section,
    // new arrivals section, or a future admin-added section) goes to the
    // full category browse page.
    // Every "View All" link now has a real, correct href already (set in the
    // HTML or built by renderHomepageSections). This just makes sure the
    // mobile drawer closes cleanly if the link was clicked from inside it.
    function setupViewAllLinks(){
      document.body.addEventListener('click', (e) => {
        const link = e.target.closest('.section-link, #mobileViewAll');
        if(!link) return;
        const mobileNav = document.getElementById('mobileNavPanel');
        if(mobileNav && mobileNav.classList.contains('active')) closeAllPanels();
      });
    }

    /* ===================== MOBILE NAV DRAWER ===================== */
    function setupMobileDrawer(){
      const burger = document.getElementById('burgerBtn');
      const panel = document.getElementById('mobileNavPanel');
      const closeBtn = document.getElementById('mobileNavCloseBtn');
      const shopAccordion = document.getElementById('mobileShopAccordion');
      const shopToggle = document.getElementById('mobileShopToggle');
      const genderBtns = panel.querySelectorAll('.mobile-gender-btn');
      const catGroupsMount = document.getElementById('mobileCatGroups');
      const accountBtn = document.getElementById('mobileAccountBtn');
      const bagBtn = document.getElementById('mobileBagBtn');
      let currentGender = 'men';

      function openDrawer(){
        openPanel(panel);
        burger.classList.add('open');
        burger.setAttribute('aria-expanded', 'true');
      }
      function closeDrawer(){
        closeAllPanels();
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }

      burger.addEventListener('click', () => {
        panel.classList.contains('active') ? closeDrawer() : openDrawer();
      });
      burger.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); burger.click(); }
      });
      closeBtn.addEventListener('click', closeDrawer);

      shopToggle.addEventListener('click', () => {
        shopAccordion.classList.toggle('open');
      });

      genderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          genderBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentGender = btn.dataset.gender;
        });
      });

      catGroupsMount.addEventListener('click', (e) => {
        const link = e.target.closest('.mobile-cat-link[data-wear], .mobile-cat-link[data-type]');
        if(!link) return;
        e.preventDefault();
        const gender = link.dataset.gender || currentGender;
        window.location.href = buildCategoryUrl({ gender, wear: link.dataset.wear || undefined, type: link.dataset.type || undefined });
      });

      accountBtn.addEventListener('click', () => { closeDrawer(); document.getElementById('accountOpenBtn').click(); });
      bagBtn.addEventListener('click', () => { closeDrawer(); document.getElementById('cartOpenBtn').click(); });

      // Keep desktop mega menu and mobile drawer from both being open when resizing across the breakpoint.
      window.addEventListener('resize', () => {
        if(window.innerWidth > 900 && panel.classList.contains('active')) closeDrawer();
      });
    }

    /* ===== MOTION GRAPHICS: marquee loops purely via CSS (translate3d -50%)
       against exactly-duplicated track content, so it's always seamless. ===== */

    /* ===================== CAROUSELS (left/right card switching) =====================
       Handles the built-in Best Sellers carousel AND any carousel-layout
       sections an admin adds later, via delegated buttons + data attributes. */
    function initCarousel(viewport, prevBtn, nextBtn){
      if(!viewport || !prevBtn || !nextBtn) return;

      function cardStep(){
        const card = viewport.querySelector('.product-card');
        if(!card) return 300;
        const style = getComputedStyle(viewport);
        const gap = parseFloat(style.columnGap || style.gap) || 24;
        return card.getBoundingClientRect().width + gap;
      }

      function updateArrowState(){
        const maxScroll = viewport.scrollWidth - viewport.clientWidth - 2;
        prevBtn.disabled = viewport.scrollLeft <= 2;
        nextBtn.disabled = viewport.scrollLeft >= maxScroll;
      }

      prevBtn.addEventListener('click', () => viewport.scrollBy({ left: -cardStep(), behavior: 'smooth' }));
      nextBtn.addEventListener('click', () => viewport.scrollBy({ left: cardStep(), behavior: 'smooth' }));
      viewport.addEventListener('scroll', updateArrowState, { passive: true });
      window.addEventListener('resize', updateArrowState);
      updateArrowState();
    }

    function setupCarousels(){
      const bestViewport = document.getElementById('carouselViewport');
      initCarousel(bestViewport, document.getElementById('carouselPrev'), document.getElementById('carouselNext'));

      document.querySelectorAll('[data-carousel-viewport]').forEach(viewport => {
        const section = viewport.closest('.section');
        initCarousel(viewport, section.querySelector('[data-carousel-prev]'), section.querySelector('[data-carousel-next]'));
      });
    }

    /* ===================== CART / WISHLIST PANELS ===================== */
    const FREE_SHIP_THRESHOLD = 1999;

    const veil = document.getElementById('veil');
    const cartPanel = document.getElementById('cartPanel');
    const wishlistPanel = document.getElementById('wishlistPanel');
    const accountPanel = document.getElementById('accountPanel');
    const cartBody = document.getElementById('cartBody');
    const cartFoot = document.getElementById('cartFoot');
    const bagCount = document.getElementById('bagCount');
    const wishlistBody = document.getElementById('wishlistBody');
    const wishlistCount = document.getElementById('wishlistCount');

    function openPanel(panel){
      veil.classList.add('active');
      panel.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeAllPanels(){
      veil.classList.remove('active');
      [cartPanel, wishlistPanel, accountPanel].forEach(p => p && p.classList.remove('active'));
      const mobileNav = document.getElementById('mobileNavPanel');
      if(mobileNav) mobileNav.classList.remove('active');
      const burger = document.getElementById('burgerBtn');
      if(burger){ burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
      document.body.style.overflow = '';
    }
    veil.addEventListener('click', closeAllPanels);

    document.getElementById('cartOpenBtn').addEventListener('click', () => openPanel(cartPanel));
    document.getElementById('cartCloseBtn').addEventListener('click', closeAllPanels);
    document.getElementById('wishlistOpenBtn').addEventListener('click', () => openPanel(wishlistPanel));
    document.getElementById('wishlistCloseBtn').addEventListener('click', closeAllPanels);
    document.getElementById('accountOpenBtn').addEventListener('click', () => openPanel(accountPanel));
    document.getElementById('accountCloseBtn').addEventListener('click', closeAllPanels);
    const savedItemsLink = document.getElementById('profileSavedItemsLink');
    if(savedItemsLink) savedItemsLink.addEventListener('click', (e) => { e.preventDefault(); closeAllPanels(); openPanel(wishlistPanel); });
    window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeAllPanels(); });

    function renderCart(){
      const items = Cart.getItems();
      const totalQty = Cart.count();
      bagCount.textContent = totalQty;
      bagCount.classList.toggle('show', totalQty > 0);

      if(items.length === 0){
        cartBody.innerHTML = `
          <div class="cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>
            <span>Your bag is empty.<br>Add something you'll actually wear.</span>
          </div>`;
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
                <button data-action="dec" data-id="${escapeHtml(item.id)}">−</button>
                <span>${item.qty}</span>
                <button data-action="inc" data-id="${escapeHtml(item.id)}">+</button>
              </div>
              <span class="cart-item-price">${fmtRupee(item.price * item.qty)}</span>
            </div>
            <button class="cart-item-remove" data-action="remove" data-id="${escapeHtml(item.id)}">Remove</button>
          </div>
        </div>
      `).join('');

      const subtotal = Cart.subtotal();
      const remaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);
      const progressPct = Math.min(100, (subtotal / FREE_SHIP_THRESHOLD) * 100);

      cartFoot.innerHTML = `
        <div class="cart-progress"><i style="width:${progressPct}%"></i></div>
        <div class="cart-shipping-note">
          ${remaining > 0
            ? `Add <b>${fmtRupee(remaining)}</b> more for free shipping.`
            : `<b>You've unlocked free shipping ✓</b>`}
        </div>
        <div class="cart-subtotal-row">
          <span>Subtotal</span>
          <span>${fmtRupee(subtotal)}</span>
        </div>
        <button class="cart-checkout" id="cartCheckoutBtn" title="Full checkout is being built next — coming soon">Checkout →</button>
      `;
    }

    function renderWishlist(){
      const items = Wishlist.getItems();
      wishlistCount.textContent = items.length;
      wishlistCount.classList.toggle('show', items.length > 0);

      if(items.length === 0){
        wishlistBody.innerHTML = `
          <div class="cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2 5 5.4 5c2 0 3.4 1 4.6 2.6C11.2 6 12.6 5 14.6 5 18 5 19.6 8.4 18 11.7 15.5 16.3 12 21 12 21z"/></svg>
            <span>Nothing saved yet.<br>Tap the heart on any product to save it here.</span>
          </div>`;
        return;
      }

      wishlistBody.innerHTML = items.map(item => `
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
        </div>
      `).join('');
    }

    Cart.onChange(renderCart);
    Wishlist.onChange(renderWishlist);
    renderCart();
    renderWishlist();

    cartBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      const id = btn.dataset.id;
      if(btn.dataset.action === 'inc') Cart.changeQty(id, 1);
      if(btn.dataset.action === 'dec') Cart.changeQty(id, -1);
      if(btn.dataset.action === 'remove') Cart.remove(id);
    });

    wishlistBody.addEventListener('click', (e) => {
      const moveId = e.target.closest('[data-wishlist-move]')?.dataset.wishlistMove;
      const removeId = e.target.closest('[data-wishlist-remove]')?.dataset.wishlistRemove;
      if(moveId){
        const item = Wishlist.getItems().find(i => i.id === moveId);
        if(item) Cart.add(item.id, item.name, item.price, item.img);
        Wishlist.remove(moveId);
      }
      if(removeId) Wishlist.remove(removeId);
    });

    // Delegated so it works for product cards rendered dynamically at any point.
    document.body.addEventListener('click', (e) => {
      const bagBtn = e.target.closest('[data-add-to-bag]');
      if(bagBtn){
        e.preventDefault();
        const card = bagBtn.closest('.product-card');
        Cart.add(card.dataset.id, card.dataset.name, Number(card.dataset.price), card.dataset.img);
        bagBtn.textContent = 'Added ✓';
        bagBtn.classList.add('added');
        setTimeout(() => { bagBtn.textContent = '+ Bag'; bagBtn.classList.remove('added'); }, 1200);
        return;
      }

      const heartBtn = e.target.closest('[data-wishlist-toggle]');
      if(heartBtn){
        e.preventDefault();
        const card = heartBtn.closest('.product-card');
        const isSaved = Wishlist.toggle(card.dataset.id, card.dataset.name, Number(card.dataset.price), card.dataset.img);
        heartBtn.classList.toggle('saved', isSaved);
        return;
      }

      // Checkout isn't built yet (that's the next phase) — say so instead of doing nothing.
      if(e.target.closest('#cartCheckoutBtn')){
        e.preventDefault();
        alert('Full checkout (address, payment, GoKwik) is coming in the next phase. Your bag is saved and will carry over.');
        return;
      }

      // Clicking anywhere on a product card (that isn't a button on it) opens its detail page.
      const card = e.target.closest('.product-card');
      if(card && !e.target.closest('button')){
        window.location.href = `/product.html?id=${encodeURIComponent(card.dataset.id)}`;
      }
    });

    /* Account (sign in / sign up / Google sign-in / sign out) is now handled by the
       shared /js/account.js, loaded on this page right after main.js. */

    /* ===================== BOOT: fetch data, render, then wire up all UI ===================== */
    async function boot(){
      try{
        const [products, categories, sections] = await Promise.all([
          fetch('/api/products').then(r => r.json()),
          fetch('/api/categories').then(r => r.json()),
          fetch('/api/sections').then(r => r.json())
        ]);
        PRODUCTS = products;
        CATEGORIES = categories;
        SECTIONS = sections.sort((a, b) => a.order - b.order);
      }catch(err){
        console.error('Could not load storefront data from the server:', err);
        PRODUCTS = []; CATEGORIES = []; SECTIONS = [];
      }

      renderMenus();
      renderHomepageSections();
      setupMegaMenu();
      setupMobileDrawer();
      setupViewAllLinks();
      setupHeaderSearch();
      setupCarousels();
    }

    boot();
