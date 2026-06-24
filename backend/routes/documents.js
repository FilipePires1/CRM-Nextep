const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { related_type, related_id } = req.query;
    const { data, error } = await req.supabase
      .from('documents')
      .select('*, uploaded_by:uploaded_by(id, name)')
      .eq('company_id', req.user.companyId)
      .eq('related_type', related_type)
      .eq('related_id', related_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar documentos' });
  }
});

module.exports = router;