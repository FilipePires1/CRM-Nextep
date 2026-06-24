/**
 * NEXTEP CRM - Tasks Controller
 */

exports.list = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { page = 1, limit = 20, status, priority, assigned_to, type } = req.query;

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned:assigned_to (id, name, avatar_url),
        creator:created_by (id, name)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (type) query = query.eq('type', type);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    // Corretores veem apenas suas tarefas
    if (req.user.role === 'broker') {
      query = query.eq('assigned_to', req.user.userId);
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
    res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
};

exports.create = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const data = req.body;

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([{
        company_id: companyId,
        assigned_to: data.assigned_to,
        created_by: req.user.userId,
        related_type: data.related_type,
        related_id: data.related_id,
        title: data.title,
        description: data.description,
        type: data.type || 'task',
        priority: data.priority || 'medium',
        status: 'pending',
        due_date: data.due_date,
        reminder_at: data.reminder_at,
        google_event_id: data.google_event_id
      }])
      .select()
      .single();

    if (error) throw error;

    // Notificar responsável
    await supabase.from('notifications').insert([{
      company_id: companyId,
      user_id: data.assigned_to,
      title: 'Nova Tarefa',
      message: data.title,
      type: 'info',
      related_type: 'task',
      related_id: task.id
    }]);

    res.status(201).json({ message: 'Tarefa criada', task });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar tarefa', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.company_id;

    if (updateData.status === 'completed' && !updateData.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: task, error } = await req.supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    if (error || !task) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ message: 'Tarefa atualizada', task });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
};

exports.delete = async (req, res) => {
  try {
    await req.supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('company_id', req.user.companyId);
    res.json({ message: 'Tarefa removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover tarefa' });
  }
};
