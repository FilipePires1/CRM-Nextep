module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado', required: allowedRoles, current: req.user.role });
    next();
  };
};