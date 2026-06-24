const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const tasks = require('../controllers/tasks');

router.get('/', auth, tasks.list);
router.post('/', auth, tasks.create);
router.put('/:id', auth, tasks.update);
router.delete('/:id', auth, tasks.delete);

module.exports = router;