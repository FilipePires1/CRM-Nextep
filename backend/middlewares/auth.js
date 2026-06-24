const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token nao fornecido' });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user, error } = await req.supabase.from('users').select('id, role, status, company_id, companies:company_id(status, plan)').eq('id', decoded.userId).single();
    if (error || !user) return res.status(401).json({ error: 'Usuario nao encontrado' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Usuario inativo' });
    if (user.companies.status !== 'active') return res.status(403).json({ error: 'Empresa suspensa' });
    req.user = { userId: decoded.userId, companyId: decoded.companyId, email: decoded.email, role: decoded.role, name: decoded.name, plan: user.companies.plan };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Token invalido' });
  }
};