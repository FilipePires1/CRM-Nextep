const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const pipeline = require('../controllers/pipeline');

router.get('/stages', auth, pipeline.getStages);
router.get('/stages/:stageId/leads', auth, pipeline.getLeadsByStage);
router.post('/stages', auth, pipeline.createStage);
router.put('/stages/reorder', auth, pipeline.reorderStages);
router.post('/leads/:leadId/move', auth, pipeline.moveLead);

module.exports = router;