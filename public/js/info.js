(function () {
  'use strict';

  /* ===================== SHARED CHROME (search, panels, cart, wishlist) ===================== */
  setupHeaderSearch();

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

  function openPanel(panel) { veil.classList.add('active'); panel.classList.add('active'); document.body.style.overflow = 'hidden'; }
  function closeAllPanels() {
    veil.classList.remove('active');
    [cartPanel, wishlistPanel, accountPanel, mobileNavPanel].forEach(p => p && p.classList.remove('active'));
    const burger = document.getElementById('burgerBtn');
    if (burger) { burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  }
  veil.addEventListener('click', closeAllPanels);
  document.getElementById('cartOpenBtn').addEventListener('click', () => openPanel(cartPanel));
  document.getElementById('cartCloseBtn').addEventListener('click', closeAllPanels);
  document.getElementById('wishlistOpenBtn').addEventListener('click', () => openPanel(wishlistPanel));
  document.getElementById('wishlistCloseBtn').addEventListener('click', closeAllPanels);
  document.getElementById('accountOpenBtn').addEventListener('click', () => openPanel(accountPanel));
  document.getElementById('accountCloseBtn').addEventListener('click', closeAllPanels);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllPanels(); });

  const burger = document.getElementById('burgerBtn');
  burger.addEventListener('click', () => mobileNavPanel.classList.contains('active') ? closeAllPanels() : (openPanel(mobileNavPanel), burger.classList.add('open')));
  document.getElementById('mobileNavCloseBtn').addEventListener('click', closeAllPanels);
  const mobileAccountBtn = document.getElementById('mobileAccountBtn');
  if (mobileAccountBtn) mobileAccountBtn.addEventListener('click', () => { closeAllPanels(); openPanel(accountPanel); });
  const mobileBagBtn = document.getElementById('mobileBagBtn');
  if (mobileBagBtn) mobileBagBtn.addEventListener('click', () => { closeAllPanels(); openPanel(cartPanel); });

  function renderCart() {
    const items = Cart.getItems();
    bagCount.textContent = Cart.count();
    bagCount.classList.toggle('show', Cart.count() > 0);
    if (items.length === 0) {
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
      <div class="cart-progress"><i style="width:${Math.min(100, (subtotal / FREE_SHIP_THRESHOLD) * 100)}%"></i></div>
      <div class="cart-shipping-note">${remaining > 0 ? `Add <b>${fmtRupee(remaining)}</b> more for free shipping.` : `<b>Free shipping unlocked ✓</b>`}</div>
      <div class="cart-subtotal-row"><span>Subtotal</span><span>${fmtRupee(subtotal)}</span></div>
      <a class="cart-checkout" href="/category.html">Continue Shopping →</a>`;
  }
  function renderWishlist() {
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
    if (!btn) return;
    if (btn.dataset.action === 'inc') Cart.changeQty(btn.dataset.id, 1);
    if (btn.dataset.action === 'dec') Cart.changeQty(btn.dataset.id, -1);
    if (btn.dataset.action === 'remove') Cart.remove(btn.dataset.id);
  });
  wishlistBody.addEventListener('click', (e) => {
    const moveId = e.target.closest('[data-wishlist-move]')?.dataset.wishlistMove;
    const removeId = e.target.closest('[data-wishlist-remove]')?.dataset.wishlistRemove;
    if (moveId) { const item = Wishlist.getItems().find(i => i.id === moveId); if (item) Cart.add(item.id, item.name, item.price, item.img); Wishlist.remove(moveId); }
    if (removeId) Wishlist.remove(removeId);
  });

  /* ===================== PAGE CONTENT ===================== */
  const PAGES = {
    about: {
      title: 'About Us',
      eyebrow: 'Our Story',
      heroSub: 'A small, independent studio designing considered essentials — cut for movement, built to outlast the season.',
      body: `
        <h2>Where We Started</h2>
        <p>STUDIO began as a two-person operation working out of a shared studio space, frustrated with how much clothing was designed to be replaced rather than repaired. We set out to build a wardrobe of fewer, better pieces — garments you'd actually want to keep wearing five years on.</p>
        <p>Every collection is designed in-house and cut and sewn by small production partners we've worked with for years, not switched season to season for a cheaper quote.</p>
        <h2>What We Believe</h2>
        <div class="info-grid">
          <div class="info-grid-card"><b>Fewer, Better</b><span>Small batches over constant drops. We'd rather make less and make it properly.</span></div>
          <div class="info-grid-card"><b>Built to Repair</b><span>Reinforced seams, replaceable hardware, and a repair service instead of a bin.</span></div>
          <div class="info-grid-card"><b>Direct Relationships</b><span>We work directly with mills and makers we trust, not anonymous supply chains.</span></div>
        </div>
        <h2>Today</h2>
        <p>We now design four collections a year, still in-house, still cut and sewn by the same partners we started with. Thanks for being here.</p>
      `
    },
    journal: {
      title: 'Journal',
      eyebrow: 'Notes From the Studio',
      heroSub: 'Behind-the-scenes notes on fabrics, fit, and the process — from the people who make the clothes.',
      body: `
        <h2>Inside Collection 01: The Quiet Standard</h2>
        <p>Every piece in this collection started with a single question: what does someone actually reach for on a Tuesday? We tested fits on real bodies across three rounds of samples before locking a single pattern.</p>
        <h2>A Closer Look at Our Core Fabrics</h2>
        <p>We work with a small rotation of mills for our core cotton and wool blends, prioritizing weight and hand-feel over trend fabrics that fall apart after a few washes.</p>
        <h2>Care Notes: Making Your Pieces Last</h2>
        <p>Cold wash, line dry when you can, and bring loose buttons or small seam repairs to us rather than replacing the piece — most repairs take under a week.</p>
      `
    },
    sustainability: {
      title: 'Sustainability',
      eyebrow: 'Made With Intent',
      heroSub: 'We\'re early in this work and don\'t claim to have it all figured out — here\'s where we actually stand today.',
      body: `
        <h2>Small Batches, On Purpose</h2>
        <p>We produce in small runs based on realistic demand rather than pushing volume, which means less excess inventory and fewer markdowns ending up in landfill.</p>
        <h2>Materials</h2>
        <p>The majority of our core fabrics are natural fibers — cotton, wool, and linen — chosen for durability and biodegradability over synthetic blends where a natural alternative performs as well.</p>
        <h2>Repair, Not Replace</h2>
        <p>Our repair service exists specifically to keep garments in use longer. If something rips or a button falls off, bring it back to us before you consider replacing it.</p>
        <h2>Where We're Still Working</h2>
        <p>We don't yet have full supply-chain traceability published, and packaging still includes some plastic poly bags for transit protection. Both are active projects for this year.</p>
      `
    },
    careers: {
      title: 'Careers',
      eyebrow: 'Join the Studio',
      heroSub: 'We\'re a small team and hire slowly — but we\'re always glad to hear from people who care about the craft.',
      body: `
        <h2>Open Roles</h2>
        <div class="info-role-list">
          <div class="info-role">
            <div><b>Pattern Cutter</b><span>Full-time · On-site</span></div>
            <a href="/info.html?p=contact">Apply →</a>
          </div>
          <div class="info-role">
            <div><b>Customer Care Associate</b><span>Part-time · Remote</span></div>
            <a href="/info.html?p=contact">Apply →</a>
          </div>
          <div class="info-role">
            <div><b>Photography &amp; Content Intern</b><span>Internship · On-site</span></div>
            <a href="/info.html?p=contact">Apply →</a>
          </div>
        </div>
        <h2>Don't See a Fit?</h2>
        <p>We still want to hear from you. Send a short note and your portfolio or résumé through our <a href="/info.html?p=contact" style="text-decoration:underline;">contact page</a> and we'll keep it on file for the next opening.</p>
      `
    },
    'shipping-returns': {
      title: 'Shipping & Returns',
      eyebrow: 'Support',
      heroSub: 'Everything you need to know about getting your order, and sending it back if it isn\'t right.',
      body: `
        <h2>Shipping</h2>
        <table class="info-table">
          <thead><tr><th>Method</th><th>Estimated Delivery</th><th>Cost</th></tr></thead>
          <tbody>
            <tr><td>Standard</td><td>3–6 business days</td><td>₹99 (Free over ₹1,999)</td></tr>
            <tr><td>Express</td><td>1–2 business days</td><td>₹249</td></tr>
          </tbody>
        </table>
        <p>Orders are packed and dispatched within 24 hours on business days. You'll get a tracking link by email and SMS as soon as your order ships.</p>
        <h2>Returns &amp; Exchanges</h2>
        <p>Unworn items with tags attached can be returned within 14 days of delivery for a full refund, or exchanged for a different size at no extra cost. Footwear must be tried on indoors on a clean surface to remain eligible.</p>
        <h2>How to Start a Return</h2>
        <p>Reach out through our <a href="/info.html?p=contact" style="text-decoration:underline;">contact page</a> with your order number and we'll arrange a pickup or send a prepaid return label, depending on your location.</p>
      `
    },
    'size-guide': {
      title: 'Size Guide',
      eyebrow: 'Support',
      heroSub: 'Measurements are in centimeters. If you\'re between sizes, we generally recommend sizing up for a relaxed fit.',
      body: `
        <h2>Tops &amp; Outerwear</h2>
        <table class="info-table">
          <thead><tr><th>Size</th><th>Chest</th><th>Waist</th><th>Length</th></tr></thead>
          <tbody>
            <tr><td>XS</td><td>86–91</td><td>71–76</td><td>66</td></tr>
            <tr><td>S</td><td>92–97</td><td>77–82</td><td>68</td></tr>
            <tr><td>M</td><td>98–103</td><td>83–88</td><td>70</td></tr>
            <tr><td>L</td><td>104–110</td><td>89–95</td><td>72</td></tr>
            <tr><td>XL</td><td>111–118</td><td>96–103</td><td>74</td></tr>
          </tbody>
        </table>
        <h2>Bottoms</h2>
        <table class="info-table">
          <thead><tr><th>Size</th><th>Waist</th><th>Hip</th><th>Inseam</th></tr></thead>
          <tbody>
            <tr><td>28</td><td>71–74</td><td>89–92</td><td>76</td></tr>
            <tr><td>30</td><td>76–79</td><td>94–97</td><td>77</td></tr>
            <tr><td>32</td><td>81–84</td><td>99–102</td><td>78</td></tr>
            <tr><td>34</td><td>86–89</td><td>104–107</td><td>79</td></tr>
            <tr><td>36</td><td>91–94</td><td>109–112</td><td>80</td></tr>
          </tbody>
        </table>
        <h2>How to Measure</h2>
        <p>Chest: measure around the fullest part of your chest, keeping the tape level. Waist: measure around your natural waistline, just above the belly button. Hip: measure around the fullest part of your hips.</p>
      `
    },
    faq: {
      title: 'FAQ',
      eyebrow: 'Support',
      heroSub: 'Quick answers to the questions we hear most. Still stuck? Our contact page reaches a real person.',
      faq: [
        ['How long will my order take to arrive?', 'Standard delivery is 3–6 business days after dispatch; express is 1–2 business days. You\'ll receive tracking details by email as soon as your order ships.'],
        ['What\'s your return policy?', 'Unworn items with tags attached can be returned within 14 days of delivery for a refund, or exchanged for a different size. See our Shipping & Returns page for the full details.'],
        ['Do you ship internationally?', 'Right now we ship within India only. International shipping is on our roadmap — sign up to our newsletter to hear when it launches.'],
        ['How do I know what size to order?', 'Check our Size Guide for a full measurement chart. If you\'re between two sizes, we generally recommend sizing up for a more relaxed fit.'],
        ['Can I change or cancel my order after placing it?', 'If your order hasn\'t shipped yet, contact us as soon as possible and we\'ll do our best to adjust it. Once it\'s marked "shipped" we\'re no longer able to make changes.'],
        ['How do I create an account?', 'Tap the account icon in the header, choose "Create Account," and sign up with your email and a password — or use "Continue with Google" for one-tap sign-in.'],
        ['Do you offer repairs?', 'Yes — bring any of our pieces back to us for small repairs (loose buttons, seam repairs) rather than replacing them. Reach out through our Contact page to arrange it.']
      ]
    },
    contact: {
      title: 'Contact',
      eyebrow: 'Get in Touch',
      heroSub: 'Questions about an order, a return, sizing, or anything else — we read every message ourselves.',
      contact: true
    }
  };

  function faqHtml(items) {
    return `<div class="info-faq">${items.map(([q, a], i) => `
      <div class="info-faq-item${i === 0 ? ' open' : ''}">
        <button type="button">
          ${escapeHtml(q)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="info-faq-body">${escapeHtml(a)}</div>
      </div>`).join('')}</div>`;
  }

  function contactHtml() {
    return `
      <div class="info-contact-grid">
        <div class="info-contact-details">
          <h2>Reach Us Directly</h2>
          <p>We aim to reply within one business day.</p>
          <div class="field-label">Email</div>
          <p>hello@studio-clothing.example</p>
          <div class="field-label">Phone</div>
          <p>+91 98765 43210 (Mon–Sat, 10am–6pm IST)</p>
          <div class="field-label">Studio</div>
          <p>STUDIO Design House, 4th Floor, Lower Parel, Mumbai, Maharashtra 400013</p>
        </div>
        <form class="info-contact-form" id="contactForm">
          <div class="field">
            <label>Name</label>
            <input type="text" id="contactName" placeholder="Your name" required>
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" id="contactEmail" placeholder="you@email.com" required>
          </div>
          <div class="field">
            <label>Order number (optional)</label>
            <input type="text" id="contactOrder" placeholder="e.g. ord12">
          </div>
          <div class="field">
            <label>Message</label>
            <textarea id="contactMessage" placeholder="How can we help?" required></textarea>
          </div>
          <button class="account-submit" type="submit">Send Message →</button>
          <div class="info-contact-toast" id="contactToast"></div>
        </form>
      </div>
    `;
  }

  function render() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('p') || 'about';
    const page = PAGES[slug] || PAGES.about;
    const mount = document.getElementById('infoContent');

    document.title = `${page.title} — STUDIO`;
    document.getElementById('pageTitle').textContent = `${page.title} — STUDIO`;

    let bodyHtml;
    if (page.faq) bodyHtml = faqHtml(page.faq);
    else if (page.contact) bodyHtml = contactHtml();
    else bodyHtml = page.body;

    mount.innerHTML = `
      <section class="info-hero">
        <span class="eyebrow">${escapeHtml(page.eyebrow)}</span>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.heroSub)}</p>
      </section>
      <section class="info-body">${bodyHtml}</section>
    `;

    if (page.faq) {
      mount.querySelectorAll('.info-faq-item button').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.info-faq-item').classList.toggle('open'));
      });
    }

    if (page.contact) {
      const form = document.getElementById('contactForm');
      const toast = document.getElementById('contactToast');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        toast.textContent = 'Thanks — your message is in. We\'ll reply within one business day ✓';
        toast.classList.add('show');
        form.reset();
      });
    }
  }

  render();
  window.addEventListener('popstate', render);
})();
