const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const properties = require('../controllers/properties');

router.get('/', auth, properties.list);
router.get('/:id', auth, properties.getById);
router.post('/', auth, properties.create);
router.put('/:id', auth, properties.update);
router.delete('/:id', auth, properties.delete);

module.exports = router;