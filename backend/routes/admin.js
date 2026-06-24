const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const role = require('../middlewares/role');
const admin = require('../controllers/admin');

router.get('/dashboard', auth, role('super_admin'), admin.getDashboard);
router.get('/companies', auth, role('super_admin'), admin.listCompanies);
router.get('/companies/:id', auth, role('super_admin'), admin.getCompanyDetails);
router.put('/companies/:id', auth, role('super_admin'), admin.updateCompany);

module.exports = router;