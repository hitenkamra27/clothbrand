/*
 * Shiprocket Checkout (payments) adapter
 * ------------------------------------------------------------------
 * Shiprocket Payments/Checkout (checkout.shiprocket.in) is the one-click
 * checkout + payment product — the direct equivalent of what GoKwik was
 * wired up for here. For Shopify/WooCommerce it's a plugin; for a custom
 * site like this one, Shiprocket's team gives you a merchant/channel ID
 * and the exact JS snippet after onboarding, the same way GoKwik did — so
 * like gokwik.js before it, this file can't be filled in sight-unseen.
 *
 * Shipping/tracking is NOT in this situation — that part is already fully
 * implemented server-side in src/services/shiprocket.js using Shiprocket's
 * public documented API, and needs no manual snippet.
 *
 * TO GO LIVE WITH SHIPROCKET CHECKOUT/PAYMENTS:
 *   1. Sign up at https://checkout.shiprocket.in (or from your existing
 *      Shiprocket dashboard) and complete merchant KYC.
 *   2. For a custom/non-Shopify site, contact Shiprocket's integration
 *      team (via your merchant dashboard, or integration@shiprocket.com)
 *      for the API/plugin route — they'll give you a channel/merchant ID
 *      and the exact checkout script + method names for your account.
 *   3. Put SHIPROCKET_CHECKOUT_ID in your .env — ShiprocketCheckout.isEnabled()
 *      will then return true automatically.
 *   4. Replace the body of loadScript()/open() below with what their team
 *      gives you. The rest of the site doesn't need to change.
 */
const ShiprocketCheckout = (function () {
  let config = { enabled: false, checkoutId: null, env: 'sandbox' };
  let scriptLoaded = false;

  async function init() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      config = data.shiprocket || config;
    } catch (e) {
      console.warn('Could not load /api/config; Shiprocket checkout will stay disabled.', e);
    }
    return config;
  }

  function isEnabled() {
    return !!config.enabled;
  }

  function loadScript() {
    if (scriptLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      // Placeholder URL — swap for the real one Shiprocket's integration team gives you.
      const script = document.createElement('script');
      script.src = `https://checkout.shiprocket.in/v1/checkout.js?channelId=${encodeURIComponent(config.checkoutId)}`;
      script.async = true;
      script.onload = () => { scriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Shiprocket checkout script failed to load'));
      document.head.appendChild(script);
    });
  }

  // `order` = { items, subtotal, customer } — same shape the COD checkout builds.
  async function open(order) {
    if (!isEnabled()) {
      throw new Error('Shiprocket Checkout is not configured yet. Set SHIPROCKET_CHECKOUT_ID in .env to enable it.');
    }
    await loadScript();
    // Real call goes here once Shiprocket provides their SDK's actual method name,
    // e.g. something like: window.shiprocketCheckout.init({ channelId: config.checkoutId, cart: order }).
    // Left unimplemented intentionally — see file header.
    throw new Error(
      'Shiprocket checkout script loaded, but the actual checkout call still needs the SDK method ' +
      'Shiprocket\'s integration team gives you for your merchant account — see the TODO in public/js/shiprocket.js.'
    );
  }

  return { init, isEnabled, open, getConfig: () => config };
})();
