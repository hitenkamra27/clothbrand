/*
 * GoKwik Checkout adapter
 * ------------------------------------------------------------------
 * GoKwik (gokwik.co) is a real one-click checkout + COD/RTO platform used
 * by Indian D2C brands. For Shopify/WooCommerce they ship a plugin; for a
 * custom site like this one, their integration team provides the exact
 * script snippet and merchant configuration after you sign up — it's not
 * something publicly documented step-by-step, so it can't be hardcoded
 * here sight-unseen.
 *
 * This file is the single place that would need to change once you have
 * real GoKwik credentials. Everything else in the site (cart, checkout
 * panel, order backend) already works today on Cash on Delivery and
 * doesn't need to know whether GoKwik is connected or not.
 *
 * TO GO LIVE WITH GOKWIK:
 *   1. Sign up at https://www.gokwik.co and email integration@gokwik.co
 *      for custom/API web integration (non-Shopify/WooCommerce).
 *   2. They'll give you: a merchant ID, a checkout script URL, and the
 *      exact JS calls to open their checkout / pass cart + customer data.
 *   3. Put GOKWIK_MERCHANT_ID in your .env — GoKwikCheckout.isEnabled()
 *      will then return true automatically.
 *   4. Replace the body of loadScript()/open() below with what GoKwik's
 *      team gives you. The rest of the site doesn't need to change.
 */
const GoKwikCheckout = (function () {
  let config = { enabled: false, merchantId: null, env: 'sandbox' };
  let scriptLoaded = false;

  async function init() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      config = data.gokwik || config;
    } catch (e) {
      console.warn('Could not load /api/config; GoKwik checkout will stay disabled.', e);
    }
    return config;
  }

  function isEnabled() {
    return !!config.enabled;
  }

  function loadScript() {
    if (scriptLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      // Placeholder URL — swap for the real one GoKwik's integration team gives you.
      const script = document.createElement('script');
      script.src = `https://checkout.gokwik.co/v2/checkout.js?merchantId=${encodeURIComponent(config.merchantId)}`;
      script.async = true;
      script.onload = () => { scriptLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('GoKwik script failed to load'));
      document.head.appendChild(script);
    });
  }

  // `order` = { items, subtotal, customer } — same shape the COD checkout builds.
  async function open(order) {
    if (!isEnabled()) {
      throw new Error('GoKwik is not configured yet. Set GOKWIK_MERCHANT_ID in .env to enable it.');
    }
    await loadScript();
    // Real call goes here once GoKwik provides their SDK's actual method name,
    // e.g. something like: window.gokwikSdk.initCheckout({ merchantId: config.merchantId, cart: order }).
    // Left unimplemented intentionally — see file header.
    throw new Error(
      'GoKwik script loaded, but the actual checkout call still needs the SDK method GoKwik\'s ' +
      'integration team gives you for your merchant account — see the TODO in public/js/gokwik.js.'
    );
  }

  return { init, isEnabled, open, getConfig: () => config };
})();
