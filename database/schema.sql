-- ============================================================
-- NEXTEP CRM — CORREÇÕES DE BANCO
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Tornar assigned_to e created_by opcionais em tasks
--    (o backend já preenche com o usuário logado, mas por segurança)
ALTER TABLE tasks ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN created_by DROP NOT NULL;

-- 2. Tornar created_by opcional em events
ALTER TABLE events ALTER COLUMN created_by DROP NOT NULL;

-- 3. Tornar end_at opcional em events (nem sempre sabemos a duração)
ALTER TABLE events ALTER COLUMN end_at DROP NOT NULL;

-- 4. Adicionar função get_leads_by_month que o dashboard chama
CREATE OR REPLACE FUNCTION get_leads_by_month(company_uuid UUID)
RETURNS TABLE(month TEXT, total BIGINT, converted BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'converted') AS converted
    FROM leads
    WHERE company_id = company_uuid
      AND deleted_at IS NULL
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at);
END;
$$ LANGUAGE plpgsql;

-- 5. Corrigir get_dashboard_metrics para incluir total_sales e conversion_rate
CREATE OR REPLACE FUNCTION get_dashboard_metrics(company_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_l BIGINT;
    converted_l BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_l FROM leads WHERE company_id = company_uuid AND deleted_at IS NULL;
    SELECT COUNT(*) INTO converted_l FROM leads WHERE company_id = company_uuid AND status = 'converted' AND deleted_at IS NULL;

    SELECT jsonb_build_object(
        'total_leads', total_l,
        'total_clients', (SELECT COUNT(*) FROM clients WHERE company_id = company_uuid AND deleted_at IS NULL),
        'total_properties', (SELECT COUNT(*) FROM properties WHERE company_id = company_uuid AND deleted_at IS NULL),
        'total_tasks_pending', (SELECT COUNT(*) FROM tasks WHERE company_id = company_uuid AND status = 'pending' AND deleted_at IS NULL),
        'total_tasks_overdue', (SELECT COUNT(*) FROM tasks WHERE company_id = company_uuid AND status = 'overdue' AND deleted_at IS NULL),
        'leads_this_month', (SELECT COUNT(*) FROM leads WHERE company_id = company_uuid AND created_at >= DATE_TRUNC('month', NOW()) AND deleted_at IS NULL),
        'conversions_this_month', (SELECT COUNT(*) FROM leads WHERE company_id = company_uuid AND status = 'converted' AND updated_at >= DATE_TRUNC('month', NOW())),
        'total_sales', COALESCE((SELECT SUM(budget_max) FROM leads WHERE company_id = company_uuid AND status = 'converted' AND deleted_at IS NULL), 0),
        'conversion_rate', CASE WHEN total_l > 0 THEN ROUND((converted_l::DECIMAL / total_l) * 100, 1) ELSE 0 END,
        'events_today', (SELECT COUNT(*) FROM events WHERE company_id = company_uuid AND DATE(start_at) = CURRENT_DATE AND deleted_at IS NULL),
        'unread_messages', (SELECT COUNT(*) FROM messages WHERE company_id = company_uuid AND is_read = false AND is_from_me = false)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Policies de RLS para o service_key funcionar corretamente
--    (service_role bypassa RLS, mas anon_key não — necessário para o frontend direto)

-- Companies
CREATE POLICY "service_role_companies" ON companies
    FOR ALL USING (true);

-- Users
CREATE POLICY "service_role_users" ON users
    FOR ALL USING (true);

-- Leads
CREATE POLICY "service_role_leads" ON leads
    FOR ALL USING (true);

-- Clients
CREATE POLICY "service_role_clients" ON clients
    FOR ALL USING (true);

-- Properties
CREATE POLICY "service_role_properties" ON properties
    FOR ALL USING (true);

-- Tasks
CREATE POLICY "service_role_tasks" ON tasks
    FOR ALL USING (true);

-- Events
CREATE POLICY "service_role_events" ON events
    FOR ALL USING (true);

-- Pipeline stages
CREATE POLICY "service_role_pipeline_stages" ON pipeline_stages
    FOR ALL USING (true);

-- Pipeline history
CREATE POLICY "service_role_pipeline_history" ON pipeline_history
    FOR ALL USING (true);

-- Notifications
CREATE POLICY "service_role_notifications" ON notifications
    FOR ALL USING (true);

-- Messages
CREATE POLICY "service_role_messages" ON messages
    FOR ALL USING (true);

-- Whatsapp instances
CREATE POLICY "service_role_whatsapp" ON whatsapp_instances
    FOR ALL USING (true);

-- Documents
CREATE POLICY "service_role_documents" ON documents
    FOR ALL USING (true);

-- Automations
CREATE POLICY "service_role_automations" ON automations
    FOR ALL USING (true);

-- AI Conversations
CREATE POLICY "service_role_ai" ON ai_conversations
    FOR ALL USING (true);

-- Subscriptions
CREATE POLICY "service_role_subscriptions" ON subscriptions
    FOR ALL USING (true);

-- Invoices
CREATE POLICY "service_role_invoices" ON invoices
    FOR ALL USING (true);

-- Audit logs
CREATE POLICY "service_role_audit" ON audit_logs
    FOR ALL USING (true);

-- Configurations
CREATE POLICY "service_role_configurations" ON configurations
    FOR ALL USING (true);

-- Automation logs
CREATE POLICY "service_role_automation_logs" ON automation_logs
    FOR ALL USING (true);

-- Property interests
CREATE POLICY "service_role_property_interests" ON property_interests
    FOR ALL USING (true);