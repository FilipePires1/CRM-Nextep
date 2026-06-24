/**
 * NEXTEP CRM - WhatsApp Controller
 * Integração com Evolution API v2
 */

const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

const evolutionClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: { 'apikey': EVOLUTION_API_KEY },
  timeout: 30000
});

// Listar instâncias da empresa
exports.listInstances = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: instances, error } = await supabase
      .from('whatsapp_instances')
      .select(`
        *,
        created_by:created_by (id, name)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Verificar status real na Evolution API
    const instancesWithStatus = await Promise.all(
      (instances || []).map(async (instance) => {
        try {
          const { data: status } = await evolutionClient.get(
            `/instance/connectionState/${instance.instance_id}`
          );
          return { ...instance, connection_status: status?.instance?.state || 'unknown' };
        } catch {
          return { ...instance, connection_status: 'error' };
        }
      })
    );

    res.json(instancesWithStatus);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar instâncias' });
  }
};

// Criar nova instância
exports.createInstance = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const { name } = req.body;

    // Verificar limite do plano
    const { data: company } = await supabase
      .from('companies')
      .select('max_whatsapp')
      .eq('id', companyId)
      .single();

    const { count: currentInstances } = await supabase
      .from('whatsapp_instances')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (currentInstances >= company.max_whatsapp) {
      return res.status(403).json({ 
        error: 'Limite de WhatsApps atingido',
        limit: company.max_whatsapp
      });
    }

    // Criar na Evolution API
    const instanceName = `nextep_${companyId}_${Date.now()}`;
    const { data: evoInstance } = await evolutionClient.post('/instance/create', {
      instanceName,
      token: '',
      qrcode: true,
      number: '',
      integration: 'WHATSAPP-BAILEYS',
      webhook: `${process.env.API_URL}/api/webhooks/whatsapp`,
      webhook_by_events: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
    });

    // Salvar no banco
    const { data: instance, error } = await supabase
      .from('whatsapp_instances')
      .insert([{
        company_id: companyId,
        name: name || instanceName,
        instance_id: evoInstance.instance.instanceName,
        status: 'connecting',
        created_by: req.user.userId,
        webhook_enabled: true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      message: 'Instância criada. Escaneie o QR Code para conectar.',
      instance,
      qr_required: true
    });

  } catch (error) {
    console.error('Create instance error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao criar instância WhatsApp' });
  }
};

// Obter QR Code
exports.getQRCode = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_id')
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .single();

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const { data: qrData } = await evolutionClient.get(
      `/instance/connect/${instance.instance_id}`
    );

    res.json({
      qr_code: qrData?.base64,
      status: qrData?.state
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter QR Code' });
  }
};

// Enviar mensagem
exports.sendMessage = async (req, res) => {
  try {
    const { instanceId, phone, message, type = 'text', mediaUrl, caption } = req.body;
    const supabase = req.supabase;

    // Verificar instância pertence à empresa
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, status')
      .eq('id', instanceId)
      .eq('company_id', req.user.companyId)
      .single();

    if (!instance || instance.status !== 'connected') {
      return res.status(400).json({ error: 'Instância não conectada' });
    }

    const formattedPhone = phone.replace(/\D/g, '');
    let payload;

    switch (type) {
      case 'text':
        payload = {
          number: formattedPhone,
          text: message,
          options: { delay: 1200 }
        };
        await evolutionClient.post(`/message/sendText/${instance.instance_id}`, payload);
        break;

      case 'image':
        payload = {
          number: formattedPhone,
          caption: caption || message,
          media: mediaUrl
        };
        await evolutionClient.post(`/message/sendMedia/${instance.instance_id}`, payload);
        break;

      case 'document':
        payload = {
          number: formattedPhone,
          caption: caption || '',
          media: mediaUrl,
          fileName: caption || 'documento.pdf'
        };
        await evolutionClient.post(`/message/sendMedia/${instance.instance_id}`, payload);
        break;

      default:
        return res.status(400).json({ error: 'Tipo de mensagem não suportado' });
    }

    // Salvar mensagem no banco
    await supabase.from('messages').insert([{
      company_id: req.user.companyId,
      whatsapp_instance_id: instanceId,
      sender_type: 'user',
      sender_id: req.user.userId,
      contact_phone: formattedPhone,
      message_type: type,
      content: message,
      media_url: mediaUrl,
      caption,
      is_from_me: true
    }]);

    res.json({ message: 'Mensagem enviada com sucesso' });

  } catch (error) {
    console.error('Send message error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};

// Desconectar instância
exports.logout = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_id')
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .single();

    if (instance) {
      await evolutionClient.delete(`/instance/logout/${instance.instance_id}`);
      await supabase
        .from('whatsapp_instances')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    res.json({ message: 'Instância desconectada' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
};

// Deletar instância
exports.deleteInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_id')
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .single();

    if (instance) {
      await evolutionClient.delete(`/instance/delete/${instance.instance_id}`);
      await supabase
        .from('whatsapp_instances')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    }

    res.json({ message: 'Instância removida' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover instância' });
  }
};

// Configurar IA da instância
exports.configureAI = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, prompt } = req.body;
    const supabase = req.supabase;

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .update({ 
        ai_enabled: enabled, 
        ai_prompt: prompt,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    // Configurar chatbot na Evolution API
    if (enabled) {
      await evolutionClient.post(`/chatbot/${instance.instance_id}`, {
        enabled: true,
        type: 'openai',
        openai: {
          model: 'gpt-4',
          system_prompt: prompt || 'Você é um assistente de uma imobiliária. Seja cordial e profissional.',
          max_tokens: 500,
          temperature: 0.7
        }
      });
    } else {
      await evolutionClient.delete(`/chatbot/${instance.instance_id}`);
    }

    res.json({ message: 'Configuração de IA atualizada', instance });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao configurar IA' });
  }
};
