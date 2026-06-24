const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ai = require('../controllers/ai');

router.post('/reply', auth, ai.replyLead);
router.post('/qualify/:leadId', auth, ai.qualifyLead);
router.get('/summarize/:leadId', auth, ai.summarizeConversation);
router.post('/follow-up', auth, ai.generateFollowUp);

module.exports = router;