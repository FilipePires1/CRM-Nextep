const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const dashboard = require('../controllers/dashboard');

router.get('/metrics', auth, dashboard.getMetrics);
router.get('/charts', auth, dashboard.getCharts);

module.exports = router;