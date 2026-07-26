const express = require('express');
const router = express.Router();

// Only ever expose things that are safe for a browser to see (this is not
// where secrets like ADMIN_PASSWORD_HASH or SESSION_SECRET belong).
router.get('/', (req, res) => {
  res.json({
    shiprocket: {
      enabled: !!process.env.SHIPROCKET_CHECKOUT_ID,
      checkoutId: process.env.SHIPROCKET_CHECKOUT_ID || null,
      env: process.env.SHIPROCKET_ENV || 'sandbox'
    },
    // Whether Shiprocket Shipping (order booking/tracking) has credentials
    // set — just a boolean, no secret values, safe to expose publicly.
    shiprocketShipping: !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD),
    google: {
      // OAuth Client IDs are meant to be public (they're baked into frontend JS everywhere),
      // so exposing this here is safe. The corresponding secret, if you ever need one, never
      // belongs in this file or in any response.
      clientId: process.env.GOOGLE_CLIENT_ID || null
    }
  });
});

module.exports = router;
