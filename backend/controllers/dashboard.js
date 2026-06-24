/**
 * NEXTEP CRM - Dashboard Controller
 * Métricas e KPIs em tempo real
 */

exports.getMetrics = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    // Usar função RPC do Supabase
    const { data: metrics, error } = await supabase
      .rpc('get_dashboard_metrics', { company_uuid: companyId });

    if (error) throw error;

    // Leads por origem (últimos 30 dias)
    const { data: leadsBySource } = await supabase
      .from('leads')
      .select('source')
      .eq('company_id', companyId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .is('deleted_at', null);

    const sourceCounts = {};
    leadsBySource?.forEach(l => {
      sourceCounts[l.source || 'desconhecido'] = (sourceCounts[l.source || 'desconhecido'] || 0) + 1;
    });

    // Leads por mês (últimos 6 meses)
    const { data: leadsByMonth } = await supabase
      .rpc('get_leads_by_month', { company_uuid: companyId });

    // Tarefas do dia
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select(`
        id, title, type, priority, status, due_date,
        assigned_to:assigned_to (id, name, avatar_url)
      `)
      .eq('company_id', companyId)
      .gte('due_date', `${today}T00:00:00`)
      .lte('due_date', `${today}T23:59:59`)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .limit(10);

    // Eventos do dia
    const { data: todayEvents } = await supabase
      .from('events')
      .select(`
        id, title, type, start_at, end_at, location,
        attendees
      `)
      .eq('company_id', companyId)
      .gte('start_at', `${today}T00:00:00`)
      .lte('start_at', `${today}T23:59:59`)
      .is('deleted_at', null)
      .order('start_at', { ascending: true })
      .limit(10);

    // Notificações não lidas
    const { data: unreadNotifications } = await supabase
      .from('notifications')
      .select('id, title, message, type, created_at')
      .eq('user_id', req.user.userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      metrics,
      leadsBySource: sourceCounts,
      leadsByMonth: leadsByMonth || [],
      todayTasks: todayTasks || [],
      todayEvents: todayEvents || [],
      unreadNotifications: unreadNotifications || []
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
};

exports.getCharts = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { period = '6months' } = req.query;

    let startDate;
    switch (period) {
      case '30days': startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); break;
      case '3months': startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); break;
      case '1year': startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    }

    // Leads por mês
    const { data: leadsData } = await supabase
      .from('leads')
      .select('created_at, status')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null);

    // Agrupar por mês
    const monthlyData = {};
    leadsData?.forEach(lead => {
      const month = lead.created_at.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { month, total: 0, converted: 0 };
      }
      monthlyData[month].total++;
      if (lead.status === 'converted') monthlyData[month].converted++;
    });

    // Vendas (leads convertidos)
    const { data: salesData } = await supabase
      .from('leads')
      .select('created_at, budget_max')
      .eq('company_id', companyId)
      .eq('status', 'converted')
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null);

    const monthlySales = {};
    salesData?.forEach(sale => {
      const month = sale.created_at.substring(0, 7);
      if (!monthlySales[month]) monthlySales[month] = { month, count: 0, value: 0 };
      monthlySales[month].count++;
      monthlySales[month].value += sale.budget_max || 0;
    });

    res.json({
      leads: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      sales: Object.values(monthlySales).sort((a, b) => a.month.localeCompare(b.month)),
      conversionRate: leadsData?.length 
        ? ((leadsData.filter(l => l.status === 'converted').length / leadsData.length) * 100).toFixed(2)
        : 0
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar gráficos' });
  }
};
