(function () {
  'use strict';

  let products = [];
  let categories = [];
  let sections = [];
  let orders = [];

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('Not authenticated');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function showMsg(elId, text, type) {
    const el = document.getElementById(elId);
    el.textContent = text;
    el.className = `msg show ${type}`;
    setTimeout(() => el.classList.remove('show'), 3500);
  }

  function openModal(id) { document.getElementById(id).classList.add('show'); }
  function closeModal(id) { document.getElementById(id).classList.remove('show'); }
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-veil').forEach(veil => {
    veil.addEventListener('click', (e) => { if (e.target === veil) veil.classList.remove('show'); });
  });

  // ---------- tabs ----------
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ---------- logout ----------
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  // ================= PRODUCTS =================
  const productRows = document.getElementById('productRows');
  const productForm = document.getElementById('productForm');
  const pfWear = document.getElementById('pf-wear');
  const pfType = document.getElementById('pf-type');
  const pfSections = document.getElementById('pf-sections');

  function typeLabelsFor(wearKey) {
    const cat = categories.find(c => c.key === wearKey);
    return cat ? cat.types : [];
  }

  function refreshWearOptions() {
    pfWear.innerHTML = categories.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    refreshTypeOptions();
  }
  function refreshTypeOptions() {
    const types = typeLabelsFor(pfWear.value);
    pfType.innerHTML = types.length
      ? types.map(t => `<option value="${t.key}">${t.label}</option>`).join('')
      : `<option value="">(no types)</option>`;
  }
  pfWear.addEventListener('change', refreshTypeOptions);

  function refreshSectionCheckboxes(selected = []) {
    pfSections.innerHTML = sections.map(s => `
      <label><input type="checkbox" value="${s.key}" ${selected.includes(s.key) ? 'checked' : ''}> ${s.title}</label>
    `).join('');
  }

  function categoryLabel(wearKey, typeKey) {
    const cat = categories.find(c => c.key === wearKey);
    const type = cat && cat.types.find(t => t.key === typeKey);
    return [cat ? cat.label : wearKey, type ? type.label : typeKey].filter(Boolean).join(' → ');
  }

  function renderProducts() {
    productRows.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.imgFront}" alt=""></td>
        <td>${p.name}</td>
        <td>${p.salePrice != null ? `<s style="color:#9a9a9a;">₹${Number(p.price).toLocaleString('en-IN')}</s> ₹${Number(p.salePrice).toLocaleString('en-IN')}` : `₹${Number(p.price).toLocaleString('en-IN')}`}</td>
        <td>${p.gender}</td>
        <td>${categoryLabel(p.wear, p.type)}</td>
        <td>${(p.sections || []).join(', ') || '—'}</td>
        <td>${p.isNew ? '✓' : ''}</td>
        <td>
          <div class="row-actions">
            <button class="btn small" data-edit="${p.id}">Edit</button>
            <button class="btn small danger" data-delete="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="8" style="color:#9a9a9a;">No products yet.</td></tr>`;
  }

  function openProductForm(product) {
    document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('pf-id').value = product ? product.id : '';
    document.getElementById('pf-name').value = product ? product.name : '';
    document.getElementById('pf-price').value = product ? product.price : '';
    document.getElementById('pf-imgFront').value = product ? product.imgFront : '';
    document.getElementById('pf-imgBack').value = product ? (product.imgBack || '') : '';
    document.getElementById('pf-sizes').value = product ? product.sizes : '';
    document.getElementById('pf-color').value = product ? (product.color || '') : '';
    document.getElementById('pf-brand').value = product ? (product.brand || '') : '';
    document.getElementById('pf-material').value = product ? (product.material || '') : '';
    document.getElementById('pf-salePrice').value = product && product.salePrice != null ? product.salePrice : '';
    document.getElementById('pf-rating').value = product && product.rating != null ? product.rating : '';
    document.getElementById('pf-isNew').checked = product ? !!product.isNew : false;
    document.getElementById('pf-gender').value = product ? product.gender : 'men';
    refreshWearOptions();
    if (product) pfWear.value = product.wear;
    refreshTypeOptions();
    if (product) pfType.value = product.type;
    refreshSectionCheckboxes(product ? product.sections : ['shop']);
    openModal('productModalVeil');
  }

  document.getElementById('newProductBtn').addEventListener('click', () => openProductForm(null));

  productRows.addEventListener('click', async (e) => {
    const editId = e.target.dataset.edit;
    const delId = e.target.dataset.delete;
    if (editId) {
      openProductForm(products.find(p => p.id === editId));
    }
    if (delId) {
      if (!confirm('Delete this product? This cannot be undone.')) return;
      try {
        await api(`/api/products/${delId}`, { method: 'DELETE' });
        await loadProducts();
        showMsg('productMsg', 'Product deleted.', 'ok');
      } catch (err) {
        showMsg('productMsg', err.message, 'err');
      }
    }
  });

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('pf-id').value;
    const body = {
      name: document.getElementById('pf-name').value,
      price: Number(document.getElementById('pf-price').value),
      imgFront: document.getElementById('pf-imgFront').value,
      imgBack: document.getElementById('pf-imgBack').value,
      sizes: document.getElementById('pf-sizes').value,
      color: document.getElementById('pf-color').value,
      brand: document.getElementById('pf-brand').value,
      material: document.getElementById('pf-material').value,
      salePrice: document.getElementById('pf-salePrice').value === '' ? null : Number(document.getElementById('pf-salePrice').value),
      rating: document.getElementById('pf-rating').value === '' ? undefined : Number(document.getElementById('pf-rating').value),
      gender: document.getElementById('pf-gender').value,
      wear: pfWear.value,
      type: pfType.value,
      isNew: document.getElementById('pf-isNew').checked,
      sections: Array.from(pfSections.querySelectorAll('input:checked')).map(i => i.value)
    };
    try {
      if (id) {
        await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/products', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal('productModalVeil');
      await loadProducts();
      showMsg('productMsg', 'Product saved.', 'ok');
    } catch (err) {
      showMsg('productMsg', err.message, 'err');
    }
  });

  async function loadProducts() {
    products = await api('/api/products');
    renderProducts();
  }

  // ================= CATEGORIES =================
  const categoryList = document.getElementById('categoryList');

  function renderCategories() {
    categoryList.innerHTML = categories.map(c => `
      <div class="category-card">
        <div class="category-card-head">
          <h4>${c.label}${c.unisex ? ' <span style="font-family:\'Space Mono\',monospace;font-size:10px;color:#9a9a9a;">unisex</span>' : ''}</h4>
          <button class="btn small danger" data-del-cat="${c.key}">Delete category</button>
        </div>
        <div class="type-pill-row">
          ${c.types.map(t => `
            <div class="type-pill">
              ${t.label}
              <button data-del-type="${c.key}|${t.key}" title="Remove type">✕</button>
            </div>
          `).join('')}
          <button class="add-type-btn" data-add-type="${c.key}">+ Add type</button>
        </div>
      </div>
    `).join('') || '<p class="hint">No categories yet.</p>';
  }

  document.getElementById('newCategoryBtn').addEventListener('click', () => {
    document.getElementById('categoryForm').reset();
    openModal('categoryModalVeil');
  });

  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          label: document.getElementById('cf-label').value,
          unisex: document.getElementById('cf-unisex').checked
        })
      });
      closeModal('categoryModalVeil');
      await loadCategories();
      showMsg('categoryMsg', 'Category added.', 'ok');
    } catch (err) {
      showMsg('categoryMsg', err.message, 'err');
    }
  });

  categoryList.addEventListener('click', async (e) => {
    const delCat = e.target.dataset.delCat;
    const delType = e.target.dataset.delType;
    const addType = e.target.dataset.addType;

    if (delCat) {
      if (!confirm('Delete this whole category and its types? Existing products keep their old category value until you edit them.')) return;
      try {
        await api(`/api/categories/${delCat}`, { method: 'DELETE' });
        await loadCategories();
        showMsg('categoryMsg', 'Category deleted.', 'ok');
      } catch (err) { showMsg('categoryMsg', err.message, 'err'); }
    }

    if (delType) {
      const [catKey, typeKey] = delType.split('|');
      try {
        await api(`/api/categories/${catKey}/types/${typeKey}`, { method: 'DELETE' });
        await loadCategories();
        showMsg('categoryMsg', 'Type removed.', 'ok');
      } catch (err) { showMsg('categoryMsg', err.message, 'err'); }
    }

    if (addType) {
      document.getElementById('tf-categoryKey').value = addType;
      document.getElementById('typeModalTitle').textContent = `Add Type — ${categories.find(c => c.key === addType).label}`;
      document.getElementById('typeForm').reset();
      openModal('typeModalVeil');
    }
  });

  document.getElementById('typeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const catKey = document.getElementById('tf-categoryKey').value;
    try {
      await api(`/api/categories/${catKey}/types`, {
        method: 'POST',
        body: JSON.stringify({ label: document.getElementById('tf-label').value })
      });
      closeModal('typeModalVeil');
      await loadCategories();
      showMsg('categoryMsg', 'Type added.', 'ok');
    } catch (err) {
      showMsg('categoryMsg', err.message, 'err');
    }
  });

  async function loadCategories() {
    categories = await api('/api/categories');
    renderCategories();
    refreshWearOptions();
  }

  // ================= SECTIONS =================
  const sectionRows = document.getElementById('sectionRows');
  const DEFAULT_SECTIONS = ['shop', 'new', 'bestsellers'];

  function renderSections() {
    sectionRows.innerHTML = sections.map(s => `
      <tr>
        <td>${s.title}</td>
        <td>${s.layout}</td>
        <td>${s.order}</td>
        <td>
          <div class="row-actions">
            ${DEFAULT_SECTIONS.includes(s.key)
              ? '<span class="hint" style="margin:0;">default</span>'
              : `<button class="btn small danger" data-del-section="${s.key}">Delete</button>`}
          </div>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="4" style="color:#9a9a9a;">No sections yet.</td></tr>`;
  }

  document.getElementById('newSectionBtn').addEventListener('click', () => {
    document.getElementById('sectionForm').reset();
    openModal('sectionModalVeil');
  });

  document.getElementById('sectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/sections', {
        method: 'POST',
        body: JSON.stringify({
          title: document.getElementById('sf-title').value,
          layout: document.getElementById('sf-layout').value
        })
      });
      closeModal('sectionModalVeil');
      await loadSections();
      showMsg('sectionMsg', 'Section added — assign products to it from the Products tab.', 'ok');
    } catch (err) {
      showMsg('sectionMsg', err.message, 'err');
    }
  });

  sectionRows.addEventListener('click', async (e) => {
    const key = e.target.dataset.delSection;
    if (!key) return;
    if (!confirm('Delete this homepage section?')) return;
    try {
      await api(`/api/sections/${key}`, { method: 'DELETE' });
      await loadSections();
      showMsg('sectionMsg', 'Section deleted.', 'ok');
    } catch (err) { showMsg('sectionMsg', err.message, 'err'); }
  });

  async function loadSections() {
    sections = await api('/api/sections');
    sections.sort((a, b) => a.order - b.order);
    renderSections();
  }

  // ================= ORDERS =================
  const upcomingOrderRows = document.getElementById('upcomingOrderRows');
  const historyOrderRows = document.getElementById('historyOrderRows');
  const upcomingCount = document.getElementById('upcomingCount');
  const historyCount = document.getElementById('historyCount');

  const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'in_transit', 'delivered', 'cancelled'];
  const UPCOMING_STATUSES = ['pending', 'processing', 'shipped', 'in_transit'];
  const STATUS_LABELS = {
    pending: 'Pending', processing: 'Processing', shipped: 'Shipped',
    in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled'
  };

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function orderRowHtml(o) {
    const itemsHtml = (o.items || []).map(i => `<div>${i.qty}× ${i.name}</div>`).join('') || '—';
    const total = Number(o.subtotal || 0).toLocaleString('en-IN');
    const c = o.customer || {};
    return `
      <tr>
        <td>${o.id}</td>
        <td class="order-customer">
          <strong>${c.name || '—'}</strong>
          <span>${c.phone || ''}</span>
          <span>${c.email || ''}</span>
          <span>${[c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ')}</span>
        </td>
        <td class="order-items-list">${itemsHtml}</td>
        <td>₹${total}</td>
        <td>${o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GoKwik'}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td>
          <select class="status-select" data-order-id="${o.id}">
            ${ORDER_STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </td>
      </tr>
    `;
  }

  function renderOrders() {
    const sorted = orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const upcoming = sorted.filter(o => UPCOMING_STATUSES.includes(o.status));
    const history = sorted.filter(o => !UPCOMING_STATUSES.includes(o.status));

    upcomingCount.textContent = upcoming.length;
    historyCount.textContent = history.length;

    upcomingOrderRows.innerHTML = upcoming.map(orderRowHtml).join('')
      || `<tr><td colspan="7" class="order-empty">No upcoming orders right now.</td></tr>`;
    historyOrderRows.innerHTML = history.map(orderRowHtml).join('')
      || `<tr><td colspan="7" class="order-empty">No completed or cancelled orders yet.</td></tr>`;
  }

  async function updateOrderStatus(id, status, selectEl) {
    const prevValue = selectEl.dataset.prevValue || status;
    try {
      const updated = await api(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1) orders[idx] = updated;
      renderOrders();
      showMsg('orderMsg', `Order ${id} marked as ${STATUS_LABELS[status]}.`, 'ok');
    } catch (err) {
      selectEl.value = prevValue;
      showMsg('orderMsg', err.message, 'err');
    }
  }

  [upcomingOrderRows, historyOrderRows].forEach(tbody => {
    tbody.addEventListener('focusin', (e) => {
      if (e.target.classList.contains('status-select')) e.target.dataset.prevValue = e.target.value;
    });
    tbody.addEventListener('change', (e) => {
      const select = e.target.closest('.status-select');
      if (!select) return;
      updateOrderStatus(select.dataset.orderId, select.value, select);
    });
  });

  document.getElementById('refreshOrdersBtn').addEventListener('click', async () => {
    try {
      await loadOrders();
      showMsg('orderMsg', 'Orders refreshed.', 'ok');
    } catch (err) {
      showMsg('orderMsg', err.message, 'err');
    }
  });

  async function loadOrders() {
    orders = await api('/api/orders');
    renderOrders();
  }

  // ---------- boot ----------
  (async function init() {
    try {
      await loadCategories();
      await loadSections();
      await loadProducts();
      await loadOrders();
    } catch (err) {
      console.error(err);
    }
  })();
})();
