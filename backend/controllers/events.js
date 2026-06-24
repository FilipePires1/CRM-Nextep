/**
 * NEXTEP CRM - Events/Calendar Controller
 */

exports.list = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { start, end, type } = req.query;

    let query = supabase
      .from('events')
      .select(`
        *,
        creator:created_by (id, name, avatar_url)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (start) query = query.gte('start_at', start);
    if (end) query = query.lte('end_at', end);
    if (type) query = query.eq('type', type);

    const { data, error } = await query.order('start_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar eventos' });
  }
};

exports.create = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const data = req.body;

    const { data: event, error } = await supabase
      .from('events')
      .insert([{
        company_id: companyId,
        created_by: req.user.userId,
        title: data.title,
        description: data.description,
        type: data.type || 'meeting',
        start_at: data.start_at,
        end_at: data.end_at,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        related_type: data.related_type,
        related_id: data.related_id,
        attendees: data.attendees || []
      }])
      .select()
      .single();

    if (error) throw error;

    // Criar tarefa relacionada se for visita
    if (data.type === 'visit') {
      await supabase.from('tasks').insert([{
        company_id: companyId,
        assigned_to: req.user.userId,
        created_by: req.user.userId,
        related_type: data.related_type,
        related_id: data.related_id,
        title: `Visita: ${data.title}`,
        type: 'visit',
        due_date: data.start_at,
        status: 'pending'
      }]);
    }

    res.status(201).json({ message: 'Evento criado', event });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar evento', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.company_id;

    const { data: event, error } = await req.supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    if (error || !event) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json({ message: 'Evento atualizado', event });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
};

exports.delete = async (req, res) => {
  try {
    await req.supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('company_id', req.user.companyId);
    res.json({ message: 'Evento removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover evento' });
  }
};
