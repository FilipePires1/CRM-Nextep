/**
 * NEXTEP CRM - Billing Controller
 * Assinaturas e Pagamentos
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.getSubscription = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ subscription: subscription || null, invoices: invoices || [] });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
};

exports.createCheckout = async (req, res) => {
  try {
    const { plan } = req.body;
    const companyId = req.user.companyId;

    const plans = {
      basic: { price_id: 'price_basic', amount: 9700 }, // R$ 97,00
      professional: { price_id: 'price_professional', amount: 29700 }, // R$ 297,00
      enterprise: { price_id: 'price_enterprise', amount: 99700 } // R$ 997,00
    };

    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plano inválido' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: `Nextep CRM - Plano ${plan.toUpperCase()}` },
          unit_amount: selectedPlan.amount,
          recurring: { interval: 'month' }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: { company_id: companyId, plan }
    });

    res.json({ sessionId: session.id, url: session.url });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Erro ao criar checkout' });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('provider_subscription_id')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (subscription?.provider_subscription_id) {
      await stripe.subscriptions.cancel(subscription.provider_subscription_id);
    }

    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', cancel_at_period_end: true })
      .eq('company_id', companyId);

    res.json({ message: 'Assinatura cancelada' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
};

exports.upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const companyId = req.user.companyId;

    // Atualizar plano na empresa
    const limits = {
      basic: { max_users: 2, max_whatsapp: 1, max_leads: 500, api_enabled: false },
      professional: { max_users: 10, max_whatsapp: 3, max_leads: 999999, api_enabled: false },
      enterprise: { max_users: 999, max_whatsapp: 999, max_leads: 999999, api_enabled: true }
    };

    await req.supabase
      .from('companies')
      .update({ plan, ...limits[plan], updated_at: new Date().toISOString() })
      .eq('id', companyId);

    res.json({ message: 'Plano atualizado com sucesso' });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
};
