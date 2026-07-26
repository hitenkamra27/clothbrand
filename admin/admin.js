(function () {
  'use strict';

  let products = [];
  let categories = [];
  let sections = [];
  let orders = [];
  let settings = {};

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
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
      if (btn.dataset.tab === 'overview') renderOverview();
      if (btn.dataset.tab === 'settings') renderSettingsForm();
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

  // ---------- products: column sorting ----------
  let productSort = { key: 'name', dir: 'asc' };

  function sortValue(p, key) {
    switch (key) {
      case 'name': return String(p.name || '').toLowerCase();
      case 'price': return p.salePrice != null ? Number(p.salePrice) : Number(p.price) || 0;
      case 'gender': return String(p.gender || '').toLowerCase();
      case 'category': return categoryLabel(p.wear, p.type).toLowerCase();
      case 'isNew': return p.isNew ? 1 : 0;
      default: return '';
    }
  }

  function sortedProducts() {
    const { key, dir } = productSort;
    const mult = dir === 'desc' ? -1 : 1;
    return products.slice().sort((a, b) => {
      const va = sortValue(a, key), vb = sortValue(b, key);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }

  function updateSortHeaders() {
    document.querySelectorAll('#panel-products th.sortable').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (th.dataset.sort === productSort.key) {
        th.classList.add('sorted');
        arrow.textContent = productSort.dir === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('sorted');
        arrow.textContent = '';
      }
    });
  }

  document.querySelectorAll('#panel-products th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (productSort.key === key) {
        productSort.dir = productSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        productSort = { key, dir: 'asc' };
      }
      renderProducts();
    });
  });

  function renderProducts() {
    updateSortHeaders();
    const list = sortedProducts();
    productRows.innerHTML = list.map(p => `
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
    updateImagePreview('pf-imgFront', 'pf-imgFrontPreview');
    updateImagePreview('pf-imgBack', 'pf-imgBackPreview');
    document.getElementById('pf-imgFrontStatus').textContent = '';
    document.getElementById('pf-imgBackStatus').textContent = '';
    setGalleryUrls(product ? (product.images || []) : []);
    document.getElementById('pf-sizes').value = product ? product.sizes : '';
    document.getElementById('pf-color').value = product ? (product.color || '') : '';
    document.getElementById('pf-brand').value = product ? (product.brand || '') : '';
    document.getElementById('pf-material').value = product ? (product.material || '') : '';
    document.getElementById('pf-description').value = product ? (product.description || '') : '';
    document.getElementById('pf-sku').value = product ? (product.sku || '') : '';
    document.getElementById('pf-stock').value = product && product.stock != null ? product.stock : '';
    document.getElementById('pf-tags').value = product && product.tags ? product.tags.join(', ') : '';
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
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-delete]')?.dataset.delete;
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
    const imgFront = document.getElementById('pf-imgFront').value;
    if (!imgFront) {
      showMsg('productMsg', 'Front image is required — upload one before saving.', 'err');
      return;
    }
    const id = document.getElementById('pf-id').value;
    const stockVal = document.getElementById('pf-stock').value;
    const body = {
      name: document.getElementById('pf-name').value,
      price: Number(document.getElementById('pf-price').value),
      imgFront,
      imgBack: document.getElementById('pf-imgBack').value,
      images: getGalleryUrls(),
      sizes: document.getElementById('pf-sizes').value,
      color: document.getElementById('pf-color').value,
      brand: document.getElementById('pf-brand').value,
      material: document.getElementById('pf-material').value,
      description: document.getElementById('pf-description').value,
      sku: document.getElementById('pf-sku').value,
      stock: stockVal === '' ? null : Number(stockVal),
      tags: document.getElementById('pf-tags').value,
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
    const delCat = e.target.closest('[data-del-cat]')?.dataset.delCat;
    const delType = e.target.closest('[data-del-type]')?.dataset.delType;
    const addType = e.target.closest('[data-add-type]')?.dataset.addType;

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
    const key = e.target.closest('[data-del-section]')?.dataset.delSection;
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
        <td>${o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Shiprocket'}</td>
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

  // ================= IMAGE UPLOAD (product front/back images) =================
  function updateImagePreview(urlInputId, previewImgId) {
    const url = document.getElementById(urlInputId).value.trim();
    const preview = document.getElementById(previewImgId);
    if (url) { preview.src = url; preview.hidden = false; } else { preview.hidden = true; preview.src = ''; }
  }

  function wireImageUpload(fileInputId, urlInputId, previewImgId, statusId) {
    const fileInput = document.getElementById(fileInputId);
    const statusEl = document.getElementById(statusId);

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      statusEl.textContent = 'Uploading…';
      statusEl.className = 'upload-status';

      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: formData });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
        if (!res.ok) throw new Error(data.error || 'Upload failed.');

        document.getElementById(urlInputId).value = data.url;
        updateImagePreview(urlInputId, previewImgId);
        statusEl.textContent = 'Uploaded ✓';
        statusEl.className = 'upload-status ok';
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = 'upload-status err';
      } finally {
        fileInput.value = '';
      }
    });
  }

  wireImageUpload('pf-imgFrontFile', 'pf-imgFront', 'pf-imgFrontPreview', 'pf-imgFrontStatus');
  wireImageUpload('pf-imgBackFile', 'pf-imgBack', 'pf-imgBackPreview', 'pf-imgBackStatus');
  wireImageUpload('st-logoUrlFile', 'st-logoUrl', 'st-logoUrlPreview', 'st-logoUrlStatus');

  // ================= ADDITIONAL IMAGES (upload-only thumbnail gallery) =================
  // No manual URL entry — every image here came from an actual upload. Backed
  // by a plain array instead of scraping input rows out of the DOM.
  let galleryUrls = [];
  const imagesList = document.getElementById('pf-imagesList');

  function renderGalleryThumbs() {
    imagesList.innerHTML = galleryUrls.map((url, i) => `
      <div class="image-thumb">
        <img src="${url}" alt="">
        <button type="button" class="remove-image-btn" data-remove-idx="${i}" aria-label="Remove image">✕</button>
      </div>
    `).join('');
  }

  function setGalleryUrls(urls) {
    galleryUrls = (urls || []).slice();
    renderGalleryThumbs();
  }

  function getGalleryUrls() {
    return galleryUrls.slice();
  }

  imagesList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-idx]');
    if (!btn) return;
    galleryUrls.splice(Number(btn.dataset.removeIdx), 1);
    renderGalleryThumbs();
  });

  // ================= MULTIPLE IMAGE UPLOAD (adds straight to the gallery) =================
  const multiUploadFile = document.getElementById('pf-multiUploadFile');
  const multiUploadStatus = document.getElementById('pf-multiUploadStatus');

  multiUploadFile.addEventListener('change', async () => {
    const files = Array.from(multiUploadFile.files || []);
    if (!files.length) return;

    multiUploadStatus.textContent = `Uploading ${files.length} image${files.length > 1 ? 's' : ''}…`;
    multiUploadStatus.className = 'upload-status';

    const formData = new FormData();
    files.forEach(f => formData.append('images', f));

    try {
      const res = await fetch('/api/upload/multiple', { method: 'POST', credentials: 'same-origin', body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.href = '/admin/login.html'; return; }
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      galleryUrls.push(...(data.urls || []));
      renderGalleryThumbs();
      multiUploadStatus.textContent = `${data.urls.length} image${data.urls.length > 1 ? 's' : ''} added ✓`;
      multiUploadStatus.className = 'upload-status ok';
    } catch (err) {
      multiUploadStatus.textContent = err.message;
      multiUploadStatus.className = 'upload-status err';
    } finally {
      multiUploadFile.value = '';
    }
  });

  // ================= OVERVIEW =================
  function currentMonthRevenue() {
    const now = new Date();
    return orders
      .filter(o => {
        const d = new Date(o.createdAt);
        return o.status !== 'cancelled' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0);
  }

  function renderOverview() {
    const grid = document.getElementById('statGrid');
    if (!grid) return;

    const needsAttention = orders.filter(o => ['pending', 'processing'].includes(o.status));
    const totalTypes = categories.reduce((sum, c) => sum + (c.types || []).length, 0);

    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Products</div>
        <div class="stat-value">${products.length}</div>
        <div class="stat-sub">${categories.length} categories · ${totalTypes} types</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Orders</div>
        <div class="stat-value">${orders.length}</div>
        <div class="stat-sub">${sections.length} homepage section${sections.length === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card ${needsAttention.length ? 'warn' : ''}">
        <div class="stat-label">Needs Action</div>
        <div class="stat-value">${needsAttention.length}</div>
        <div class="stat-sub">Pending + processing orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Revenue This Month</div>
        <div class="stat-value">₹${currentMonthRevenue().toLocaleString('en-IN')}</div>
        <div class="stat-sub">Excludes cancelled orders</div>
      </div>
    `;

    const upcomingMount = document.getElementById('overviewUpcoming');
    if (upcomingMount) {
      const rows = needsAttention
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6);
      upcomingMount.innerHTML = rows.length
        ? rows.map(o => `
            <div class="overview-row">
              <div class="overview-row-main">
                <span class="overview-row-title">${o.id} — ${(o.customer && o.customer.name) || 'Customer'}</span>
              </div>
              <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
            </div>
          `).join('')
        : '<div class="overview-empty">Nothing needs action right now.</div>';
    }

    const recentMount = document.getElementById('overviewRecentProducts');
    if (recentMount) {
      // Products are stored ordered by when each row last changed, so the
      // tail of the array is whatever was most recently added or edited.
      const recent = products.slice(-6).reverse();
      recentMount.innerHTML = recent.length
        ? recent.map(p => `
            <div class="overview-row">
              <div class="overview-row-main">
                <img src="${p.imgFront}" alt="">
                <span class="overview-row-title">${p.name}</span>
              </div>
              <span>₹${Number(p.salePrice != null ? p.salePrice : p.price).toLocaleString('en-IN')}</span>
            </div>
          `).join('')
        : '<div class="overview-empty">No products yet.</div>';
    }
  }

  // ================= SETTINGS =================
  async function loadSettings() {
    settings = await api('/api/settings');
  }

  function renderSettingsForm() {
    document.getElementById('st-storeName').value = settings.storeName || '';
    document.getElementById('st-logoUrl').value = settings.logoUrl || '';
    updateImagePreview('st-logoUrl', 'st-logoUrlPreview');
    document.getElementById('st-tagline').value = settings.tagline || '';
    document.getElementById('st-announcements').value = (settings.announcements || []).join('\n');
    document.getElementById('st-contactEmail').value = settings.contactEmail || '';
    document.getElementById('st-contactPhone').value = settings.contactPhone || '';
    document.getElementById('st-instagramUrl').value = settings.instagramUrl || '';
    document.getElementById('st-tiktokUrl').value = settings.tiktokUrl || '';
    document.getElementById('st-pinterestUrl').value = settings.pinterestUrl || '';
    document.getElementById('st-freeShippingThreshold').value = settings.freeShippingThreshold != null ? settings.freeShippingThreshold : '';

    const cfg = window.__adminConfig || {};
    const rows = [
      { label: 'Shiprocket Shipping', on: !!cfg.shiprocketShipping },
      { label: 'Shiprocket Checkout / Payments', on: !!(cfg.shiprocket && cfg.shiprocket.enabled) },
      { label: 'Google Sign-In', on: !!(cfg.google && cfg.google.clientId) }
    ];
    document.getElementById('integrationStatusList').innerHTML = rows.map(r => `
      <div class="integration-row">
        <span>${r.label}</span>
        <span class="integration-pill ${r.on ? 'on' : 'off'}">${r.on ? 'Connected' : 'Not set up'}</span>
      </div>
    `).join('');
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const body = {
      storeName: document.getElementById('st-storeName').value,
      logoUrl: document.getElementById('st-logoUrl').value,
      tagline: document.getElementById('st-tagline').value,
      announcements: document.getElementById('st-announcements').value.split('\n'),
      contactEmail: document.getElementById('st-contactEmail').value,
      contactPhone: document.getElementById('st-contactPhone').value,
      instagramUrl: document.getElementById('st-instagramUrl').value,
      tiktokUrl: document.getElementById('st-tiktokUrl').value,
      pinterestUrl: document.getElementById('st-pinterestUrl').value,
      freeShippingThreshold: document.getElementById('st-freeShippingThreshold').value
    };
    try {
      settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
      renderSettingsForm();
      showMsg('settingsMsg', 'Settings saved — the live site updates immediately.', 'ok');
    } catch (err) {
      showMsg('settingsMsg', err.message, 'err');
    }
  });

  // ---------- boot ----------
  (async function init() {
    try {
      window.__adminConfig = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
      await loadCategories();
      await loadSections();
      await loadProducts();
      await loadOrders();
      await loadSettings();
      renderOverview();
    } catch (err) {
      console.error(err);
    }
  })();
})();
