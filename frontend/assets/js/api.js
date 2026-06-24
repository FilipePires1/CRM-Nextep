// NEXTEP CRM - API Client
// Cliente HTTP para comunicação com o backend

const API_BASE = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
)
  ? 'http://localhost:3000/api'
  : '/api';

class NextepAPI {
  constructor() {
    this.token = localStorage.getItem('nx_token');
    this.refreshToken = localStorage.getItem('nx_refresh');
    this.user = JSON.parse(localStorage.getItem('nx_user') || 'null');
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async req(endpoint, opts = {}) {
    const url = `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      ...opts,
      headers: { ...this.headers(), ...opts.headers }
    });

    if (res.status === 401) {
      const refreshed = await this.refresh();
      if (refreshed) {
        return fetch(url, {
          ...opts,
          headers: { ...this.headers(), ...opts.headers }
        });
      }
      this.logout();
      return null;
    }

    return res;
  }

  async refresh() {
    if (!this.refreshToken) return false;
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      if (r.ok) {
        const d = await r.json();
        this.token = d.accessToken;
        localStorage.setItem('nx_token', d.accessToken);
        return true;
      }
    } catch {}
    return false;
  }

  // ── Auth ──────────────────────────────────────────────────
  async login(email, password) {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(err);
    }
    return r.json();
  }

  async register(data) {
    const r = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return r.json();
  }

  async me() {
    const r = await this.req('/auth/me');
    return r?.json();
  }

  logout() {
    localStorage.removeItem('nx_token');
    localStorage.removeItem('nx_refresh');
    localStorage.removeItem('nx_user');
    window.location.reload();
  }

  setSession(data) {
    this.token = data.accessToken;
    this.refreshToken = data.refreshToken;
    localStorage.setItem('nx_token', data.accessToken);
    localStorage.setItem('nx_refresh', data.refreshToken);
    localStorage.setItem('nx_user', JSON.stringify(data.user));
    this.user = data.user;
  }

  // ── Dashboard ─────────────────────────────────────────────
  getDashboard() { return this.req('/dashboard/metrics').then(r => r?.json()); }
  getCharts(period) { return this.req(`/dashboard/charts?period=${period}`).then(r => r?.json()); }

  // ── Leads ─────────────────────────────────────────────────
  getLeads(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/leads?${q}`).then(r => r?.json());
  }
  getLead(id) { return this.req(`/leads/${id}`).then(r => r?.json()); }
  createLead(data) { return this.req('/leads', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  updateLead(id, data) { return this.req(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }
  deleteLead(id) { return this.req(`/leads/${id}`, { method: 'DELETE' }).then(r => r?.json()); }
  convertLead(id) { return this.req(`/leads/${id}/convert`, { method: 'POST' }).then(r => r?.json()); }
  transferLead(id, assigned_to) { return this.req(`/leads/${id}/transfer`, { method: 'POST', body: JSON.stringify({ assigned_to }) }).then(r => r?.json()); }
  moveLead(id, stageId, reason) { return this.req(`/pipeline/leads/${id}/move`, { method: 'POST', body: JSON.stringify({ stage_id: stageId, reason }) }).then(r => r?.json()); }

  // ── Pipeline ──────────────────────────────────────────────
  getStages() { return this.req('/pipeline/stages').then(r => r?.json()); }
  getStageLeads(stageId) { return this.req(`/pipeline/stages/${stageId}/leads`).then(r => r?.json()); }

  // ── Clients ───────────────────────────────────────────────
  getClients(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/clients?${q}`).then(r => r?.json());
  }
  getClient(id) { return this.req(`/clients/${id}`).then(r => r?.json()); }
  createClient(data) { return this.req('/clients', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  updateClient(id, data) { return this.req(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }
  deleteClient(id) { return this.req(`/clients/${id}`, { method: 'DELETE' }).then(r => r?.json()); }

  // ── Properties ────────────────────────────────────────────
  getProperties(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/properties?${q}`).then(r => r?.json());
  }
  getProperty(id) { return this.req(`/properties/${id}`).then(r => r?.json()); }
  createProperty(data) { return this.req('/properties', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  updateProperty(id, data) { return this.req(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }
  deleteProperty(id) { return this.req(`/properties/${id}`, { method: 'DELETE' }).then(r => r?.json()); }

  // ── Tasks ─────────────────────────────────────────────────
  getTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/tasks?${q}`).then(r => r?.json());
  }
  createTask(data) { return this.req('/tasks', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  updateTask(id, data) { return this.req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }
  completeTask(id) { return this.req(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) }).then(r => r?.json()); }
  deleteTask(id) { return this.req(`/tasks/${id}`, { method: 'DELETE' }).then(r => r?.json()); }

  // ── Events / Calendar ─────────────────────────────────────
  getEvents(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/events?${q}`).then(r => r?.json());
  }
  createEvent(data) { return this.req('/events', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  updateEvent(id, data) { return this.req(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }
  deleteEvent(id) { return this.req(`/events/${id}`, { method: 'DELETE' }).then(r => r?.json()); }

  // ── Settings ──────────────────────────────────────────────
  getCompanySettings() { return this.req('/settings/company').then(r => r?.json()); }
  updateCompanySettings(data) { return this.req('/settings/company', { method: 'PUT', body: JSON.stringify(data) }).then(r => r?.json()); }

  // ── WhatsApp ──────────────────────────────────────────────
  getWhatsAppInstances() { return this.req('/whatsapp/instances').then(r => r?.json()); }
  createWhatsAppInstance(data) { return this.req('/whatsapp/instances', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }
  getQRCode(id) { return this.req(`/whatsapp/instances/${id}/qr`).then(r => r?.json()); }
  sendMessage(data) { return this.req('/whatsapp/send', { method: 'POST', body: JSON.stringify(data) }).then(r => r?.json()); }

  // ── Admin ─────────────────────────────────────────────────
  getAdminDashboard() { return this.req('/admin/dashboard').then(r => r?.json()); }
  getAdminCompanies(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/admin/companies?${q}`).then(r => r?.json());
  }

  // ── Reports ───────────────────────────────────────────────
  getLeadsReport(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.req(`/reports/leads?${q}`).then(r => r?.json());
  }

  // ── Automations ───────────────────────────────────────────
  getAutomations() { return this.req('/automations').then(r => r?.json()); }
}

const api = new NextepAPI();