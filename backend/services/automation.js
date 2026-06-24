/**
 * NEXTEP CRM - Automation Service
 * Motor de automações visuais
 */

class AutomationService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async evaluateTrigger(triggerType, payload) {
    try {
      const { data: automations } = await this.supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('is_active', true);

      for (const automation of (automations || [])) {
        const conditions = automation.trigger_conditions || {};

        // Verificar condições
        let shouldExecute = true;

        if (conditions.stage_id && payload.stage_id !== conditions.stage_id) {
          shouldExecute = false;
        }

        if (conditions.days_without_response) {
          const lastContact = new Date(payload.last_contact_at);
          const daysDiff = Math.floor((Date.now() - lastContact) / (1000 * 60 * 60 * 24));
          if (daysDiff < conditions.days_without_response) {
            shouldExecute = false;
          }
        }

        if (shouldExecute) {
          await this.executeActions(automation, payload);
        }
      }
    } catch (error) {
      console.error('Automation trigger error:', error);
    }
  }

  async executeActions(automation, payload) {
    const actions = automation.actions || [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_whatsapp':
            // Enviar mensagem via WhatsApp
            await this.sendWhatsAppMessage(action, payload);
            break;

          case 'move_stage':
            // Mover lead de estágio
            await this.supabase
              .from('leads')
              .update({ stage_id: action.stage_id })
              .eq('id', payload.lead_id);
            break;

          case 'create_task':
            // Criar tarefa
            await this.supabase.from('tasks').insert([{
              company_id: automation.company_id,
              assigned_to: action.assigned_to || payload.assigned_to,
              created_by: automation.created_by,
              related_type: 'lead',
              related_id: payload.lead_id,
              title: action.title,
              description: action.description,
              type: action.task_type || 'task',
              due_date: action.due_date
            }]);
            break;

          case 'send_email':
            // Enviar e-mail (implementar com nodemailer)
            break;

          case 'notify_user':
            // Criar notificação
            await this.supabase.from('notifications').insert([{
              company_id: automation.company_id,
              user_id: action.user_id,
              title: action.title,
              message: action.message,
              type: 'info'
            }]);
            break;
        }
      } catch (error) {
        console.error(`Action ${action.type} failed:`, error);

        // Log de erro
        await this.supabase.from('automation_logs').insert([{
          automation_id: automation.id,
          status: 'error',
          details: { action, payload },
          error_message: error.message
        }]);
      }
    }

    // Incrementar contador
    await this.supabase
      .from('automations')
      .update({ 
        run_count: automation.run_count + 1,
        last_run_at: new Date().toISOString()
      })
      .eq('id', automation.id);
  }

  async sendWhatsAppMessage(action, payload) {
    // Integração com Evolution API para envio automático
    const axios = require('axios');

    const { data: instance } = await this.supabase
      .from('whatsapp_instances')
      .select('instance_id')
      .eq('company_id', automation.company_id)
      .eq('status', 'connected')
      .limit(1)
      .single();

    if (instance) {
      await axios.post(
        `${process.env.EVOLUTION_API_URL}/message/sendText/${instance.instance_id}`,
        {
          number: payload.phone,
          text: action.message,
          options: { delay: 1200 }
        },
        { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
      );
    }
  }
}

module.exports = AutomationService;
