/**
 * NEXTEP CRM - Super Admin Controller
 * Painel administrativo global
 */

exports.getDashboard = async (req, res) => {
  try {
    const supabase = req.supabase;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito ao Super Admin' });
    }

    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: activeCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: suspendedCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suspended');

    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { data: monthlyRevenue } = await supabase
      .from('invoices')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const revenue = monthlyRevenue?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

    // Empresas recentes — com contagem de usuários e leads
    const { data: recentCompanies, error: companiesError } = await supabase
      .from('companies')
      .select(`
        id, name, email, plan, status, created_at,
        users:users(count),
        leads:leads(count)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (companiesError) {
      console.error('Erro ao buscar empresas:', companiesError);
    }

    // Distribuição por plano — feito manualmente (sem .group(), que não existe no supabase-js)
    const { data: allCompaniesPlans } = await supabase
      .from('companies')
      .select('plan');

    const planCounts = {};
    (allCompaniesPlans || []).forEach(c => {
      planCounts[c.plan] = (planCounts[c.plan] || 0) + 1;
    });
    const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }));

    res.json({
      metrics: {
        totalCompanies: totalCompanies || 0,
        activeCompanies: activeCompanies || 0,
        suspendedCompanies: suspendedCompanies || 0,
        totalUsers: totalUsers || 0,
        totalLeads: totalLeads || 0,
        monthlyRevenue: revenue
      },
      recentCompanies: recentCompanies || [],
      planDistribution: planDistribution || []
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard admin', details: error.message });
  }
};

exports.listCompanies = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { page = 1, limit = 20, search, status, plan } = req.query;
    const supabase = req.supabase;

    let query = supabase
      .from('companies')
      .select(`
        *,
        users:users(count),
        leads:leads(count),
        properties:properties(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (plan) query = query.eq('plan', plan);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    });

  } catch (error) {
    console.error('List companies error:', error);
    res.status(500).json({ error: 'Erro ao listar empresas', details: error.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };

    const { data: company, error } = await req.supabase
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json({ message: 'Empresa atualizada', company });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
};

exports.getCompanyDetails = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const supabase = req.supabase;

    const { data: company } = await supabase
      .from('companies')
      .select(`
        *,
        users:users(id, name, email, role, status, last_login),
        subscriptions:subscriptions(*),
        invoices:invoices(*)
      `)
      .eq('id', id)
      .single();

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json(company);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar detalhes da empresa' });
  }
};