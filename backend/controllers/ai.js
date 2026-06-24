/**
 * NEXTEP CRM - AI Controller
 * Inteligência Artificial Integrada (OpenAI)
 * 
 * IMPORTANTE: Este controller funciona COM ou SEM o módulo openai instalado.
 * Se openai não estiver disponível, as rotas retornam 503 com mensagem amigável.
 */

let openai = null;
let OpenAIClass = null;

try {
  const openaiModule = require('openai');
  OpenAIClass = openaiModule.OpenAI;
  if (process.env.OPENAI_API_KEY && OpenAIClass) {
    openai = new OpenAIClass({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (err) {
  // openai não está instalado — isso é NORMAL e esperado
  // O servidor NÃO deve quebrar por causa disso
  console.log('[AI] Módulo openai não disponível. Rotas de IA retornarão 503.');
}

function checkOpenAI() {
  if (!openai) {
    return { 
      error: 'Módulo OpenAI não configurado.',
      hint: 'Instale com: npm install openai, ou configure OPENAI_API_KEY no .env'
    };
  }
  return null;
}

// Responder lead automaticamente
exports.replyLead = async (req, res) => {
  const missing = checkOpenAI();
  if (missing) return res.status(503).json(missing);

  try {
    const { leadId, message } = req.body;
    const supabase = req.supabase;

    const { data: lead } = await supabase
      .from('leads')
      .select('name, interest_type, interest_details, notes, city')
      .eq('id', leadId)
      .eq('company_id', req.user.companyId)
      .single();

    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('messages')
      .eq('lead_id', leadId)
      .eq('company_id', req.user.companyId)
      .single();

    const messages = [
      {
        role: 'system',
        content: `Você é um corretor de imóveis profissional da Nextep CRM. 
        Lead: ${lead.name}, interesse: ${lead.interest_type || 'imóveis'}, cidade: ${lead.city || 'não informada'}.
        Seja cordial, profissional e objetivo. Responda em português do Brasil.`
      },
      ...(conversation?.messages || []).slice(-10),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    const newMessages = [
      ...(conversation?.messages || []),
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: reply, timestamp: new Date().toISOString() }
    ];

    await supabase.from('ai_conversations').upsert([{
      company_id: req.user.companyId,
      lead_id: leadId,
      messages: newMessages,
      updated_at: new Date().toISOString()
    }], { onConflict: 'lead_id' });

    res.json({ reply, tokens_used: completion.usage?.total_tokens });

  } catch (error) {
    console.error('AI reply error:', error);
    res.status(500).json({ error: 'Erro ao gerar resposta' });
  }
};

// Qualificar lead
exports.qualifyLead = async (req, res) => {
  const missing = checkOpenAI();
  if (missing) return res.status(503).json(missing);

  try {
    const { leadId } = req.params;
    const supabase = req.supabase;

    const { data: lead } = await supabase
      .from('leads')
      .select('name, phone, email, interest_type, budget_min, budget_max, source, notes, city, state')
      .eq('id', leadId)
      .eq('company_id', req.user.companyId)
      .single();

    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const prompt = `Analise este lead de imobiliária e forneça uma qualificação:

Nome: ${lead.name}
Telefone: ${lead.phone}
Email: ${lead.email}
Interesse: ${lead.interest_type}
Orçamento: R$ ${lead.budget_min || 'N/A'} - R$ ${lead.budget_max || 'N/A'}
Origem: ${lead.source}
Cidade: ${lead.city}, ${lead.state}
Observações: ${lead.notes || 'Nenhuma'}

Forneça em JSON:
{
  "score": 0-100,
  "qualification": "hot|warm|cold",
  "reasoning": "explicação",
  "suggested_actions": ["ação 1", "ação 2"],
  "estimated_budget": "estimativa"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 800
    });

    const result = JSON.parse(completion.choices[0].message.content);

    await supabase
      .from('leads')
      .update({ score: result.score, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    await supabase.from('ai_conversations').upsert([{
      company_id: req.user.companyId,
      lead_id: leadId,
      lead_score: result.score,
      suggested_actions: result.suggested_actions,
      updated_at: new Date().toISOString()
    }], { onConflict: 'lead_id' });

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: 'Erro ao qualificar lead' });
  }
};

// Resumir conversa
exports.summarizeConversation = async (req, res) => {
  const missing = checkOpenAI();
  if (missing) return res.status(503).json(missing);

  try {
    const { leadId } = req.params;
    const supabase = req.supabase;

    const { data: messages } = await supabase
      .from('messages')
      .select('content, is_from_me, created_at')
      .eq('lead_id', leadId)
      .eq('company_id', req.user.companyId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return res.json({ summary: 'Nenhuma conversa encontrada.' });
    }

    const conversationText = messages.map(m => 
      `${m.is_from_me ? 'Corretor' : 'Lead'}: ${m.content}`
    ).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Resuma a seguinte conversa de WhatsApp entre corretor e lead de imobiliária. Destaque pontos importantes, interesses manifestados e próximos passos sugeridos:\n\n${conversationText}`
      }],
      max_tokens: 500
    });

    const summary = completion.choices[0].message.content;

    await supabase.from('ai_conversations').upsert([{
      company_id: req.user.companyId,
      lead_id: leadId,
      summary,
      updated_at: new Date().toISOString()
    }], { onConflict: 'lead_id' });

    res.json({ summary });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao resumir conversa' });
  }
};

// Gerar follow-up
exports.generateFollowUp = async (req, res) => {
  const missing = checkOpenAI();
  if (missing) return res.status(503).json(missing);

  try {
    const { leadId } = req.body;
    const supabase = req.user.companyId;

    const { data: lead } = await req.supabase
      .from('leads')
      .select('name, interest_type, last_contact_at, status')
      .eq('id', leadId)
      .eq('company_id', req.user.companyId)
      .single();

    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const daysSinceContact = lead.last_contact_at 
      ? Math.floor((Date.now() - new Date(lead.last_contact_at)) / (1000 * 60 * 60 * 24))
      : 'nunca';

    const prompt = `Gere uma mensagem de follow-up profissional para WhatsApp para o lead ${lead.name}.
    Último contato: ${daysSinceContact} dias atrás.
    Interesse: ${lead.interest_type || 'imóveis'}.
    Status: ${lead.status}.
    Mensagem curta, pessoal, com call-to-action.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300
    });

    res.json({ 
      message: completion.choices[0].message.content,
      days_since_contact: daysSinceContact
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar follow-up' });
  }
};
