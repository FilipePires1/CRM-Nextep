const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { leadId, clientId, page = 1, limit = 50 } = req.query;
    let query = req.supabase
      .from('messages')
      .select('*')
      .eq('company_id', req.user.companyId)
      .order('created_at', { ascending: false });

    if (leadId) query = query.eq('lead_id', leadId);
    if (clientId) query = query.eq('client_id', clientId);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;
    res.json({ data: data || [], pagination: { page: parseInt(page), total: count } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

module.exports = router;