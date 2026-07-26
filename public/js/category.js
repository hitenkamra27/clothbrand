(function(){
  'use strict';

  const PAGE_SIZE = 12;
  let CATEGORIES = [];
  let currentFacets = { colors:[], brands:[], materials:[], sizes:[], types:[], priceMin:0, priceMax:0 };
  let accumulatedItems = []; // for infinite-scroll append mode
  let currentPage = 1;
  let totalPages = 1;
  let totalCount = 0;
  let loading = false;

  const grid = document.getElementById('catGrid');
  const resultCount = document.getElementById('catResultCount');
  const chipsEl = document.getElementById('catChips');
  const sentinel = document.getElementById('catInfiniteSentinel');
  const infiniteSpinner = document.getElementById('catInfiniteSpinner');
  const infiniteEnd = document.getElementById('catInfiniteEnd');
  const sortSelect = document.getElementById('catSortSelect');

  /* ===================== CATEGORY -> HERO / TITLE MAPPING ===================== */
  const HERO_MAP = {
    men: { title: 'Menswear', eyebrow: 'For Him', desc: 'Considered essentials, cut for movement. Shirting, denim, knitwear and outerwear built to outlast the season.', img: 'https://picsum.photos/seed/heromen/1800/900' },
    women: { title: 'Womenswear', eyebrow: 'For Her', desc: 'Fluid silhouettes and quiet tailoring. A wardrobe of pieces that move between seasons.', img: 'https://picsum.photos/seed/herowomen/1800/900' },
    accessories: { title: 'Accessories', eyebrow: 'The Details', desc: 'The finishing pieces — bags, caps, and small goods that complete the look.', img: 'https://picsum.photos/seed/heroaccessories/1800/900' },
    footwear: { title: 'Footwear', eyebrow: 'Head to Toe', desc: 'Sneakers, boots, and everyday shoes built on comfort first, style second — never one without the other.', img: 'https://picsum.photos/seed/herofootwear/1800/900' },
    new: { title: 'New Arrivals', eyebrow: 'Just Landed', desc: 'The latest pieces to hit the floor, first.', img: 'https://picsum.photos/seed/heronew/1800/900' },
    bestsellers: { title: 'Best Sellers', eyebrow: 'Fan Favorites', desc: 'What everyone keeps coming back for.', img: 'https://picsum.photos/seed/herobest/1800/900' },
    sale: { title: 'Sale', eyebrow: 'Limited Time', desc: 'Past-season favorites, marked down while stock lasts.', img: 'https://picsum.photos/seed/herosale/1800/900' },
    search: { title: 'Search Results', eyebrow: 'Hive & Ash', desc: '', img: 'https://picsum.photos/seed/herosearch/1800/900' },
    all: { title: 'Shop All', eyebrow: 'The Full Collection', desc: 'Every piece, in one place.', img: 'https://picsum.photos/seed/heroall/1800/900' }
  };

  function currentHeroKey(state){
    if(state.q) return 'search';
    if(state.sale === 'true') return 'sale';
    if(state.section === 'bestsellers') return 'bestsellers';
    if(state.isNew === 'true') return 'new';
    if(state.wear === 'footwear') return 'footwear';
    if(state.wear === 'accessories') return 'accessories';
    if(state.gender === 'men') return 'men';
    if(state.gender === 'women') return 'women';
    return 'all';
  }

  function renderHero(state){
    const key = currentHeroKey(state);
    const hero = HERO_MAP[key] || HERO_MAP.all;
    document.getElementById('catHeroImg').src = hero.img;
    document.getElementById('catHeroEyebrow').textContent = hero.eyebrow;
    document.getElementById('catHeroTitle').textContent = state.q ? `Results for "${state.q}"` : hero.title;
    document.getElementById('catHeroDesc').textContent = hero.desc;
    document.getElementById('pageTitle').textContent = `${hero.title} — Hive & Ash`;
  }

  /* ===================== STATE (mirrors the URL) ===================== */
  function getState(){
    const params = new URLSearchParams(window.location.search);
    const state = {};
    ['gender','wear','type','color','brand','material','size','minPrice','maxPrice','minRating','q','sort','isNew','section','sale'].forEach(k => {
      if(params.has(k)) state[k] = params.get(k);
    });
    state.page = parseInt(params.get('page'), 10) || 1;
    return state;
  }

  function setState(patch, { resetPage = true } = {}){
    const state = getState();
    Object.entries(patch).forEach(([k,v]) => {
      if(v === undefined || v === null || v === '') delete state[k];
      else state[k] = v;
    });
    if(resetPage) delete state.page;
    const usp = new URLSearchParams();
    Object.entries(state).forEach(([k,v]) => { if(v !== undefined) usp.set(k, v); });
    const qs = usp.toString();
    window.history.pushState({}, '', '/category.html' + (qs ? '?' + qs : ''));
    loadAndRender({ append: false });
  }

  /* ===================== PRODUCT CARD (category-page variant: adds Quick View + Compare) ===================== */
  function catProductCardHTML(p){
    const back = p.imgBack || p.imgFront;
    const saved = Wishlist.has(p.id);
    const compared = Compare.has(p.id);
    const onSale = p.salePrice != null && p.salePrice < p.price;
    const priceHTML = onSale
      ? `<span class="price-strike">${fmtRupee(p.price)}</span><span class="price-sale">${fmtRupee(p.salePrice)}</span>`
      : `${fmtRupee(p.price)}`;
    const stars = '★'.repeat(Math.round(p.rating || 0)) + '☆'.repeat(5 - Math.round(p.rating || 0));

    return `
      <div class="product-card" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}" data-price="${Number(p.salePrice ?? p.price)}" data-img="${escapeHtml(p.imgFront)}" data-gender="${escapeHtml(p.gender)}" data-wear="${escapeHtml(p.wear)}" data-type="${escapeHtml(p.type)}">
        <div class="product-media">
          ${onSale ? '<span class="badge-sale">Sale</span>' : (p.isNew ? '<span class="tag-new">New</span>' : '')}
          <button class="heart-btn${saved ? ' saved' : ''}" data-wishlist-toggle aria-label="Save to wishlist">
            <svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.4 2 5 5.4 5c2 0 3.4 1 4.6 2.6C11.2 6 12.6 5 14.6 5 18 5 19.6 8.4 18 11.7 15.5 16.3 12 21 12 21z"/></svg>
          </button>
          <button class="compare-btn${compared ? ' active' : ''}" data-compare-toggle>${compared ? '✓ Comparing' : '+ Compare'}</button>
          <img class="front" src="${escapeHtml(p.imgFront)}" alt="${escapeHtml(p.name)} — front">
          <img class="back" src="${escapeHtml(back)}" alt="${escapeHtml(p.name)} — back">
          <div class="product-bracket"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>
          <button class="qv-btn" data-quick-view>Quick View</button>
        </div>
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-sizes">${escapeHtml(p.sizes)}</div>
            <div class="product-rating"><svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.3L18 21l-6-4.3L6 21l1.5-7.7L2 9h7z"/></svg>${(p.rating||0).toFixed(1)} (${p.reviewCount||0})</div>
          </div>
          <div class="product-price">${priceHTML}</div>
          <button class="add-to-bag" data-add-to-bag>+ Bag</button>
        </div>
      </div>`;
  }

  /* ===================== SIDEBAR FILTERS ===================== */
  function checkboxGroup(containerId, options, paramKey, current, labelFn){
    const el = document.getElementById(containerId);
    if(!options || options.length === 0){ el.innerHTML = '<span style="font-size:12px;color:var(--grey-light);">None available</span>'; return; }
    const currentSet = new Set((current || '').split(',').filter(Boolean));
    el.innerHTML = options.map(opt => {
      const value = typeof opt === 'string' ? opt : opt.key;
      const label = labelFn ? labelFn(opt) : value;
      const checked = currentSet.has(String(value).toLowerCase()) ? 'checked' : '';
      const swatch = paramKey === 'color' ? `<span class="swatch" style="background:${escapeHtml(value)}"></span>` : '';
      return `<label>${swatch}<input type="checkbox" value="${escapeHtml(value)}" data-filter-key="${paramKey}" ${checked}> ${escapeHtml(label)}</label>`;
    }).join('');
  }

  function renderSidebar(state, facets){
    const genderOptions = [
      { key: 'men', label: 'Men' }, { key: 'women', label: 'Women' },
      { key: 'unisex', label: 'Unisex' }
    ];
    checkboxGroup('filterGender', genderOptions, 'gender', state.gender, o => o.label);

    const typeOptions = facets.types.map(t => {
      let label = t;
      CATEGORIES.forEach(c => { const found = c.types.find(x => x.key === t); if(found) label = found.label; });
      return { key: t, label };
    });
    checkboxGroup('filterType', typeOptions, 'type', state.type, o => o.label);
    checkboxGroup('filterColor', facets.colors, 'color', state.color);
    checkboxGroup('filterSize', facets.sizes, 'size', state.size);
    checkboxGroup('filterBrand', facets.brands, 'brand', state.brand);
    checkboxGroup('filterMaterial', facets.materials, 'material', state.material);

    const ratingOptions = [4,3,2,1].map(r => ({ key: String(r), label: `${r}★ & up` }));
    checkboxGroup('filterRating', ratingOptions, 'minRating', state.minRating, o => o.label);
    // rating is single-select in practice — override to radio-like behavior visually via checkbox but only one checked
    if(state.minRating){
      document.querySelectorAll('#filterRating input').forEach(cb => {
        cb.checked = cb.value === state.minRating;
      });
    }

    document.getElementById('filterPriceMin').value = state.minPrice || '';
    document.getElementById('filterPriceMax').value = state.maxPrice || '';
  }

  function multiValueFromCheckboxes(key){
    const checked = Array.from(document.querySelectorAll(`input[data-filter-key="${key}"]:checked`)).map(cb => cb.value);
    return checked.join(',');
  }

  function wireSidebar(){
    document.getElementById('catSidebar').addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-filter-key]');
      if(!cb) return;
      const key = cb.dataset.filterKey;
      if(key === 'minRating'){
        // single-select behavior
        document.querySelectorAll('#filterRating input').forEach(other => { if(other !== cb) other.checked = false; });
        setState({ minRating: cb.checked ? cb.value : undefined });
        return;
      }
      setState({ [key]: multiValueFromCheckboxes(key) || undefined });
    });

    let priceDebounce;
    ['filterPriceMin','filterPriceMax'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        clearTimeout(priceDebounce);
        priceDebounce = setTimeout(() => {
          setState({
            minPrice: document.getElementById('filterPriceMin').value || undefined,
            maxPrice: document.getElementById('filterPriceMax').value || undefined
          });
        }, 500);
      });
    });

    document.getElementById('catClearFilters').addEventListener('click', () => {
      window.history.pushState({}, '', '/category.html');
      loadAndRender({ append: false });
    });

    // Mobile filter drawer
    const sidebar = document.getElementById('catSidebar');
    document.getElementById('catMobileFilterBtn').addEventListener('click', () => {
      sidebar.classList.add('open');
      document.getElementById('veil').classList.add('active');
    });
    document.getElementById('veil').addEventListener('click', () => sidebar.classList.remove('open'));
  }

  /* ===================== ACTIVE FILTER CHIPS ===================== */
  const LABELS = { gender:'Gender', wear:'Category', type:'Type', color:'Color', size:'Size', brand:'Brand', material:'Material', minRating:'Rating', q:'Search', isNew:'New', section:'Section', sale:'Sale' };
  function renderChips(state){
    const chips = [];
    Object.entries(state).forEach(([k,v]) => {
      if(k === 'page' || k === 'sort' || !v) return;
      String(v).split(',').forEach(val => {
        chips.push({ key: k, value: val, label: `${LABELS[k] || k}: ${val}` });
      });
    });
    chipsEl.innerHTML = chips.map(c => `
      <span class="cat-chip" data-chip-key="${escapeHtml(c.key)}" data-chip-value="${escapeHtml(c.value)}">
        ${escapeHtml(c.label)} <button aria-label="Remove filter">✕</button>
      </span>`).join('');
  }
  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if(!chip) return;
    const key = chip.dataset.chipKey;
    const value = chip.dataset.chipValue;
    const state = getState();
    if(state[key] && state[key].includes(',')){
      const remaining = state[key].split(',').filter(v => v !== value).join(',');
      setState({ [key]: remaining || undefined });
    } else {
      setState({ [key]: undefined });
    }
  });

  /* ===================== INFINITE SCROLL ===================== */
  // Pure infinite scroll: no Load More button or page-number controls.
  // The sentinel + IntersectionObserver below silently fetch the next page as
  // the user scrolls near the bottom of the grid.
  function renderScrollStatus(){
    const hasMore = currentPage < totalPages;
    infiniteSpinner.hidden = true;
    infiniteEnd.hidden = !(accumulatedItems.length > 0 && !hasMore);
  }

  let observer;
  function setupInfiniteScroll(){
    if(observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting && !loading && currentPage < totalPages){
          infiniteSpinner.hidden = false;
          loadPage(currentPage + 1, { append: true });
        }
      });
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
  }

  /* ===================== LOAD + RENDER ===================== */
  function buildQuery(state, page){
    const usp = new URLSearchParams();
    Object.entries(state).forEach(([k,v]) => { if(v !== undefined && k !== 'page') usp.set(k, v); });
    usp.set('page', page);
    usp.set('pageSize', PAGE_SIZE);
    return usp.toString();
  }

  function renderGrid(items, append){
    if(!append) accumulatedItems = [];
    accumulatedItems = accumulatedItems.concat(items);

    if(accumulatedItems.length === 0){
      grid.innerHTML = `<div class="cat-empty">No products match these filters. Try clearing a few.</div>`;
      return;
    }
    const newHtml = items.map(catProductCardHTML).join('');
    if(append) grid.insertAdjacentHTML('beforeend', newHtml);
    else grid.innerHTML = newHtml;
  }

  async function loadPage(page, { append }){
    loading = true;
    const state = getState();
    const query = buildQuery(state, page);
    try {
      const res = await fetch(`/api/products?${query}`);
      const data = await res.json();
      currentPage = data.page;
      totalPages = data.totalPages;
      totalCount = data.total;
      renderGrid(data.items, append);
      resultCount.textContent = `${totalCount} product${totalCount === 1 ? '' : 's'}`;
      renderScrollStatus();
    } catch(err){
      console.error('Failed to load products', err);
      resultCount.textContent = 'Could not load products.';
    } finally {
      loading = false;
    }
  }

  async function loadFacets(state){
    const usp = new URLSearchParams();
    if(state.gender) usp.set('gender', state.gender);
    if(state.wear) usp.set('wear', state.wear);
    if(state.section) usp.set('section', state.section);
    if(state.isNew) usp.set('isNew', state.isNew);
    if(state.sale) usp.set('sale', state.sale);
    try {
      const res = await fetch(`/api/products/facets?${usp.toString()}`);
      currentFacets = await res.json();
    } catch(err){
      console.error('Failed to load facets', err);
    }
  }

  async function loadAndRender({ append }){
    const state = getState();
    renderHero(state);
    if(sortSelect.value !== (state.sort || '')) sortSelect.value = state.sort || '';
    renderChips(state);
    await loadFacets(state);
    renderSidebar(state, currentFacets);
    // Infinite scroll always starts from page 1 on a fresh filter/sort change;
    // "append" is only ever true when the sentinel triggers the next page.
    await loadPage(append ? (state.page || 1) : 1, { append });
    setupInfiniteScroll();
  }

  /* ===================== QUICK VIEW ===================== */
  const qvVeil = document.getElementById('qvModalVeil');
  let qvProduct = null;

  function openQuickView(product){
    qvProduct = product;
    const images = [product.imgFront, product.imgBack, ...(Array.isArray(product.images) ? product.images : [])]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    document.getElementById('qvImg').src = images[0];
    const qvThumbs = document.getElementById('qvThumbs');
    qvThumbs.innerHTML = images.length > 1
      ? images.map((img, i) => `<button class="${i === 0 ? 'active' : ''}" data-qv-img="${escapeHtml(img)}"><img src="${escapeHtml(img)}" alt=""></button>`).join('')
      : '';
    document.getElementById('qvName').textContent = product.name;
    const onSale = product.salePrice != null && product.salePrice < product.price;
    document.getElementById('qvPrice').innerHTML = onSale
      ? `<span class="price-strike">${fmtRupee(product.price)}</span> <span class="price-sale">${fmtRupee(product.salePrice)}</span>`
      : fmtRupee(product.price);
    document.getElementById('qvMeta').innerHTML = `
      Sizes: ${escapeHtml(product.sizes)}<br>
      Color: ${escapeHtml(product.color || '—')}<br>
      Material: ${escapeHtml(product.material || '—')}<br>
      Brand: ${escapeHtml(product.brand || '—')}<br>
      Rating: ${(product.rating||0).toFixed(1)} / 5 (${product.reviewCount||0} reviews)
    `;
    const wishBtn = document.getElementById('qvWishlist');
    wishBtn.classList.toggle('saved', Wishlist.has(product.id));
    qvVeil.classList.add('show');
  }
  document.getElementById('qvThumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-qv-img]');
    if(!btn) return;
    const mainImg = document.getElementById('qvImg');
    if(mainImg.src === btn.dataset.qvImg) return;
    mainImg.style.opacity = '0';
    setTimeout(() => { mainImg.src = btn.dataset.qvImg; mainImg.style.opacity = '1'; }, 150);
    document.getElementById('qvThumbs').querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
  document.getElementById('qvModalClose').addEventListener('click', () => qvVeil.classList.remove('show'));
  qvVeil.addEventListener('click', (e) => { if(e.target === qvVeil) qvVeil.classList.remove('show'); });

  document.getElementById('qvAddBag').addEventListener('click', () => {
    if(!qvProduct) return;
    Cart.add(qvProduct.id, qvProduct.name, Number(qvProduct.salePrice ?? qvProduct.price), qvProduct.imgFront);
    const btn = document.getElementById('qvAddBag');
    btn.textContent = 'Added ✓';
    setTimeout(() => { btn.textContent = '+ Add to Bag'; }, 1200);
  });
  document.getElementById('qvWishlist').addEventListener('click', () => {
    if(!qvProduct) return;
    const saved = Wishlist.toggle(qvProduct.id, qvProduct.name, Number(qvProduct.salePrice ?? qvProduct.price), qvProduct.imgFront);
    document.getElementById('qvWishlist').classList.toggle('saved', saved);
    document.querySelectorAll(`.product-card[data-id="${qvProduct.id}"] [data-wishlist-toggle]`).forEach(btn => btn.classList.toggle('saved', saved));
  });

  /* ===================== COMPARE ===================== */
  const compareBar = document.getElementById('compareBar');
  const compareModalVeil = document.getElementById('compareModalVeil');

  function renderCompareBar(){
    const items = Compare.getItems();
    compareBar.classList.toggle('show', items.length > 0);
    document.getElementById('compareBarItems').innerHTML = items.map(i => `<img class="compare-bar-thumb" src="${escapeHtml(i.imgFront)}" alt="${escapeHtml(i.name)}">`).join('')
      + `<span style="font-size:12px;">${items.length} selected</span>`;
  }
  function renderCompareTable(){
    const items = Compare.getItems();
    const rows = [
      { label: '', render: i => `<img src="${escapeHtml(i.imgFront)}" alt=""><div style="margin-top:8px;font-size:13px;font-weight:500;">${escapeHtml(i.name)}</div><button class="compare-remove" data-compare-remove="${escapeHtml(i.id)}">Remove</button>` },
      { label: 'Price', render: i => fmtRupee(i.salePrice ?? i.price) },
      { label: 'Color', render: i => escapeHtml(i.color || '—') },
      { label: 'Material', render: i => escapeHtml(i.material || '—') },
      { label: 'Brand', render: i => escapeHtml(i.brand || '—') },
      { label: 'Sizes', render: i => escapeHtml(i.sizes || '—') },
      { label: 'Rating', render: i => `${(i.rating||0).toFixed(1)} / 5` }
    ];
    document.getElementById('compareTable').innerHTML = rows.map(row => `
      <tr><th>${row.label}</th>${items.map(i => `<td>${row.render(i)}</td>`).join('')}</tr>
    `).join('');
  }
  document.getElementById('compareBarOpen').addEventListener('click', () => {
    if(Compare.getItems().length === 0) return;
    renderCompareTable();
    compareModalVeil.classList.add('show');
  });
  document.getElementById('compareBarClear').addEventListener('click', () => Compare.clear());
  document.getElementById('compareModalClose').addEventListener('click', () => compareModalVeil.classList.remove('show'));
  compareModalVeil.addEventListener('click', (e) => { if(e.target === compareModalVeil) compareModalVeil.classList.remove('show'); });
  document.getElementById('compareTable').addEventListener('click', (e) => {
    const id = e.target.closest('[data-compare-remove]')?.dataset.compareRemove;
    if(id){ Compare.remove(id); renderCompareTable(); }
  });
  Compare.onChange(renderCompareBar);

  /* ===================== GRID CLICK DELEGATION (quick view / compare toggle) ===================== */
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if(!card) return;
    const id = card.dataset.id;
    const product = accumulatedItems.find(p => p.id === id);

    if(e.target.closest('[data-quick-view]')){
      e.preventDefault();
      if(product) openQuickView(product);
      return;
    }
    if(e.target.closest('[data-compare-toggle]')){
      e.preventDefault();
      if(!product) return;
      const result = Compare.toggle(product);
      if(!result.ok){ alert(result.reason); return; }
      const btn = e.target.closest('[data-compare-toggle]');
      const nowActive = Compare.has(id);
      btn.classList.toggle('active', nowActive);
      btn.textContent = nowActive ? '✓ Comparing' : '+ Compare';
    }
  });

  /* ===================== BOOT ===================== */
  async function boot(){
    try {
      CATEGORIES = await fetch('/api/categories').then(r => r.json());
    } catch(e){ CATEGORIES = []; }

    // Render mega menu / mobile drawer categories same as homepage.
    const featureCol = document.getElementById('megaFeatureCol');
    if(featureCol){
      featureCol.insertAdjacentHTML('beforebegin', CATEGORIES.map(cat => `
        <div class="mega-col">
          <h4>${escapeHtml(cat.label)}</h4>
          <ul>
            <li><a href="#" data-wear="${escapeHtml(cat.key)}">All ${escapeHtml(cat.label)}</a></li>
            ${cat.types.map(t => `<li><a href="#" data-type="${escapeHtml(t.key)}">${escapeHtml(t.label)}</a></li>`).join('')}
          </ul>
        </div>`).join(''));
    }
    const mobileMount = document.getElementById('mobileCatGroups');
    if(mobileMount){
      mobileMount.innerHTML = CATEGORIES.map(cat => `
        <div class="mobile-cat-group">
          <h5>${escapeHtml(cat.label)}</h5>
          <a href="#" class="mobile-cat-link" data-wear="${escapeHtml(cat.key)}">All ${escapeHtml(cat.label)}</a>
          ${cat.types.map(t => `<a href="#" class="mobile-cat-link" data-type="${escapeHtml(t.key)}">${escapeHtml(t.label)}</a>`).join('')}
        </div>`).join('');
    }

    wireSidebar();
    setupHeaderSearch();

    sortSelect.addEventListener('change', () => setState({ sort: sortSelect.value || undefined }, { resetPage: true }));

    // Mega menu / mobile drawer navigation (same category.html page, different filters).
    document.getElementById('megaMenu').addEventListener('click', (e) => {
      const link = e.target.closest('a[data-wear], a[data-type]');
      if(!link) return;
      e.preventDefault();
      setState({ wear: link.dataset.wear || undefined, type: link.dataset.type || undefined });
      document.getElementById('megaTrigger').classList.remove('open');
    });
    mobileMount && mobileMount.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-wear], a[data-type]');
      if(!link) return;
      e.preventDefault();
      setState({ wear: link.dataset.wear || undefined, type: link.dataset.type || undefined });
    });

    // Bag / wishlist / account panels + header interactions shared with the homepage chrome.
    const veil = document.getElementById('veil');
    const cartPanel = document.getElementById('cartPanel');
    const wishlistPanel = document.getElementById('wishlistPanel');
    const accountPanel = document.getElementById('accountPanel');
    const orderHistoryPanel = document.getElementById('orderHistoryPanel');
    const accountSettingsPanel = document.getElementById('accountSettingsPanel');
    const mobileNavPanel = document.getElementById('mobileNavPanel');
    const cartBody = document.getElementById('cartBody');
    const cartFoot = document.getElementById('cartFoot');
    const bagCount = document.getElementById('bagCount');
    const wishlistBody = document.getElementById('wishlistBody');
    const wishlistCount = document.getElementById('wishlistCount');
    // Free shipping threshold comes from freeShipThreshold() (shop-common.js),
    // backed by /api/settings — re-render once it's loaded for real.
    if (typeof getSiteSettings === 'function') {
      getSiteSettings().then(s => { if (s) renderCart(); });
    }

    function openPanel(panel){ veil.classList.add('active'); panel.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeAllPanels(){
      veil.classList.remove('active');
      [cartPanel, wishlistPanel, accountPanel, orderHistoryPanel, accountSettingsPanel, mobileNavPanel].forEach(p => p && p.classList.remove('active'));
      document.getElementById('catSidebar').classList.remove('open');
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
    document.getElementById('orderHistoryCloseBtn').addEventListener('click', closeAllPanels);
    document.getElementById('accountSettingsCloseBtn').addEventListener('click', closeAllPanels);
    const savedItemsLink = document.getElementById('profileSavedItemsLink');
    if(savedItemsLink) savedItemsLink.addEventListener('click', (e) => { e.preventDefault(); closeAllPanels(); openPanel(wishlistPanel); });
    const orderHistoryLink = document.getElementById('profileOrderHistoryLink');
    if(orderHistoryLink) orderHistoryLink.addEventListener('click', (e) => {
      e.preventDefault(); closeAllPanels(); openPanel(orderHistoryPanel);
      if(window.renderOrderHistory) window.renderOrderHistory();
    });
    const accountSettingsLink = document.getElementById('profileAccountSettingsLink');
    if(accountSettingsLink) accountSettingsLink.addEventListener('click', (e) => {
      e.preventDefault(); closeAllPanels(); openPanel(accountSettingsPanel);
      if(window.renderAccountSettingsView) window.renderAccountSettingsView();
    });
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
      const remaining = Math.max(0, freeShipThreshold() - subtotal);
      cartFoot.innerHTML = `
        <div class="cart-progress"><i style="width:${Math.min(100,(subtotal/freeShipThreshold())*100)}%"></i></div>
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
      const bagBtn = e.target.closest('[data-add-to-bag]');
      if(bagBtn){
        e.preventDefault();
        const card = bagBtn.closest('.product-card');
        Cart.add(card.dataset.id, card.dataset.name, Number(card.dataset.price), card.dataset.img);
        bagBtn.textContent = 'Added ✓'; bagBtn.classList.add('added');
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
      if(e.target.closest('#cartCheckoutBtn')){
        e.preventDefault();
        alert('Full checkout (address, payment, Shiprocket) is coming in the next phase. Your bag is saved and will carry over.');
        return;
      }

      // Clicking anywhere on a product card (that isn't one of its buttons) opens its detail page.
      const card = e.target.closest('.product-card');
      if(card && !e.target.closest('button')){
        window.location.href = `/product.html?id=${encodeURIComponent(card.dataset.id)}`;
      }
    });

    await loadAndRender({ append: false });
  }

  window.addEventListener('popstate', () => loadAndRender({ append: false }));
  boot();
})();
