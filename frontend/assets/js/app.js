// NEXTEP CRM - Aplicação Principal
// SPA Vanilla JS com todas as funcionalidades

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const fmtMoney = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : 'R$ 0';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR') : '-';
const fmtPhone = (p) => p ? p.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : '-';
const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Toast
function toast(msg, type = 'success') {
  const c = $('#toast-container');
  const t = document.createElement('div');
  t.className = `nx-toast ${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'exclamation-triangle';
  t.innerHTML = `<i class="bi bi-${icon}"></i> <span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 300); }, 4000);
}

// Modal
function openModal(id) { $(`#${id}`).classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $(`#${id}`).classList.remove('active'); document.body.style.overflow = ''; }
$$('[data-close]').forEach(b => b.addEventListener('click', () => {
  const m = b.closest('.nx-modal-overlay');
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}));

// Page navigation
function showPage(pageId) {
  $$('.nx-page').forEach(p => p.classList.remove('active'));
  $$('.nx-nav-link').forEach(l => l.classList.remove('active'));
  const page = $(`#page-${pageId}`);
  if (page) page.classList.add('active');
  const nav = $(`.nx-nav-link[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

async function initAuth() {
  const token = localStorage.getItem('nx_token');
  if (!token) { showAuth(); return; }
  try {
    const res = await api.me();
    if (!res?.user) { showAuth(); return; }
    api.user = res.user;
    showApp(res.user);
  } catch {
    showAuth();
  }
}

function showAuth() {
  $('#auth-screen').classList.remove('d-none');
  $('#app-layout').classList.add('d-none');
}

function showApp(user) {
  $('#auth-screen').classList.add('d-none');
  $('#app-layout').classList.remove('d-none');

  const name = user.name || user.email;
  $('#sidebar-user-name').textContent = name;
  $('#topbar-name').textContent = name;
  $('#sidebar-user-role').textContent = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Corretor';
  $('#user-avatar-initial').textContent = initials(name);
  $('#topbar-avatar').textContent = initials(name);

  if (user.role === 'super_admin') {
    $$('.admin-only').forEach(el => el.classList.remove('d-none'));
  }

  const savedTheme = localStorage.getItem('nx_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  $('#theme-label').textContent = savedTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro';

  loadDashboard();
}

// Login
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite"></i> Entrando...';
  try {
    const res = await api.login($('#login-email').value, $('#login-password').value);
    if (res.error) {
      toast(res.error, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar';
      return;
    }
    api.setSession(res);
    showApp(res.user);
    toast('Bem-vindo ao Nextep CRM!');
  } catch (err) {
    try { const parsed = JSON.parse(err.message); toast(parsed.error || 'Erro ao entrar', 'error'); }
    catch { toast('Erro ao entrar. Verifique suas credenciais.', 'error'); }
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Entrar';
  }
});

// Register
$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#register-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite"></i> Criando...';
  const plan = document.querySelector('input[name="plan"]:checked')?.value || 'basic';
  const res = await api.register({
    companyName: $('#reg-company-name').value,
    companyEmail: $('#reg-company-email').value,
    companyPhone: $('#reg-company-phone').value,
    adminName: $('#reg-admin-name').value,
    adminEmail: $('#reg-admin-email').value,
    adminPassword: $('#reg-admin-password').value,
    plan
  });
  if (res.error) {
    toast(res.error, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-circle"></i> Criar Conta';
    return;
  }
  api.setSession(res);
  showApp(res.user);
  toast('Conta criada com sucesso!');
});

$('#show-register').addEventListener('click', () => {
  $('#login-panel').classList.add('d-none');
  $('#register-panel').classList.remove('d-none');
});
$('#show-login').addEventListener('click', () => {
  $('#register-panel').classList.add('d-none');
  $('#login-panel').classList.remove('d-none');
});

$$('input[name="plan"]').forEach(r => {
  r.addEventListener('change', () => {
    $$('.nx-plan-card').forEach(c => c.classList.remove('active'));
    const card = $(`#plan-${r.value}`);
    if (card) card.classList.add('active');
  });
});
$('#plan-basic').classList.add('active');

$('#logout-btn').addEventListener('click', () => api.logout());

$('#theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nx_theme', next);
  $('#theme-label').textContent = next === 'dark' ? 'Modo Claro' : 'Modo Escuro';
});

$('#menu-toggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
  $('#sidebar-overlay').style.display = $('#sidebar').classList.contains('open') ? 'block' : 'none';
});
$('#sidebar-overlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('open');
  $('#sidebar-overlay').style.display = 'none';
});

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════

$$('.nx-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    const page = link.dataset.page;
    showPage(page);
    if (page === 'dashboard') loadDashboard();
    if (page === 'pipeline') loadPipeline();
    if (page === 'leads') loadLeads();
    if (page === 'clients') loadClients();
    if (page === 'properties') loadProperties();
    if (page === 'tasks') loadTasks();
    if (page === 'calendar') loadCalendar();
    if (page === 'whatsapp') loadWhatsApp();
    if (page === 'admin') loadAdmin();
    if (page === 'automations') loadAutomations();
    if (page === 'reports') { const e = new Date(); const s = new Date(); s.setMonth(s.getMonth()-1); }
    if (page === 'settings') loadSettings();
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').style.display = 'none';
  });
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

let leadsChart, sourceChart;

async function loadDashboard() {
  try {
    const data = await api.getDashboard();
    if (!data) return;

    const m = data.metrics || {};
    $('#stat-leads').textContent = m.total_leads || 0;
    $('#stat-clients').textContent = m.total_clients || 0;
    $('#stat-properties').textContent = m.total_properties || 0;
    $('#stat-sales').textContent = fmtMoney(m.total_sales || 0);
    $('#stat-conversion').innerHTML = `<i class="bi bi-arrow-up-short"></i> ${m.conversion_rate || 0}% conversão`;

    renderCharts(data);

    const tasksContainer = $('#today-tasks');
    if (data.todayTasks?.length) {
      tasksContainer.innerHTML = data.todayTasks.map(t => `
        <div style="padding:12px 20px;border-bottom:1px solid var(--nx-border-light);display:flex;align-items:center;gap:12px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${t.priority === 'urgent' ? 'var(--nx-danger)' : t.priority === 'high' ? 'var(--nx-warning)' : 'var(--nx-primary)'};flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-weight:500;font-size:0.875rem;">${t.title}</div>
            <div style="font-size:0.75rem;color:var(--nx-text-muted);">${t.type === 'call' ? 'Ligação' : t.type === 'visit' ? 'Visita' : 'Tarefa'} • ${fmtDateTime(t.due_date)}</div>
          </div>
          <span class="nx-badge nx-badge-${t.status === 'completed' ? 'green' : t.status === 'overdue' ? 'red' : 'amber'}">${t.status === 'completed' ? 'Concluída' : t.status === 'overdue' ? 'Atrasada' : 'Pendente'}</span>
        </div>
      `).join('');
    }

    const eventsContainer = $('#today-events');
    if (data.todayEvents?.length) {
      eventsContainer.innerHTML = data.todayEvents.map(e => `
        <div style="padding:12px 20px;border-bottom:1px solid var(--nx-border-light);display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:var(--nx-radius-sm);background:var(--nx-primary-light);color:var(--nx-green-700);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-calendar-event"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:500;font-size:0.875rem;">${e.title}</div>
            <div style="font-size:0.75rem;color:var(--nx-text-muted);">${fmtDateTime(e.start_at)}${e.location ? ` • ${e.location}` : ''}</div>
          </div>
        </div>
      `).join('');
    }

    if (data.unreadNotifications?.length) {
      $('#notif-dot').classList.remove('d-none');
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderCharts(data) {
  const ctx1 = $('#leads-chart');
  const ctx2 = $('#source-chart');
  if (!ctx1 || !ctx2) return;
  if (leadsChart) leadsChart.destroy();
  if (sourceChart) sourceChart.destroy();

  const months = data.leadsByMonth || [];
  leadsChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: months.map(m => { const [y, mo] = m.month.split('-'); return `${mo}/${y}`; }),
      datasets: [{
        label: 'Leads',
        data: months.map(m => m.total),
        backgroundColor: 'var(--nx-primary)',
        borderRadius: 4,
        barThickness: 24
      }, {
        label: 'Convertidos',
        data: months.map(m => m.converted),
        backgroundColor: 'var(--nx-green-300)',
        borderRadius: 4,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'var(--nx-border-light)' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });

  const sources = data.leadsBySource || {};
  const sourceLabels = Object.keys(sources);
  const sourceValues = Object.values(sources);
  const colors = ['var(--nx-primary)', 'var(--nx-info)', 'var(--nx-warning)', 'var(--nx-danger)', 'var(--nx-slate-400)', 'var(--nx-green-300)'];
  sourceChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: sourceLabels,
      datasets: [{ data: sourceValues, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } }
    }
  });
}

$('#chart-period').addEventListener('change', async (e) => {
  const data = await api.getCharts(e.target.value);
  if (data) renderCharts({ leadsByMonth: data.leads, leadsBySource: {} });
});

// ═══════════════════════════════════════════════════════════
// PIPELINE (KANBAN)
// ═══════════════════════════════════════════════════════════

let pipelineStages = [];
let draggedLead = null;

async function loadPipeline() {
  const stages = await api.getStages();
  if (!stages) return;
  pipelineStages = stages;

  const board = $('#kanban-board');
  board.innerHTML = stages.map(s => `
    <div class="nx-kanban-col" data-stage="${s.id}">
      <div class="nx-kanban-header">
        <div class="nx-kanban-title">
          <span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block;"></span>
          ${s.name}
        </div>
        <span class="nx-kanban-count">${s.lead_count || 0}</span>
      </div>
      <div class="nx-kanban-body" data-stage-id="${s.id}" ondragover="allowDrop(event)" ondrop="handleDrop(event, '${s.id}')">
        <div class="nx-skeleton" style="height:80px;margin-bottom:8px;"></div>
        <div class="nx-skeleton" style="height:80px;margin-bottom:8px;"></div>
      </div>
    </div>
  `).join('');

  for (const stage of stages) {
    const leads = await api.getStageLeads(stage.id);
    const body = $(`.nx-kanban-body[data-stage-id="${stage.id}"]`);
    if (!body) continue;
    if (!leads?.length) {
      body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--nx-text-muted);font-size:0.8rem;">Nenhum lead</div>`;
      continue;
    }
    body.innerHTML = leads.map(l => `
      <div class="nx-kanban-card" draggable="true" data-lead="${l.id}" ondragstart="handleDragStart(event, '${l.id}')" ondragend="handleDragEnd(event)">
        <div class="nx-kanban-card-title">${l.name}</div>
        <div class="nx-kanban-card-meta"><i class="bi bi-telephone" style="font-size:0.7rem;"></i> ${fmtPhone(l.phone)}</div>
        ${l.budget_max ? `<div style="font-size:0.8rem;font-weight:600;color:var(--nx-primary);margin-top:4px;">${fmtMoney(l.budget_max)}</div>` : ''}
        <div class="nx-kanban-card-footer">
          <div class="nx-kanban-card-avatars">
            <div class="nx-avatar-sm" title="${l.assigned?.name || 'Não atribuído'}">${initials(l.assigned?.name || '?')}</div>
          </div>
          <span class="nx-badge nx-badge-${l.priority === 'urgent' ? 'red' : l.priority === 'high' ? 'amber' : 'gray'}" style="font-size:0.65rem;">
            ${l.priority === 'urgent' ? 'Urgente' : l.priority === 'high' ? 'Alta' : 'Normal'}
          </span>
        </div>
      </div>
    `).join('');
  }
}

function handleDragStart(e, leadId) { draggedLead = leadId; e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function handleDragEnd(e) { e.target.classList.remove('dragging'); draggedLead = null; $$('.nx-kanban-body').forEach(b => b.classList.remove('drag-over')); }
function allowDrop(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
async function handleDrop(e, stageId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedLead) return;
  const res = await api.moveLead(draggedLead, stageId);
  if (res?.message) { toast('Lead movido com sucesso'); loadPipeline(); }
}

$('#pipeline-refresh').addEventListener('click', loadPipeline);

// ═══════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════

let currentLeadsPage = 1;

async function loadLeads(page = 1) {
  currentLeadsPage = page;
  const res = await api.getLeads({ page, limit: 20 });
  if (!res) return;

  const tbody = $('#leads-table tbody');
  tbody.innerHTML = (res.data || []).map(l => `
    <tr class="nx-clickable-row" onclick="editLead('${l.id}')" style="cursor:pointer;">
      <td>
        <div class="nx-avatar-td">
          <div class="nx-avatar-sm">${initials(l.name)}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem;">${l.name}</div>
            <div style="font-size:0.75rem;color:var(--nx-text-muted);">${l.email || '-'}</div>
          </div>
        </div>
      </td>
      <td>${fmtPhone(l.phone)}</td>
      <td><span class="nx-badge nx-badge-gray">${l.interest_type || '-'}</span></td>
      <td>${l.source || '-'}</td>
      <td>${l.assigned?.name || '-'}</td>
      <td><span class="nx-badge nx-badge-${l.status === 'converted' ? 'green' : l.status === 'lost' ? 'red' : 'blue'}">${l.status || 'Novo'}</span></td>
      <td><span class="nx-badge nx-badge-${l.priority === 'urgent' ? 'red' : l.priority === 'high' ? 'amber' : 'gray'}">${l.priority || 'Normal'}</span></td>
      <td style="white-space:nowrap;" onclick="event.stopPropagation()">
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="editLead('${l.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="deleteLead('${l.id}')" title="Excluir" style="color:var(--nx-danger);"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  renderPagination('leads-pagination', res.pagination, loadLeads);
}

function renderPagination(id, pag, callback) {
  const el = $(`#${id}`);
  if (!el || !pag) return;
  const { page, totalPages } = pag;
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === page ? 'active' : ''}" onclick="(${callback.name})(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

$('#btn-new-lead').addEventListener('click', () => openLeadModal());
$('#btn-new-lead-2').addEventListener('click', () => openLeadModal());

function openLeadModal(lead = null) {
  $('#lead-modal-title').textContent = lead ? 'Editar Lead' : 'Novo Lead';
  $('#lead-id').value = lead?.id || '';
  const form = $('#lead-form');
  if (lead) {
    form.querySelector('[name="name"]').value = lead.name || '';
    form.querySelector('[name="phone"]').value = lead.phone || '';
    form.querySelector('[name="whatsapp"]').value = lead.whatsapp || '';
    form.querySelector('[name="email"]').value = lead.email || '';
    form.querySelector('[name="cpf"]').value = lead.cpf || '';
    form.querySelector('[name="city"]').value = lead.city || '';
    form.querySelector('[name="interest_type"]').value = lead.interest_type || '';
    form.querySelector('[name="source"]').value = lead.source || '';
    form.querySelector('[name="budget_min"]').value = lead.budget_min || '';
    form.querySelector('[name="budget_max"]').value = lead.budget_max || '';
    form.querySelector('[name="notes"]').value = lead.notes || '';
  } else {
    form.reset();
    $('#lead-id').value = '';
  }
  openModal('modal-lead');
}

$('#save-lead-btn').addEventListener('click', async () => {
  const form = $('#lead-form');
  const data = Object.fromEntries(new FormData(form));
  const id = $('#lead-id').value;
  const res = id ? await api.updateLead(id, data) : await api.createLead(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Lead atualizado!' : 'Lead criado!');
  closeModal('modal-lead');
  loadLeads(currentLeadsPage);
  if ($('#page-pipeline').classList.contains('active')) loadPipeline();
});

async function editLead(id) {
  const lead = await api.getLead(id);
  if (lead) openLeadModal(lead);
}

async function deleteLead(id) {
  if (!confirm('Tem certeza que deseja excluir este lead?')) return;
  const res = await api.deleteLead(id);
  if (res?.message) { toast('Lead excluído'); loadLeads(currentLeadsPage); }
}

// ═══════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════

let currentClientsPage = 1;

async function loadClients(page = 1) {
  currentClientsPage = page;
  const res = await api.getClients({ page, limit: 20 });
  if (!res) return;

  const tbody = $('#clients-table tbody');
  tbody.innerHTML = (res.data || []).map(c => `
    <tr class="nx-clickable-row" onclick="viewClient('${c.id}')" style="cursor:pointer;">
      <td>
        <div class="nx-avatar-td">
          <div class="nx-avatar-sm">${initials(c.name)}</div>
          <div style="font-weight:600;">${c.name}</div>
        </div>
      </td>
      <td>${fmtPhone(c.phone)}</td>
      <td>${c.cpf || '-'}</td>
      <td>${c.city || '-'}</td>
      <td>${c.assigned?.name || '-'}</td>
      <td><span class="nx-badge nx-badge-${c.status === 'active' ? 'green' : 'gray'}">${c.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
      <td style="white-space:nowrap;" onclick="event.stopPropagation()">
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="editClient('${c.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="deleteClient('${c.id}')" title="Excluir" style="color:var(--nx-danger);"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  renderPagination('clients-pagination', res.pagination, loadClients);
}

$('#btn-new-client').addEventListener('click', () => openClientModal());

function openClientModal(client = null) {
  $('#client-modal-title').textContent = client ? 'Editar Cliente' : 'Novo Cliente';
  $('#client-id').value = client?.id || '';
  const form = $('#client-form');
  if (client) {
    form.querySelector('[name="name"]').value = client.name || '';
    form.querySelector('[name="phone"]').value = client.phone || '';
    form.querySelector('[name="whatsapp"]').value = client.whatsapp || '';
    form.querySelector('[name="email"]').value = client.email || '';
    form.querySelector('[name="cpf"]').value = client.cpf || '';
    form.querySelector('[name="birth_date"]').value = client.birth_date ? client.birth_date.substring(0,10) : '';
    form.querySelector('[name="profession"]').value = client.profession || '';
    form.querySelector('[name="income"]').value = client.income || '';
    form.querySelector('[name="address"]').value = client.address || '';
    form.querySelector('[name="city"]').value = client.city || '';
    form.querySelector('[name="state"]').value = client.state || '';
    form.querySelector('[name="cep"]').value = client.cep || '';
    form.querySelector('[name="notes"]').value = client.notes || '';
  } else {
    form.reset();
    $('#client-id').value = '';
  }
  openModal('modal-client');
}

$('#save-client-btn').addEventListener('click', async () => {
  const form = $('#client-form');
  const data = Object.fromEntries(new FormData(form));
  const id = $('#client-id').value;
  const res = id ? await api.updateClient(id, data) : await api.createClient(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Cliente atualizado!' : 'Cliente criado!');
  closeModal('modal-client');
  loadClients(currentClientsPage);
});

async function editClient(id) {
  const client = await api.getClient(id);
  if (client) openClientModal(client);
}

async function viewClient(id) {
  const client = await api.getClient(id);
  if (!client) return;
  openClientModal(client);
}

async function deleteClient(id) {
  if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
  const res = await api.deleteClient(id);
  if (res?.message) { toast('Cliente excluído'); loadClients(currentClientsPage); }
}

// ═══════════════════════════════════════════════════════════
// PROPERTIES
// ═══════════════════════════════════════════════════════════

let currentPropsPage = 1;

async function loadProperties(page = 1) {
  currentPropsPage = page;
  const params = { page, limit: 12 };
  const type = $('#prop-filter-type').value;
  const city = $('#prop-filter-city').value;
  const min = $('#prop-filter-min').value;
  const max = $('#prop-filter-max').value;
  if (type) params.type = type;
  if (city) params.city = city;
  if (min) params.min_price = min;
  if (max) params.max_price = max;

  const res = await api.getProperties(params);
  if (!res) return;

  const grid = $('#properties-grid');
  grid.innerHTML = (res.data || []).map(p => {
    const cover = (p.photos && p.photos.length) ? p.photos[0] : null;
    return `
    <div class="nx-property-card">
      <div class="nx-property-img" style="${cover ? `background-image:url('${cover}');background-size:cover;background-position:center;` : ''}">
        ${cover ? '' : '<i class="bi bi-house-door"></i>'}
        <span class="nx-badge nx-badge-green" style="position:absolute;top:12px;left:12px;">${p.transaction_type === 'sale' ? 'Venda' : p.transaction_type === 'rent' ? 'Aluguel' : 'Venda/Aluguel'}</span>
        ${p.photos?.length ? `<span class="nx-badge nx-badge-gray" style="position:absolute;top:12px;right:12px;"><i class="bi bi-images"></i> ${p.photos.length}</span>` : ''}
      </div>
      <div class="nx-property-body">
        <div class="nx-property-price">${fmtMoney(p.price)}</div>
        <div class="nx-property-title">${p.title}</div>
        <div class="nx-property-location"><i class="bi bi-geo-alt"></i> ${p.neighborhood || ''}, ${p.city || ''}</div>
        <div class="nx-property-features">
          ${p.bedrooms ? `<div class="nx-property-feature"><i class="bi bi-bed"></i> ${p.bedrooms}</div>` : ''}
          ${p.bathrooms ? `<div class="nx-property-feature"><i class="bi bi-droplet"></i> ${p.bathrooms}</div>` : ''}
          ${p.area_util ? `<div class="nx-property-feature"><i class="bi bi-arrows-angle-expand"></i> ${p.area_util}m²</div>` : ''}
        </div>
        <div class="nx-property-actions-row">
          <button class="nx-btn-icon nx-btn-icon-lg" onclick="editProperty('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
          <button class="nx-btn-icon nx-btn-icon-lg" onclick="deleteProperty('${p.id}')" title="Excluir" style="color:var(--nx-danger);"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>
  `;}).join('');

  renderPagination('properties-pagination', res.pagination, loadProperties);
}

$('#prop-filter-btn').addEventListener('click', () => loadProperties(1));

$('#btn-new-property').addEventListener('click', () => openPropertyModal());

let currentPropertyPhotos = [];

function openPropertyModal(property = null) {
  $('#property-modal-title').textContent = property ? 'Editar Imóvel' : 'Novo Imóvel';
  $('#property-id').value = property?.id || '';
  const form = $('#property-form');
  currentPropertyPhotos = property?.photos ? [...property.photos] : [];
  if (property) {
    form.querySelector('[name="title"]').value = property.title || '';
    form.querySelector('[name="type"]').value = property.type || '';
    form.querySelector('[name="transaction_type"]').value = property.transaction_type || '';
    form.querySelector('[name="price"]').value = property.price || '';
    form.querySelector('[name="address"]').value = property.address || '';
    form.querySelector('[name="neighborhood"]').value = property.neighborhood || '';
    form.querySelector('[name="city"]').value = property.city || '';
    form.querySelector('[name="state"]').value = property.state || '';
    form.querySelector('[name="cep"]').value = property.cep || '';
    form.querySelector('[name="area_util"]').value = property.area_util || '';
    form.querySelector('[name="area_total"]').value = property.area_total || '';
    form.querySelector('[name="bedrooms"]').value = property.bedrooms || '';
    form.querySelector('[name="bathrooms"]').value = property.bathrooms || '';
    form.querySelector('[name="suites"]').value = property.suites || '';
    form.querySelector('[name="parking_spots"]').value = property.parking_spots || '';
    form.querySelector('[name="description"]').value = property.description || '';
    form.querySelector('[name="notes"]').value = property.notes || '';
  } else {
    form.reset();
    $('#property-id').value = '';
  }
  $('#property-photos-input').value = '';
  renderPropertyPhotosPreview();
  openModal('modal-property');
}

function renderPropertyPhotosPreview() {
  const container = $('#property-photos-preview');
  container.innerHTML = currentPropertyPhotos.map((url, i) => `
    <div style="position:relative;width:80px;height:80px;border-radius:var(--nx-radius-sm);overflow:hidden;border:1px solid var(--nx-border);">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;">
      <button type="button" onclick="removePropertyPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.7rem;line-height:1;">
        <i class="bi bi-x"></i>
      </button>
    </div>
  `).join('');
}

function removePropertyPhoto(index) {
  currentPropertyPhotos.splice(index, 1);
  renderPropertyPhotosPreview();
}

$('#property-photos-input').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  const preview = $('#property-photos-preview');
  for (const file of files) {
    try {
      const res = await api.uploadFile(file);
      if (res?.url) {
        currentPropertyPhotos.push(res.url);
        renderPropertyPhotosPreview();
      } else {
        toast(res?.error || 'Erro ao enviar foto', 'error');
      }
    } catch {
      toast('Erro ao enviar foto', 'error');
    }
  }
  e.target.value = '';
});

$('#save-property-btn').addEventListener('click', async () => {
  const form = $('#property-form');
  const data = Object.fromEntries(new FormData(form));
  data.photos = currentPropertyPhotos;
  const id = $('#property-id').value;
  const res = id ? await api.updateProperty(id, data) : await api.createProperty(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Imóvel atualizado!' : 'Imóvel cadastrado!');
  closeModal('modal-property');
  loadProperties(currentPropsPage);
});

async function editProperty(id) {
  const property = await api.getProperty(id);
  if (property) openPropertyModal(property);
}

async function deleteProperty(id) {
  if (!confirm('Tem certeza que deseja excluir este imóvel?')) return;
  const res = await api.deleteProperty(id);
  if (res?.message) { toast('Imóvel excluído'); loadProperties(currentPropsPage); }
}

// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════

let currentTasksPage = 1;

async function loadTasks(page = 1) {
  currentTasksPage = page;
  const res = await api.getTasks({ page, limit: 20 });
  if (!res) return;

  const tbody = $('#tasks-table tbody');
  tbody.innerHTML = (res.data || []).map(t => `
    <tr>
      <td>
        <div style="font-weight:600;">${t.title}</div>
        <div style="font-size:0.75rem;color:var(--nx-text-muted);">${t.description || ''}</div>
      </td>
      <td><span class="nx-badge nx-badge-gray">${t.type === 'call' ? 'Ligação' : t.type === 'visit' ? 'Visita' : t.type === 'follow_up' ? 'Follow-up' : 'Tarefa'}</span></td>
      <td><span class="nx-badge nx-badge-${t.priority === 'urgent' ? 'red' : t.priority === 'high' ? 'amber' : 'gray'}">${t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : 'Normal'}</span></td>
      <td><span class="nx-badge nx-badge-${t.status === 'completed' ? 'green' : t.status === 'overdue' ? 'red' : t.status === 'in_progress' ? 'blue' : 'amber'}">${t.status === 'completed' ? 'Concluída' : t.status === 'overdue' ? 'Atrasada' : t.status === 'in_progress' ? 'Em andamento' : 'Pendente'}</span></td>
      <td>${t.assigned?.name || '-'}</td>
      <td style="font-size:0.8rem;">${fmtDate(t.due_date)}</td>
      <td style="white-space:nowrap;">
        ${t.status !== 'completed' ? `<button class="nx-btn-icon nx-btn-icon-lg" onclick="completeTask('${t.id}')" title="Concluir" style="color:var(--nx-success);"><i class="bi bi-check-lg"></i></button>` : ''}
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="editTask('${t.id}', ${JSON.stringify(t).replace(/"/g, '&quot;')})" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="nx-btn-icon nx-btn-icon-lg" onclick="deleteTask('${t.id}')" title="Excluir" style="color:var(--nx-danger);"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  renderPagination('tasks-pagination', res.pagination, loadTasks);
}

$('#btn-new-task').addEventListener('click', () => openTaskModal());

function openTaskModal(task = null) {
  $('#task-modal-title').textContent = task ? 'Editar Tarefa' : 'Nova Tarefa';
  $('#task-id').value = task?.id || '';
  const form = $('#task-form');
  if (task) {
    form.querySelector('[name="title"]').value = task.title || '';
    form.querySelector('[name="description"]').value = task.description || '';
    form.querySelector('[name="type"]').value = task.type || 'task';
    form.querySelector('[name="priority"]').value = task.priority || 'medium';
    form.querySelector('[name="due_date"]').value = task.due_date ? task.due_date.substring(0,16) : '';
  } else {
    form.reset();
    $('#task-id').value = '';
  }
  openModal('modal-task');
}

$('#save-task-btn').addEventListener('click', async () => {
  const form = $('#task-form');
  const data = Object.fromEntries(new FormData(form));
  const id = $('#task-id').value;
  const res = id ? await api.updateTask(id, data) : await api.createTask(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Tarefa atualizada!' : 'Tarefa criada!');
  closeModal('modal-task');
  loadTasks(currentTasksPage);
});

async function completeTask(id) {
  const res = await api.completeTask(id);
  if (res?.message) { toast('Tarefa concluída!'); loadTasks(currentTasksPage); }
}

function editTask(id, task) {
  openTaskModal(task);
}

async function deleteTask(id) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
  const res = await api.deleteTask(id);
  if (res?.message) { toast('Tarefa excluída'); loadTasks(currentTasksPage); }
}

// ═══════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════

let calendarCurrentDate = new Date();
let calendarEvents = [];

async function loadCalendar() {
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  try {
    const events = await api.getEvents({ start, end });
    calendarEvents = Array.isArray(events) ? events : [];
  } catch {
    calendarEvents = [];
  }
  renderCalendar();
}

function renderCalendar() {
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  $('#calendar-month-title').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let html = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--nx-border-light);border-radius:var(--nx-radius);overflow:hidden;">
      ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d =>
        `<div style="background:var(--nx-bg-secondary);padding:8px;text-align:center;font-size:0.75rem;font-weight:600;color:var(--nx-text-muted);">${d}</div>`
      ).join('')}
  `;

  // Dias vazios antes do início
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="background:var(--nx-bg);min-height:90px;padding:6px;opacity:0.3;"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEvents = calendarEvents.filter(e => e.start_at && e.start_at.startsWith(dateStr));

    html += `
      <div style="background:var(--nx-bg);min-height:90px;padding:6px;cursor:pointer;transition:background 0.15s;" 
           onmouseenter="this.style.background='var(--nx-bg-secondary)'" 
           onmouseleave="this.style.background='var(--nx-bg)'"
           onclick="openNewEventForDay('${dateStr}')">
        <div style="font-size:0.8rem;font-weight:${isToday ? '700' : '500'};color:${isToday ? 'var(--nx-primary)' : 'var(--nx-text)'};
                    ${isToday ? 'background:var(--nx-primary);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;' : ''}
                    margin-bottom:4px;">${day}</div>
        ${dayEvents.slice(0,3).map(e => `
          <div style="font-size:0.68rem;background:var(--nx-primary-light);color:var(--nx-green-700);border-radius:3px;padding:2px 4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;"
               onclick="event.stopPropagation(); openEditEvent(${JSON.stringify(e).replace(/"/g,'&quot;')})"
               title="${e.title}">
            ${e.title}
          </div>
        `).join('')}
        ${dayEvents.length > 3 ? `<div style="font-size:0.65rem;color:var(--nx-text-muted);">+${dayEvents.length - 3} mais</div>` : ''}
      </div>
    `;
  }
  html += '</div>';

  $('#calendar-grid').innerHTML = html;
}

function openNewEventForDay(dateStr) {
  openEventModal(null, dateStr);
}

function openEditEvent(event) {
  openEventModal(event);
}

function openEventModal(event = null, prefillDate = null) {
  $('#event-modal-title').textContent = event ? 'Editar Evento' : 'Novo Evento';
  $('#event-id').value = event?.id || '';
  const form = $('#event-form');
  if (event) {
    form.querySelector('[name="title"]').value = event.title || '';
    form.querySelector('[name="type"]').value = event.type || 'meeting';
    form.querySelector('[name="start_at"]').value = event.start_at ? event.start_at.substring(0,16) : '';
    form.querySelector('[name="end_at"]').value = event.end_at ? event.end_at.substring(0,16) : '';
    form.querySelector('[name="location"]').value = event.location || '';
    form.querySelector('[name="description"]').value = event.description || '';
  } else {
    form.reset();
    $('#event-id').value = '';
    if (prefillDate) {
      form.querySelector('[name="start_at"]').value = `${prefillDate}T09:00`;
      form.querySelector('[name="end_at"]').value = `${prefillDate}T10:00`;
    }
  }
  openModal('modal-event');
}

$('#btn-new-event').addEventListener('click', () => openEventModal());

$('#save-event-btn').addEventListener('click', async () => {
  const form = $('#event-form');
  const data = Object.fromEntries(new FormData(form));
  const id = $('#event-id').value;
  const res = id ? await api.updateEvent(id, data) : await api.createEvent(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast(id ? 'Evento atualizado!' : 'Evento criado!');
  closeModal('modal-event');
  loadCalendar();
});

$('#calendar-prev').addEventListener('click', () => {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
  loadCalendar();
});
$('#calendar-next').addEventListener('click', () => {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
  loadCalendar();
});
$('#calendar-today').addEventListener('click', () => {
  calendarCurrentDate = new Date();
  loadCalendar();
});

// ═══════════════════════════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════════════════════════

async function loadWhatsApp() {
  const instances = await api.getWhatsAppInstances();
  const container = $('#wa-instances');
  if (!instances?.length) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--nx-text-muted);">
        <i class="bi bi-whatsapp" style="font-size:2rem;display:block;margin-bottom:8px;opacity:0.3;"></i>
        Nenhuma instância conectada
      </div>`;
    return;
  }
  container.innerHTML = instances.map(i => `
    <div style="padding:14px 18px;border-bottom:1px solid var(--nx-border-light);display:flex;align-items:center;gap:12px;cursor:pointer;" class="wa-instance" data-id="${i.id}">
      <div style="width:40px;height:40px;border-radius:50%;background:${i.status === 'connected' ? 'var(--nx-primary-light)' : 'var(--nx-slate-100)'};display:flex;align-items:center;justify-content:center;color:${i.status === 'connected' ? 'var(--nx-green-700)' : 'var(--nx-slate-400)'};">
        <i class="bi bi-whatsapp"></i>
      </div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:0.875rem;">${i.name}</div>
        <div style="font-size:0.75rem;color:var(--nx-text-muted);">${i.phone_number || 'Não conectado'}</div>
      </div>
      <span class="nx-badge nx-badge-${i.status === 'connected' ? 'green' : 'gray'}" style="font-size:0.65rem;">${i.status === 'connected' ? 'Online' : 'Offline'}</span>
    </div>
  `).join('');
}

$('#btn-add-wa').addEventListener('click', async () => {
  openModal('modal-qr');
  $('#qr-loading').innerHTML = '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite;display:inline-block;"></i> Conectando à instância...';
  $('#qr-code-container').innerHTML = '<div class="nx-skeleton" style="width:200px;height:200px;margin:0 auto;"></div>';
  try {
    const res = await api.createWhatsAppInstance({ name: 'WhatsApp Principal' });
    if (res?.instance) {
      pollQRCode(res.instance.id);
    } else {
      $('#qr-loading').innerHTML = `<i class="bi bi-x-circle" style="color:var(--nx-danger);"></i> ${res?.error || 'Não foi possível criar a instância. Verifique se o Evolution API está configurado no .env do servidor.'}`;
    }
  } catch (err) {
    $('#qr-loading').innerHTML = '<i class="bi bi-x-circle" style="color:var(--nx-danger);"></i> Erro ao conectar. Verifique a configuração do WhatsApp (Evolution API) no servidor.';
  }
});

async function pollQRCode(instanceId) {
  const container = $('#qr-code-container');
  const loading = $('#qr-loading');
  for (let i = 0; i < 30; i++) {
    try {
      const qr = await api.getQRCode(instanceId);
      if (qr?.qr_code) {
        container.innerHTML = `<img src="${qr.qr_code}" style="max-width:200px;" alt="QR Code">`;
        loading.innerHTML = '<i class="bi bi-check-circle" style="color:var(--nx-success);"></i> Escaneie com seu WhatsApp';
        return;
      }
    } catch {
      loading.innerHTML = '<i class="bi bi-x-circle" style="color:var(--nx-danger);"></i> Erro ao buscar QR Code. Verifique a conexão com o Evolution API.';
      return;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  loading.innerHTML = '<i class="bi bi-x-circle" style="color:var(--nx-danger);"></i> Tempo esgotado. Tente novamente.';
}

// ═══════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════

// loadAdmin moved to bottom section

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════

$$('.nx-settings-link').forEach(link => {
  link.addEventListener('click', () => {
    $$('.nx-settings-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const tab = link.dataset.tab;
    $$('.nx-settings-tab').forEach(t => t.classList.remove('active'));
    const el = $(`#tab-${tab}`);
    if (el) el.classList.add('active');
  });
});

async function loadSettings() {
  try {
    const data = await api.getCompanySettings();
    if (!data) return;
    const f = $('#company-form');
    if (f.querySelector('#set-company-name')) f.querySelector('#set-company-name').value = data.name || '';
    if (f.querySelector('#set-company-email')) f.querySelector('#set-company-email').value = data.email || '';
    if (f.querySelector('#set-company-phone')) f.querySelector('#set-company-phone').value = data.phone || '';
    if (f.querySelector('#set-company-domain')) f.querySelector('#set-company-domain').value = data.custom_domain || '';
    if (f.querySelector('#set-primary-color')) f.querySelector('#set-primary-color').value = data.primary_color || '#16a34a';
    if (f.querySelector('#set-secondary-color')) f.querySelector('#set-secondary-color').value = data.secondary_color || '#15803d';
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

$('#company-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: $('#set-company-name').value,
    email: $('#set-company-email').value,
    phone: $('#set-company-phone').value,
    custom_domain: $('#set-company-domain').value,
    primary_color: $('#set-primary-color').value,
    secondary_color: $('#set-secondary-color').value,
  };
  const res = await api.updateCompanySettings(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast('Configurações salvas!');
});

// ═══════════════════════════════════════════════════════════
// CSS ADICIONAL
// ═══════════════════════════════════════════════════════════

const extraCSS = document.createElement('style');
extraCSS.textContent = `
  .nx-plan-card { border: 2px solid var(--nx-border); border-radius: var(--nx-radius); padding: 16px; text-align: center; transition: var(--nx-transition); cursor: pointer; }
  .nx-plan-card:hover, .nx-plan-card.active { border-color: var(--nx-primary); background: var(--nx-primary-light); }
  .nx-plan-name { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; }
  .nx-plan-price { font-size: 1.5rem; font-weight: 800; color: var(--nx-primary); margin-bottom: 8px; }
  .nx-plan-price span { font-size: 0.8rem; font-weight: 400; color: var(--nx-text-muted); }
  .nx-plan-features { list-style: none; padding: 0; font-size: 0.8rem; color: var(--nx-text-secondary); }
  .nx-plan-features li { margin-bottom: 4px; }
  .nx-plan-features i { color: var(--nx-success); margin-right: 4px; }
  .nx-settings-nav { display: flex; flex-direction: column; padding: 8px; }
  .nx-settings-link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--nx-radius-sm); color: var(--nx-text-secondary); text-decoration: none; font-size: 0.875rem; font-weight: 500; background: none; border: none; cursor: pointer; transition: var(--nx-transition); text-align: left; }
  .nx-settings-link:hover, .nx-settings-link.active { background: var(--nx-bg); color: var(--nx-text); }
  .nx-settings-link.active { font-weight: 600; }
  .nx-settings-tab { display: none; }
  .nx-settings-tab.active { display: block; animation: nxFadeIn 0.2s ease; }
  .drag-over { background: var(--nx-primary-light) !important; border: 2px dashed var(--nx-primary) !important; }
  .nx-clickable-row:hover { background: var(--nx-bg-secondary); }
  .nx-btn-icon-lg { width: 36px; height: 36px; font-size: 1.05rem; display: inline-flex; align-items: center; justify-content: center; }
  .nx-property-actions-row { display: flex; flex-direction: row; gap: 6px; margin-top: 10px; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(extraCSS);

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
initAuth();

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════

// Datas padrão: último mês
(function() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const fmt = d => d.toISOString().split('T')[0];
  const rs = document.getElementById('report-start');
  const re = document.getElementById('report-end');
  if (rs) rs.value = fmt(start);
  if (re) re.value = fmt(end);
})();

document.getElementById('btn-run-report')?.addEventListener('click', runReport);

async function runReport() {
  const start = $('#report-start').value;
  const end = $('#report-end').value;
  if (!start || !end) { toast('Selecione o período', 'warning'); return; }

  const data = await api.getLeadsReport({ start: start + 'T00:00:00', end: end + 'T23:59:59' });
  if (!data) return;

  const total = data.length;
  const converted = data.filter(l => l.status === 'converted').length;
  const lost = data.filter(l => l.status === 'lost').length;
  const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;

  $('#rep-total-leads').textContent = total;
  $('#rep-converted').textContent = converted;
  $('#rep-lost').textContent = lost;
  $('#rep-rate').textContent = rate + '%';

  // Agrupar por origem
  const bySource = {};
  data.forEach(l => {
    const src = l.source || 'desconhecido';
    if (!bySource[src]) bySource[src] = { total: 0, converted: 0, lost: 0, value: 0 };
    bySource[src].total++;
    if (l.status === 'converted') bySource[src].converted++;
    if (l.status === 'lost') bySource[src].lost++;
    bySource[src].value += l.budget_max || 0;
  });

  const tbody = $('#report-table tbody');
  const rows = Object.entries(bySource).sort((a, b) => b[1].total - a[1].total);
  tbody.innerHTML = rows.length ? rows.map(([src, d]) => `
    <tr>
      <td style="font-weight:500;">${src}</td>
      <td>${d.total}</td>
      <td><span class="nx-badge nx-badge-green">${d.converted}</span></td>
      <td><span class="nx-badge nx-badge-red">${d.lost}</span></td>
      <td>${d.total > 0 ? ((d.converted / d.total) * 100).toFixed(1) : 0}%</td>
      <td>${fmtMoney(d.value)}</td>
    </tr>
  `).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--nx-text-muted);padding:32px;">Nenhum dado encontrado para o período</td></tr>`;
}

// Exportar CSV
document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  const rows = [['Origem','Leads','Convertidos','Perdidos','Conversão','Volume']];
  $$('#report-table tbody tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
    if (cells.length > 1) rows.push(cells);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'relatorio_nextep.csv'; a.click();
  URL.revokeObjectURL(url);
});

// ═══════════════════════════════════════════════════════════
// AUTOMATIONS
// ═══════════════════════════════════════════════════════════

async function loadAutomations() {
  const data = await api.getAutomations();
  const container = $('#automations-list');
  if (!data?.length) {
    container.innerHTML = `<div style="padding:48px;text-align:center;color:var(--nx-text-muted);"><i class="bi bi-magic" style="font-size:3rem;display:block;margin-bottom:16px;opacity:0.3;"></i><h3 style="margin-bottom:8px;">Nenhuma automação ativa</h3><p>Clique em um template acima ou em "Nova Automação"</p></div>`;
    return;
  }
  container.innerHTML = data.map(a => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--nx-border-light);display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;border-radius:var(--nx-radius-sm);background:var(--nx-primary-light);color:var(--nx-green-700);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-magic"></i></div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:0.875rem;">${a.name || 'Automação'}</div>
        <div style="font-size:0.75rem;color:var(--nx-text-muted);">${a.trigger || '-'} → ${a.action || '-'}</div>
      </div>
      <span class="nx-badge nx-badge-${a.is_active ? 'green' : 'gray'}">${a.is_active ? 'Ativa' : 'Inativa'}</span>
    </div>
  `).join('');
}

$('#btn-new-automation')?.addEventListener('click', () => {
  toast('Em breve: editor visual de automações', 'warning');
});

function createAutomation(type) {
  const names = { followup: 'Follow-up Automático', birthday: 'Aniversário do Lead', stage: 'Mudança de Etapa' };
  toast(`Template "${names[type]}" em breve disponível`, 'warning');
}

// ═══════════════════════════════════════════════════════════
// ADMIN — funções extras
// ═══════════════════════════════════════════════════════════

async function loadAdmin() {
  const data = await api.getAdminDashboard();
  if (!data) return;

  $('#admin-total-companies').textContent = data.metrics?.totalCompanies || 0;
  $('#admin-active-companies').textContent = data.metrics?.activeCompanies || 0;
  $('#admin-revenue').textContent = fmtMoney(data.metrics?.monthlyRevenue || 0);
  $('#admin-total-users').textContent = data.metrics?.totalUsers || 0;

  renderAdminCompanies(data.recentCompanies || []);
}

function renderAdminCompanies(companies) {
  const tbody = $('#admin-companies-table tbody');
  tbody.innerHTML = companies.map(c => `
    <tr>
      <td><div style="font-weight:600;">${c.name}</div><div style="font-size:0.75rem;color:var(--nx-text-muted);">${c.email}</div></td>
      <td><span class="nx-badge nx-badge-${c.plan === 'enterprise' ? 'green' : c.plan === 'professional' ? 'blue' : 'gray'}">${c.plan?.toUpperCase() || 'BASIC'}</span></td>
      <td><span class="nx-badge nx-badge-${c.status === 'active' ? 'green' : 'red'}">${c.status === 'active' ? 'Ativa' : 'Suspensa'}</span></td>
      <td>${c.users?.[0]?.count || 0}</td>
      <td>${c.leads?.[0]?.count || 0}</td>
      <td style="font-size:0.8rem;">${fmtDate(c.created_at)}</td>
      <td><button class="nx-btn-icon" onclick="openAdminCompany(${JSON.stringify(c).replace(/"/g,'&quot;')})" title="Gerenciar"><i class="bi bi-gear"></i></button></td>
    </tr>
  `).join('');
}

function openAdminCompany(company) {
  $('#admin-company-id').value = company.id;
  $('#admin-company-name').value = company.name || '';
  $('#admin-company-plan').value = company.plan || 'basic';
  $('#admin-company-status').value = company.status || 'active';
  openModal('modal-admin-company');
}

$('#save-admin-company-btn')?.addEventListener('click', async () => {
  const id = $('#admin-company-id').value;
  const res = await api.req(`/admin/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: $('#admin-company-name').value,
      plan: $('#admin-company-plan').value,
      status: $('#admin-company-status').value,
    })
  });
  const data = await res?.json();
  if (data?.error) { toast(data.error, 'error'); return; }
  toast('Empresa atualizada!');
  closeModal('modal-admin-company');
  loadAdmin();
});

// Busca admin
$('#admin-search')?.addEventListener('input', debounce(async (e) => {
  const search = e.target.value;
  const res = await api.getAdminCompanies({ search, limit: 20 });
  if (res?.data) renderAdminCompanies(res.data);
}, 400));

// ═══════════════════════════════════════════════════════════
// SETTINGS — extras
// ═══════════════════════════════════════════════════════════

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nx_theme', theme);
  $('#theme-label').textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
  toast('Tema aplicado!');
}

$('#btn-save-appearance')?.addEventListener('click', async () => {
  const data = {
    primary_color: $('#set-primary-color').value,
    secondary_color: $('#set-secondary-color').value,
  };
  const res = await api.updateCompanySettings(data);
  if (res?.error) { toast(res.error, 'error'); return; }
  toast('Aparência salva!');
});

$('#btn-connect-google')?.addEventListener('click', () => {
  toast('Configure o Google OAuth no painel de Integrações nas Configurações', 'warning');
});

$('#btn-google-calendar-settings')?.addEventListener('click', () => {
  toast('Integração com Google Calendar: configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env do servidor', 'warning');
});

// Carregar billing ao entrar na aba
document.querySelector('[data-tab="billing"]')?.addEventListener('click', async () => {
  const data = await api.req('/billing/subscription').then(r => r?.json());
  const container = $('#billing-info');
  if (!container) return;
  if (!data?.subscription) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--nx-text-muted);"><i class="bi bi-credit-card" style="font-size:2rem;display:block;margin-bottom:8px;opacity:0.3;"></i><p>Nenhuma assinatura ativa</p></div>`;
    return;
  }
  const s = data.subscription;
  container.innerHTML = `
    <div style="border:1px solid var(--nx-border);border-radius:var(--nx-radius);padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><div style="font-weight:700;font-size:1rem;">Plano ${s.plan?.toUpperCase() || '-'}</div><div style="font-size:0.8rem;color:var(--nx-text-muted);">Renovação em ${fmtDate(s.current_period_end)}</div></div>
        <span class="nx-badge nx-badge-${s.status === 'active' ? 'green' : 'red'}">${s.status === 'active' ? 'Ativa' : 'Cancelada'}</span>
      </div>
    </div>
    ${(data.invoices || []).slice(0,5).map(inv => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--nx-border-light);">
        <div style="font-size:0.875rem;">${fmtDate(inv.created_at)}</div>
        <div style="font-weight:600;">${fmtMoney(inv.amount)}</div>
        <span class="nx-badge nx-badge-${inv.status === 'paid' ? 'green' : 'amber'}">${inv.status === 'paid' ? 'Pago' : 'Pendente'}</span>
      </div>
    `).join('')}
  `;
});

// Carregar usuários ao entrar na aba
document.querySelector('[data-tab="users"]')?.addEventListener('click', async () => {
  const container = $('#users-list');
  try {
    const data = await api.getCompanySettings();
    // Buscar usuários via settings ou endpoint próprio se disponível
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--nx-text-muted);"><i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:8px;opacity:0.3;"></i><p>Gerencie usuários pelo painel de administração</p></div>`;
  } catch {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:var(--nx-text-muted);">Erro ao carregar usuários</div>`;
  }
});

$('#btn-invite-user')?.addEventListener('click', () => {
  toast('Em breve: convite de usuários por e-mail', 'warning');
});

// Navegação settings: também carrega automations quando entra na aba