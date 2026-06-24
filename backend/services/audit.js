/**
 * NEXTEP CRM - Audit Log Service
 */

class AuditService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async log({ userId, companyId, action, entityType, entityId, oldValues, newValues, req }) {
    try {
      await this.supabase.from('audit_logs').insert([{
        user_id: userId,
        company_id: companyId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: req?.ip,
        user_agent: req?.headers['user-agent']
      }]);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
}

module.exports = AuditService;
