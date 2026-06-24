module.exports = (req, res, next) => {
  if (!req.user || !req.user.companyId) return res.status(401).json({ error: 'Contexto de empresa nao encontrado' });
  if (req.method === 'POST' && req.body && typeof req.body === 'object') req.body.company_id = req.user.companyId;
  next();
};