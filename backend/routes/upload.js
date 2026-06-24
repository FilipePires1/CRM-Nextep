const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const filePath = `${req.user.companyId}/${Date.now()}_${req.file.originalname}`;
    const { data, error } = await req.supabase.storage
      .from('documents')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

    if (error) throw error;

    const { data: { publicUrl } } = req.supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    res.json({ url: publicUrl, path: filePath });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

module.exports = router;