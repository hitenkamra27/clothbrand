/* ===================== Hive & Ash — Customer Account (shared across pages) =====================
   Handles Sign In, Create Account, Google Sign-In, session persistence and Sign Out.
   Talks to the real backend at /api/customers/* — nothing here is a mock/demo.
============================================================================================ */
(function () {
  'use strict';

  const accountTabs = document.querySelectorAll('.account-tab');
  const accountForms = document.querySelectorAll('.account-form');
  const accountToast = document.getElementById('accountToast');
  const accountLoggedOut = document.getElementById('accountLoggedOut');
  const accountLoggedIn = document.getElementById('accountLoggedIn');

  // Some pages may not include the account panel at all; bail out safely if so.
  if (!accountLoggedOut || !accountLoggedIn) return;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  function showToast(text, type) {
    if (!accountToast) return;
    accountToast.textContent = text;
    accountToast.className = `account-toast show ${type || ''}`.trim();
  }

  function setBusy(form, busy) {
    const btn = form.querySelector('.account-submit');
    if (!btn) return;
    btn.disabled = busy;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.textContent = busy ? 'Please wait…' : btn.dataset.label;
  }

  /* ----------------------------- tabs ----------------------------- */
  accountTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      accountTabs.forEach(t => t.classList.remove('active'));
      accountForms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.account-form[data-form="${tab.dataset.tab}"]`).classList.add('active');
      if (accountToast) accountToast.classList.remove('show');
    });
  });

  /* ----------------------------- signed-in view ----------------------------- */
  let currentCustomer = null;

  function showSignedInProfile(customer) {
    currentCustomer = customer;
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const toast = document.getElementById('profileToast');

    if (avatar) {
      if (customer.picture) {
        avatar.src = customer.picture;
        avatar.hidden = false;
      } else {
        avatar.removeAttribute('src');
        avatar.hidden = true;
      }
      avatar.alt = customer.name || 'Profile photo';
    }
    if (name) name.textContent = customer.name || 'Welcome';
    if (email) email.textContent = customer.email || '';
    if (toast) toast.textContent = customer.provider === 'google' ? 'Signed in with Google ✓' : 'Signed in ✓';

    accountLoggedOut.hidden = true;
    accountLoggedIn.hidden = false;

    if (typeof Wishlist !== 'undefined') Wishlist.syncFromServer();
  }

  function showSignedOut() {
    currentCustomer = null;
    accountLoggedIn.hidden = true;
    accountLoggedOut.hidden = false;
    accountTabs.forEach(t => t.classList.remove('active'));
    accountForms.forEach(f => f.classList.remove('active'));
    const signinTab = document.querySelector('.account-tab[data-tab="signin"]');
    const signinForm = document.querySelector('.account-form[data-form="signin"]');
    if (signinTab) signinTab.classList.add('active');
    if (signinForm) signinForm.classList.add('active');
  }

  /* ----------------------------- sign in ----------------------------- */
  const signinForm = document.querySelector('.account-form[data-form="signin"]');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signinEmail').value.trim();
      const password = document.getElementById('signinPassword').value;
      setBusy(signinForm, true);
      try {
        const { customer } = await api('/api/customers/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        showSignedInProfile(customer);
      } catch (err) {
        showToast(err.message, 'err');
      } finally {
        setBusy(signinForm, false);
      }
    });
  }

  /* ----------------------------- create account ----------------------------- */
  const signupForm = document.querySelector('.account-form[data-form="signup"]');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      setBusy(signupForm, true);
      try {
        const { customer } = await api('/api/customers/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        showToast('Account created — welcome to Hive & Ash ✓', 'ok');
        showSignedInProfile(customer);
      } catch (err) {
        showToast(err.message, 'err');
      } finally {
        setBusy(signupForm, false);
      }
    });
  }

  const guestBtn = document.getElementById('guestBtn');
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      // Closing the panel is handled by each page's own panel-close wiring
      // (accountCloseBtn click), so just trigger that here.
      const closeBtn = document.getElementById('accountCloseBtn');
      if (closeBtn) closeBtn.click();
    });
  }

  /* ----------------------------- forgot password ----------------------------- */
  function showAccountForm(name) {
    accountForms.forEach(f => f.classList.remove('active'));
    const target = document.querySelector(`.account-form[data-form="${name}"]`);
    if (target) target.classList.add('active');
    if (accountToast) accountToast.classList.remove('show');
  }

  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('forgot');
    });
  }

  const backToSigninLink = document.getElementById('backToSigninLink');
  if (backToSigninLink) {
    backToSigninLink.addEventListener('click', (e) => {
      e.preventDefault();
      showAccountForm('signin');
    });
  }

  const forgotForm = document.querySelector('.account-form[data-form="forgot"]');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail').value.trim();
      setBusy(forgotForm, true);
      try {
        const data = await api('/api/customers/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        const devNote = data.devResetLink
          ? ` (Dev mode — no SMTP provider configured yet: ${data.devResetLink})`
          : '';
        showToast((data.message || 'Reset link sent.') + devNote, 'ok');
      } catch (err) {
        showToast(err.message, 'err');
      } finally {
        setBusy(forgotForm, false);
      }
    });
  }

  /* ===================== GOOGLE SIGN-IN (Google Identity Services) =====================
     The Client ID lives server-side in .env (GOOGLE_CLIENT_ID) and is fetched from
     /api/config — nothing to hardcode here. When it's unset, the buttons show a small
     fallback note and everyone can still use email + password accounts normally.

     On success, the ID token Google returns is sent to the backend, which verifies its
     signature (via google-auth-library) before creating a real session — the browser
     never has to be trusted on its own.
  ======================================================================================== */
  function handleGoogleCredentialResponse(response) {
    api('/api/customers/google', {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential })
    }).then(({ customer }) => {
      showSignedInProfile(customer);
    }).catch(err => {
      showToast(err.message, 'err');
    });
  }

  async function initGoogleSignIn() {
    const signinSlot = document.getElementById('googleBtnSignin');
    const signupSlot = document.getElementById('googleBtnSignup');
    const signinFallback = document.getElementById('googleFallbackSignin');
    const signupFallback = document.getElementById('googleFallbackSignup');

    let clientId = null;
    try {
      const cfg = await api('/api/config');
      clientId = cfg && cfg.google ? cfg.google.clientId : null;
    } catch (e) { /* config fetch failed — fall back below */ }

    const ready = clientId && typeof google !== 'undefined' && google.accounts && google.accounts.id;
    if (!ready) {
      if (signinFallback) signinFallback.hidden = false;
      if (signupFallback) signupFallback.hidden = false;
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    const btnStyle = { type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', width: 320 };
    if (signinSlot) google.accounts.id.renderButton(signinSlot, { ...btnStyle, text: 'signin_with' });
    if (signupSlot) google.accounts.id.renderButton(signupSlot, { ...btnStyle, text: 'signup_with' });
  }

  if (document.readyState === 'complete') {
    initGoogleSignIn();
  } else {
    window.addEventListener('load', initGoogleSignIn);
  }

  /* ----------------------------- sign out ----------------------------- */
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      try { await api('/api/customers/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
      if (typeof Wishlist !== 'undefined') Wishlist.disableSync();
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
      }
      showSignedOut();
      const closeBtn = document.getElementById('accountCloseBtn');
      if (closeBtn) closeBtn.click();
    });
  }

  /* ----------------------------- resume session on load ----------------------------- */
  (async function checkSession() {
    try {
      const { customer } = await api('/api/customers/me');
      showSignedInProfile(customer);
    } catch (e) {
      // Not signed in — leave the signed-out forms showing.
    }
  })();

  /* ===================== ORDER HISTORY (standalone side panel) ===================== */
  const ORDER_STATUS_LABELS = {
    pending: 'Pending', processing: 'Processing', shipped: 'Shipped',
    in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled'
  };

  function formatOrderDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  async function renderOrderHistory() {
    const mount = document.getElementById('orderHistoryList');
    if (!mount) return;
    mount.innerHTML = '<div class="order-history-empty">Loading…</div>';
    try {
      const orders = await api('/api/customers/orders');
      if (!Array.isArray(orders) || orders.length === 0) {
        mount.innerHTML = '<div class="order-history-empty">No orders yet — once you place one, it\'ll show up here.</div>';
        return;
      }
      mount.innerHTML = orders.map(o => `
        <div class="order-history-card">
          <div class="order-history-top">
            <span class="order-history-id">${escapeHtml(o.id)}</span>
            <span class="order-history-date">${formatOrderDate(o.createdAt)}</span>
          </div>
          <div class="order-history-items">${(o.items || []).map(i => `${i.qty}× ${escapeHtml(i.name)}`).join(', ')}</div>
          <div class="order-history-bottom">
            <span class="order-history-total">${fmtRupee(o.subtotal)}</span>
            <span class="order-status-pill order-status-${escapeHtml(o.status)}">${escapeHtml(ORDER_STATUS_LABELS[o.status] || o.status)}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      mount.innerHTML = `<div class="order-history-empty">${escapeHtml(err.message)}</div>`;
    }
  }
  // Called by each page's own panel-open wiring (needs page-local openPanel/veil).
  window.renderOrderHistory = renderOrderHistory;

  /* ===================== ACCOUNT SETTINGS (standalone side panel) =====================
     Name edit + Mobile Number verification via OTP. The OTP itself is generated
     and checked server-side (src/routes/customers.js) — this is just the UI. */
  const settingsToast = document.getElementById('settingsToast');
  const settingsNameInput = document.getElementById('settingsName');
  const settingsEmailInput = document.getElementById('settingsEmail');
  const settingsPhoneInput = document.getElementById('settingsPhone');
  const phoneVerifiedBadge = document.getElementById('phoneVerifiedBadge');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const otpField = document.getElementById('otpField');
  const otpHint = document.getElementById('otpHint');
  const settingsOtpInput = document.getElementById('settingsOtp');

  function showSettingsToast(text, type) {
    if (!settingsToast) return;
    settingsToast.textContent = text;
    settingsToast.className = `account-toast show ${type || ''}`.trim();
  }

  function renderAccountSettingsView() {
    if (!currentCustomer || !settingsNameInput) return;
    settingsNameInput.value = currentCustomer.name || '';
    if (settingsEmailInput) settingsEmailInput.value = currentCustomer.email || '';
    if (settingsPhoneInput) settingsPhoneInput.value = currentCustomer.phone || '';
    if (phoneVerifiedBadge) phoneVerifiedBadge.hidden = !currentCustomer.phoneVerified;
    if (otpField) otpField.hidden = true;
    if (settingsOtpInput) settingsOtpInput.value = '';
    if (otpHint) otpHint.textContent = '';
    if (settingsToast) settingsToast.className = 'account-toast';
  }
  window.renderAccountSettingsView = renderAccountSettingsView;

  const settingsSaveNameBtn = document.getElementById('settingsSaveNameBtn');
  if (settingsSaveNameBtn) {
    settingsSaveNameBtn.addEventListener('click', async () => {
      const name = settingsNameInput.value.trim();
      if (!name) return showSettingsToast('Full name is required.', 'err');
      settingsSaveNameBtn.disabled = true;
      try {
        const { customer } = await api('/api/customers/profile', { method: 'PUT', body: JSON.stringify({ name }) });
        currentCustomer = customer;
        const profileName = document.getElementById('profileName');
        if (profileName) profileName.textContent = customer.name;
        showSettingsToast('Name updated ✓', 'ok');
      } catch (err) {
        showSettingsToast(err.message, 'err');
      } finally {
        settingsSaveNameBtn.disabled = false;
      }
    });
  }

  let resendCooldown = 0;
  let resendTimer = null;
  function startResendCooldown(seconds) {
    resendCooldown = seconds;
    if (resendTimer) clearInterval(resendTimer);
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = `Resend in ${resendCooldown}s`;
    resendTimer = setInterval(() => {
      resendCooldown -= 1;
      if (resendCooldown <= 0) {
        clearInterval(resendTimer);
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'Send OTP';
      } else {
        sendOtpBtn.textContent = `Resend in ${resendCooldown}s`;
      }
    }, 1000);
  }

  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async () => {
      const phone = settingsPhoneInput.value.trim();
      if (!/^[6-9]\d{9}$/.test(phone)) {
        return showSettingsToast('Enter a valid 10-digit Indian mobile number.', 'err');
      }
      sendOtpBtn.disabled = true;
      try {
        const data = await api('/api/customers/otp/send', { method: 'POST', body: JSON.stringify({ phone }) });
        otpField.hidden = false;
        settingsOtpInput.value = '';
        settingsOtpInput.focus();
        showSettingsToast(data.message || 'Code sent ✓', 'ok');
        if (otpHint) {
          otpHint.textContent = data.devOtp
            ? `Dev mode (no SMS provider configured yet): your code is ${data.devOtp}`
            : '';
        }
        startResendCooldown(30);
      } catch (err) {
        showSettingsToast(err.message, 'err');
        sendOtpBtn.disabled = false;
      }
    });
  }

  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async () => {
      const otp = settingsOtpInput.value.trim();
      if (!/^\d{6}$/.test(otp)) return showSettingsToast('Enter the 6-digit code.', 'err');
      verifyOtpBtn.disabled = true;
      try {
        const { customer } = await api('/api/customers/otp/verify', { method: 'POST', body: JSON.stringify({ otp }) });
        currentCustomer = customer;
        phoneVerifiedBadge.hidden = false;
        otpField.hidden = true;
        if (resendTimer) clearInterval(resendTimer);
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'Send OTP';
        showSettingsToast('Mobile number verified ✓', 'ok');
      } catch (err) {
        showSettingsToast(err.message, 'err');
      } finally {
        verifyOtpBtn.disabled = false;
      }
    });
  }
})();
