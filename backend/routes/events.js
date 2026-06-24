const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const events = require('../controllers/events');

router.get('/', auth, events.list);
router.post('/', auth, events.create);
router.put('/:id', auth, events.update);
router.delete('/:id', auth, events.delete);

module.exports = router;