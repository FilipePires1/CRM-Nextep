const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { data } = await req.supabase
      .from('automations')
      .select('*')
      .eq('company_id', req.user.companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar automações' });
  }
});

module.exports = router;