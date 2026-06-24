const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/leads', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const { data } = await req.supabase
      .from('leads')
      .select('source, status, created_at, budget_max')
      .eq('company_id', req.user.companyId)
      .gte('created_at', start)
      .lte('created_at', end)
      .is('deleted_at', null);
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

module.exports = router;