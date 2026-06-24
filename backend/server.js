/**
 * NEXTEP CRM - SERVIDOR PRINCIPAL
 * SaaS Multi-Tenant para Imobiliárias
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Configurações
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Criar app Express
const app = express();

// Middlewares globais
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", process.env.SUPABASE_URL],
    },
  },
}));

const origensPermitidas = [
  process.env.FRONTEND_URL || 'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origensPermitidas.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-ID']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Disponibilizar supabase em req
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// ============================================================
// ROTAS
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: NODE_ENV
  });
});

// Auth
app.use('/api/auth', require('./routes/auth'));

// Dashboard
app.use('/api/dashboard', require('./routes/dashboard'));

// Leads
app.use('/api/leads', require('./routes/leads'));

// Clients
app.use('/api/clients', require('./routes/clients'));

// Properties
app.use('/api/properties', require('./routes/properties'));

// Pipeline
app.use('/api/pipeline', require('./routes/pipeline'));

// Tasks
app.use('/api/tasks', require('./routes/tasks'));

// Events/Calendar
app.use('/api/events', require('./routes/events'));

// WhatsApp
app.use('/api/whatsapp', require('./routes/whatsapp'));

// Messages
app.use('/api/messages', require('./routes/messages'));

// Documents
app.use('/api/documents', require('./routes/documents'));

// Automations
app.use('/api/automations', require('./routes/automations'));

// AI
app.use('/api/ai', require('./routes/ai'));

// Reports
app.use('/api/reports', require('./routes/reports'));

// Settings
app.use('/api/settings', require('./routes/settings'));

// Super Admin
app.use('/api/admin', require('./routes/admin'));

// Subscriptions/Billing
app.use('/api/billing', require('./routes/billing'));

// Webhooks (Stripe, MP, Asaas, WhatsApp)
app.use('/api/webhooks', require('./routes/webhooks'));

// Uploads
app.use('/api/upload', require('./routes/upload'));

// ============================================================
// SERVIR FRONTEND EM PRODUÇÃO
// ============================================================
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = NODE_ENV === 'production' 
    ? 'Erro interno do servidor' 
    : err.message;

  res.status(statusCode).json({
    error: true,
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 NEXTEP CRM Server`);
  console.log(`   Modo: ${NODE_ENV}`);
  console.log(`   Porta: ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
