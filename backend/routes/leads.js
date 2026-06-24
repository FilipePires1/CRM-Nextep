const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const leads = require('../controllers/leads');

router.get('/', auth, leads.list);
router.get('/:id', auth, leads.getById);
router.post('/', auth, leads.create);
router.put('/:id', auth, leads.update);
router.delete('/:id', auth, leads.delete);
router.post('/:id/transfer', auth, leads.transfer);
router.post('/:id/convert', auth, leads.convertToClient);

module.exports = router;