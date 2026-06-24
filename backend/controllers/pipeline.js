/**
 * NEXTEP CRM - Pipeline Controller
 * Funil de Vendas Kanban
 */

exports.getStages = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('company_id', companyId)
      .order('position', { ascending: true });

    if (error) throw error;

    // Contar leads por estágio
    const { data: counts } = await supabase
      .rpc('get_pipeline_counts', { company_uuid: companyId });

    const stagesWithCounts = stages?.map(stage => {
      const count = counts?.find(c => c.stage_id === stage.id);
      return {
        ...stage,
        lead_count: count?.count || 0,
        total_value: count?.total_value || 0
      };
    });

    res.json(stagesWithCounts || []);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar funil' });
  }
};

exports.getLeadsByStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: leads, error } = await supabase
      .from('leads')
      .select(`
        id, name, phone, email, whatsapp, budget_max, priority, 
        tags, created_at, last_contact_at, next_contact_at,
        assigned_to:assigned_to (id, name, avatar_url)
      `)
      .eq('company_id', companyId)
      .eq('stage_id', stageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(leads || []);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar leads do estágio' });
  }
};

exports.moveLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { stage_id, reason } = req.body;
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    // Buscar estágio atual
    const { data: lead } = await supabase
      .from('leads')
      .select('stage_id')
      .eq('id', leadId)
      .eq('company_id', companyId)
      .single();

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    // Registrar histórico
    await supabase.from('pipeline_history').insert([{
      company_id: companyId,
      lead_id: leadId,
      from_stage_id: lead.stage_id,
      to_stage_id: stage_id,
      moved_by: req.user.userId,
      reason
    }]);

    // Atualizar lead
    const { data: updated } = await supabase
      .from('leads')
      .update({ 
        stage_id, 
        updated_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('company_id', companyId)
      .select()
      .single();

    // Verificar se é estágio de ganho/perda
    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('is_won, is_lost')
      .eq('id', stage_id)
      .single();

    if (stage?.is_won) {
      await supabase.from('leads').update({ status: 'converted' }).eq('id', leadId);
    } else if (stage?.is_lost) {
      await supabase.from('leads').update({ status: 'lost' }).eq('id', leadId);
    }

    res.json({ message: 'Lead movido com sucesso', lead: updated });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao mover lead' });
  }
};

exports.createStage = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { name, color, position } = req.body;

    // Verificar permissão
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Apenas administradores podem criar estágios' });
    }

    const { data: stage, error } = await supabase
      .from('pipeline_stages')
      .insert([{
        company_id: companyId,
        name,
        color: color || '#0d6efd',
        position: position || 0
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Estágio criado', stage });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar estágio' });
  }
};

exports.reorderStages = async (req, res) => {
  try {
    const { stages } = req.body; // Array de {id, position}
    const supabase = req.supabase;

    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    // Atualizar posições em batch
    const updates = stages.map(s => 
      supabase.from('pipeline_stages')
        .update({ position: s.position })
        .eq('id', s.id)
        .eq('company_id', req.user.companyId)
    );

    await Promise.all(updates);

    res.json({ message: 'Ordem atualizada' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao reordenar' });
  }
};
