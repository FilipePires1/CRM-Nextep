const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const clients = require('../controllers/clients');

router.get('/', auth, clients.list);
router.get('/:id', auth, clients.getById);
router.post('/', auth, clients.create);
router.put('/:id', auth, clients.update);
router.delete('/:id', auth, clients.delete);

module.exports = router;