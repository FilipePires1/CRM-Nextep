const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const whatsapp = require('../controllers/whatsapp');

router.get('/instances', auth, whatsapp.listInstances);
router.post('/instances', auth, whatsapp.createInstance);
router.get('/instances/:id/qr', auth, whatsapp.getQRCode);
router.post('/send', auth, whatsapp.sendMessage);
router.post('/instances/:id/logout', auth, whatsapp.logout);
router.delete('/instances/:id', auth, whatsapp.deleteInstance);
router.put('/instances/:id/ai', auth, whatsapp.configureAI);

module.exports = router;