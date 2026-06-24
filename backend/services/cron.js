/**
 * NEXTEP CRM - Cron Jobs
 * Tarefas agendadas
 */

const cron = require('node-cron');

function initCronJobs(supabase) {
  // Verificar tarefas vencidas a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date().toISOString();

      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, company_id, assigned_to, title')
        .lt('due_date', now)
        .eq('status', 'pending')
        .is('deleted_at', null);

      for (const task of (overdueTasks || [])) {
        // Atualizar status
        await supabase
          .from('tasks')
          .update({ status: 'overdue' })
          .eq('id', task.id);

        // Notificar responsável
        await supabase.from('notifications').insert([{
          company_id: task.company_id,
          user_id: task.assigned_to,
          title: 'Tarefa Atrasada',
          message: `"${task.title}" está atrasada`,
          type: 'warning',
          related_type: 'task',
          related_id: task.id
        }]);
      }
    } catch (error) {
      console.error('Cron overdue tasks error:', error);
    }
  });

  // Verificar leads sem resposta (automação) a cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inactiveLeads } = await supabase
        .from('leads')
        .select('id, company_id, assigned_to, name, phone, last_contact_at, stage_id')
        .lt('last_contact_at', threeDaysAgo)
        .eq('status', 'new')
        .is('deleted_at', null);

      for (const lead of (inactiveLeads || [])) {
        // Trigger automação: lead_no_response
        const { data: automations } = await supabase
          .from('automations')
          .select('*')
          .eq('company_id', lead.company_id)
          .eq('trigger_type', 'lead_no_response')
          .eq('is_active', true);

        for (const automation of (automations || [])) {
          const conditions = automation.trigger_conditions || {};
          if (conditions.days_without_response <= 3) {
            // Executar ações
            const actions = automation.actions || [];
            for (const action of actions) {
              if (action.type === 'create_task') {
                await supabase.from('tasks').insert([{
                  company_id: lead.company_id,
                  assigned_to: lead.assigned_to,
                  created_by: automation.created_by,
                  related_type: 'lead',
                  related_id: lead.id,
                  title: action.title || `Follow-up: ${lead.name}`,
                  description: action.description || 'Lead sem resposta há 3 dias',
                  type: 'follow_up',
                  priority: 'high'
                }]);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Cron inactive leads error:', error);
    }
  });

  console.log('✅ Cron jobs iniciados');
}

module.exports = initCronJobs;
