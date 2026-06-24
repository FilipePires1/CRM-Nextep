/**
 * NEXTEP CRM - Leads Controller
 * Gerenciamento completo de leads
 */

const { validationResult } = require('express-validator');
const toNum = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);
const toStr = (v) => (v === '' || v === null || v === undefined) ? null : String(v);

exports.list = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const {
      page = 1,
      limit = 20,
      search,
      stage_id,
      status,
      assigned_to,
      source,
      priority,
      tags
    } = req.query;

    let query = supabase
      .from('leads')
      .select(`
        *,
        stage:stage_id (id, name, color),
        assigned:assigned_to (id, name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Filtros
    if (stage_id) query = query.eq('stage_id', stage_id);
    if (status) query = query.eq('status', status);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (source) query = query.eq('source', source);
    if (priority) query = query.eq('priority', priority);
    if (tags) query = query.contains('tags', [tags]);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,cpf.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar leads', details: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const supabase = req.supabase;
    const { id } = req.params;

    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        stage:stage_id (id, name, color),
        assigned:assigned_to (id, name, avatar_url),
        history:pipeline_history(*, from_stage:from_stage_id(name), to_stage:to_stage_id(name), moved_by:moved_by(name))
      `)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Mensagens relacionadas
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Tarefas relacionadas
    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        id, title, type, priority, status, due_date,
        assigned_to:assigned_to (id, name)
      `)
      .eq('related_type', 'lead')
      .eq('related_id', id)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    // Documentos
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('related_type', 'lead')
      .eq('related_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json({
      ...lead,
      messages: messages || [],
      tasks: tasks || [],
      documents: documents || []
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lead' });
  }
};

exports.create = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const data = req.body;

    // Verificar limite de leads do plano
    const { data: company } = await supabase
      .from('companies')
      .select('max_leads')
      .eq('id', companyId)
      .single();

    const { count: currentLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (currentLeads >= company.max_leads) {
      return res.status(403).json({
        error: 'Limite de leads atingido',
        limit: company.max_leads,
        current: currentLeads
      });
    }

    // Buscar estágio padrão
    const { data: defaultStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .single();

    // Utilitário para converter string vazia em null
    const toNum = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);
    const toStr = (v) => (v === '' || v === null || v === undefined) ? null : String(v);

    const leadData = {
      company_id: companyId,
      stage_id: data.stage_id || defaultStage?.id,
      assigned_to: data.assigned_to || req.user.userId,
      name: data.name,
      phone: toStr(data.phone),
      whatsapp: toStr(data.whatsapp) || toStr(data.phone),
      email: toStr(data.email),
      cpf: toStr(data.cpf),
      cnpj: toStr(data.cnpj),
      city: toStr(data.city),
      state: toStr(data.state),
      interest_type: toStr(data.interest_type),
      interest_details: toStr(data.interest_details),
      source: toStr(data.source),
      source_details: toStr(data.source_details),
      budget_min: toNum(data.budget_min),
      budget_max: toNum(data.budget_max),
      tags: data.tags || [],
      notes: toStr(data.notes),
      priority: data.priority || 'medium'
    };

    const { data: lead, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (error) throw error;

    // Criar notificação
    await supabase.from('notifications').insert([{
      company_id: companyId,
      user_id: data.assigned_to || req.user.userId,
      title: 'Novo Lead',
      message: `${data.name} foi adicionado ao funil`,
      type: 'info',
      related_type: 'lead',
      related_id: lead.id
    }]);

    res.status(201).json({ message: 'Lead criado com sucesso', lead });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar lead', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    // Verificar lead existe
    const { data: existing } = await supabase
      .from('leads')
      .select('stage_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.company_id; // Não permitir alterar company_id

    // Se mudou de estágio, registrar histórico
    if (updateData.stage_id && updateData.stage_id !== existing.stage_id) {
      await supabase.from('pipeline_history').insert([{
        company_id: companyId,
        lead_id: id,
        from_stage_id: existing.stage_id,
        to_stage_id: updateData.stage_id,
        moved_by: req.user.userId,
        reason: updateData.stage_change_reason
      }]);
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Lead atualizado', lead });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    await supabase
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', req.user.companyId);

    res.json({ message: 'Lead removido com sucesso' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover lead' });
  }
};

exports.transfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    const supabase = req.supabase;

    const { data: lead } = await supabase
      .from('leads')
      .update({ assigned_to, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    // Notificar novo responsável
    await supabase.from('notifications').insert([{
      company_id: req.user.companyId,
      user_id: assigned_to,
      title: 'Lead Transferido',
      message: `${lead.name} foi transferido para você`,
      type: 'warning',
      related_type: 'lead',
      related_id: id
    }]);

    res.json({ message: 'Lead transferido com sucesso', lead });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao transferir lead' });
  }
};

exports.convertToClient = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Criar cliente
    const { data: client } = await supabase
      .from('clients')
      .insert([{
        company_id: companyId,
        lead_id: id,
        assigned_to: lead.assigned_to,
        name: lead.name,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        email: lead.email,
        cpf: lead.cpf,
        city: lead.city,
        state: lead.state,
        notes: lead.notes,
        tags: lead.tags
      }])
      .select()
      .single();

    // Atualizar lead
    await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_to_client_id: client.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    res.json({ message: 'Lead convertido para cliente', client });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao converter lead' });
  }
};
