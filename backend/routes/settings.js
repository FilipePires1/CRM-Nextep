const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

router.get('/company', auth, async (req, res) => {
  try {
    const { data } = await req.supabase
      .from('companies')
      .select('*')
      .eq('id', req.user.companyId)
      .single();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

router.put('/company', auth, async (req, res) => {
  try {
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.id;
    const { data } = await req.supabase
      .from('companies')
      .update(updateData)
      .eq('id', req.user.companyId)
      .select()
      .single();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

module.exports = router;