const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateTokens(user) {
  const payload = { userId: user.id, companyId: user.company_id, email: user.email, role: user.role, name: user.name };
  return { accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }), refreshToken: jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN }) };
}

exports.registerCompany = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { companyName, companyEmail, companyPhone, adminName, adminEmail, adminPassword, plan = 'basic' } = req.body;
    const supabase = req.supabase;
    const { data: existingCompany } = await supabase.from('companies').select('id').eq('email', companyEmail).single();
    if (existingCompany) return res.status(400).json({ error: 'Empresa ja cadastrada' });
    const { data: company, error: companyError } = await supabase.from('companies').insert([{
      name: companyName, email: companyEmail, phone: companyPhone, plan, status: 'active',
      max_users: plan === 'basic' ? 2 : plan === 'professional' ? 10 : 999,
      max_whatsapp: plan === 'basic' ? 1 : plan === 'professional' ? 3 : 999,
      max_leads: plan === 'basic' ? 500 : 999999
    }]).select().single();
    if (companyError) throw companyError;
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const { data: user, error: userError } = await supabase.from('users').insert([{
      company_id: company.id, name: adminName, email: adminEmail, password_hash: passwordHash, role: 'admin', status: 'active'
    }]).select().single();
    if (userError) throw userError;
    const defaultStages = [
      { name: 'Novo Lead', color: '#6c757d', position: 0, is_default: true },
      { name: 'Em Atendimento', color: '#0d6efd', position: 1 },
      { name: 'Follow Up', color: '#6610f2', position: 2 },
      { name: 'Resgate', color: '#fd7e14', position: 3 },
      { name: 'Geladeira', color: '#0dcaf0', position: 4 },
      { name: 'Visita Agendada', color: '#20c997', position: 5 },
      { name: 'Assessorando', color: '#198754', position: 6 },
      { name: 'Documentacao Pendente', color: '#ffc107', position: 7 },
      { name: 'Avaliacao de Cadastro', color: '#dc3545', position: 8 },
      { name: 'Negociacao', color: '#d63384', position: 9 },
      { name: 'Contrato', color: '#6f42c1', position: 10 },
      { name: 'Cliente Fechado', color: '#198754', position: 11, is_won: true },
      { name: 'Perdido', color: '#dc3545', position: 12, is_lost: true }
    ];
    await supabase.from('pipeline_stages').insert(defaultStages.map(s => ({ ...s, company_id: company.id })));
    const tokens = generateTokens({ ...user, company_id: company.id });
    res.status(201).json({ message: 'Empresa criada', company: { id: company.id, name: company.name, email: company.email, plan: company.plan }, user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens });
  } catch (error) { res.status(500).json({ error: 'Erro ao criar empresa', details: error.message }); }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const supabase = req.supabase;
    const { data: user, error } = await supabase.from('users').select('*, companies:company_id (*)').eq('email', email).eq('status', 'active').is('deleted_at', null).single();
    if (error || !user) return res.status(401).json({ error: 'Email ou senha invalidos' });
    if (user.companies.status !== 'active') return res.status(403).json({ error: 'Empresa suspensa' });
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Email ou senha invalidos' });
    await supabase.from('users').update({ last_login: new Date().toISOString(), login_count: user.login_count + 1 }).eq('id', user.id);
    const tokens = generateTokens(user);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url, company: { id: user.companies.id, name: user.companies.name, logo_url: user.companies.logo_url, plan: user.companies.plan, primary_color: user.companies.primary_color, custom_domain: user.companies.custom_domain } }, ...tokens });
  } catch (error) { res.status(500).json({ error: 'Erro ao fazer login' }); }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token nao fornecido' });
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const { data: user } = await req.supabase.from('users').select('*, companies:company_id(*)').eq('id', decoded.userId).eq('status', 'active').is('deleted_at', null).single();
    if (!user || user.companies.status !== 'active') return res.status(401).json({ error: 'Token invalido' });
    res.json(generateTokens(user));
  } catch (error) { res.status(401).json({ error: 'Token invalido ou expirado' }); }
};

exports.me = async (req, res) => {
  try {
    const { data: user } = await req.supabase.from('users').select('id, name, email, phone, avatar_url, role, status, preferences, company:company_id (id, name, logo_url, plan, primary_color, secondary_color, custom_domain)').eq('id', req.user.userId).single();
    res.json({ user });
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar perfil' }); }
};

exports.logout = async (req, res) => { res.json({ message: 'Logout realizado' }); };

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const { data: user } = await req.supabase.from('users').select('id, name, email, company_id').eq('email', email).single();
    if (!user) return res.status(404).json({ error: 'Email nao encontrado' });
    const resetToken = jwt.sign({ userId: user.id, type: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Instrucoes enviadas', ...(process.env.NODE_ENV === 'development' && { resetToken }) });
  } catch (error) { res.status(500).json({ error: 'Erro ao processar recuperacao' }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'password_reset') return res.status(400).json({ error: 'Token invalido' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await req.supabase.from('users').update({ password_hash: passwordHash }).eq('id', decoded.userId);
    res.json({ message: 'Senha atualizada' });
  } catch (error) { res.status(400).json({ error: 'Token invalido ou expirado' }); }
};