/**
 * NEXTEP CRM - Clients Controller
 */

const toNum = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);

exports.list = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { page = 1, limit = 20, search, status } = req.query;

    let query = supabase
      .from('clients')
      .select(`
        *,
        assigned:assigned_to (id, name, avatar_url),
        lead:lead_id (id, source)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,cpf.ilike.%${search}%`);
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
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        *,
        assigned:assigned_to (id, name, avatar_url),
        lead:lead_id (id, source, created_at),
        properties:properties!owner_id (*),
        tasks:tasks!related_id (*),
        documents:documents!related_id (*)
      `)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json(client);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
};

exports.create = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const data = req.body;

    const { data: client, error } = await supabase
      .from('clients')
      .insert([{
        company_id: companyId,
        assigned_to: data.assigned_to || req.user.userId,
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        cpf: data.cpf,
        cnpj: data.cnpj,
        rg: data.rg,
        birth_date: data.birth_date,
        marital_status: data.marital_status,
        profession: data.profession,
        income: toNum(data.income),
        address: data.address,
        city: data.city,
        state: data.state,
        cep: data.cep,
        notes: data.notes,
        tags: data.tags || []
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Cliente criado', client });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar cliente', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.company_id;

    const { data: client, error } = await req.supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    if (error || !client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ message: 'Cliente atualizado', client });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
};

exports.delete = async (req, res) => {
  try {
    await req.supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('company_id', req.user.companyId);
    res.json({ message: 'Cliente removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover cliente' });
  }
};
