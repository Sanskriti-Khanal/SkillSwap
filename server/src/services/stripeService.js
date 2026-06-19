const Stripe = require('stripe');

let _stripe = null;

// Lazy-initialise so the module can be loaded without STRIPE_SECRET_KEY set (e.g. in tests).
// The key is read from the environment at first use, not at require-time.
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    _stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

module.exports = getStripe;
