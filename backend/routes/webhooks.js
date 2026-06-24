const express = require('express');
const router = express.Router();

// Webhook do Stripe
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await req.supabase.from('subscriptions').insert([{
        company_id: session.metadata.company_id,
        plan: session.metadata.plan,
        payment_provider: 'stripe',
        provider_subscription_id: session.subscription,
        provider_customer_id: session.customer,
        amount: session.amount_total / 100,
        status: 'active',
        current_period_start: new Date().toISOString()
      }]);

      await req.supabase.from('companies')
        .update({ plan: session.metadata.plan })
        .eq('id', session.metadata.company_id);
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Webhook do WhatsApp (Evolution API)
router.post('/whatsapp', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.json({ ok: true });

    if (data.event === 'messages.upsert') {
      const message = data.data;
      const phone = message.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

      const { data: leads } = await req.supabase
        .from('leads')
        .select('id, company_id')
        .ilike('phone', `%${phone}%`)
        .is('deleted_at', null)
        .limit(1);

      const lead = leads?.[0];

      if (lead) {
        await req.supabase.from('messages').insert([{
          company_id: lead.company_id,
          lead_id: lead.id,
          sender_type: 'contact',
          contact_phone: phone,
          contact_name: message.pushName || '',
          message_type: message.messageType || 'text',
          content: message.message?.conversation || message.message?.extendedTextMessage?.text || '',
          media_url: message.message?.imageMessage?.url || null,
          is_from_me: false,
          external_id: message.key.id
        }]);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;