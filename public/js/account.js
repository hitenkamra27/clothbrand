/* ===================== STUDIO — Customer Account (shared across pages) =====================
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
  function showSignedInProfile(customer) {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const toast = document.getElementById('profileToast');

    if (avatar) {
      avatar.src = customer.picture || '';
      avatar.alt = customer.name || 'Profile photo';
      avatar.style.display = customer.picture ? '' : 'none';
    }
    if (name) name.textContent = customer.name || 'Welcome';
    if (email) email.textContent = customer.email || '';
    if (toast) toast.textContent = customer.provider === 'google' ? 'Signed in with Google ✓' : 'Signed in ✓';

    accountLoggedOut.hidden = true;
    accountLoggedIn.hidden = false;
  }

  function showSignedOut() {
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
        showToast('Account created — welcome to STUDIO ✓', 'ok');
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
})();
