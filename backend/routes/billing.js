const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const billing = require('../controllers/billing');

router.get('/subscription', auth, billing.getSubscription);
router.post('/checkout', auth, billing.createCheckout);
router.post('/cancel', auth, billing.cancelSubscription);
router.post('/upgrade', auth, billing.upgradePlan);

module.exports = router;