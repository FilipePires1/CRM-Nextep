/**
 * NEXTEP CRM - Notification Service
 * Notificações em tempo real via Supabase Realtime
 */

class NotificationService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async create({ companyId, userId, title, message, type = 'info', relatedType, relatedId }) {
    try {
      const { data } = await this.supabase.from('notifications').insert([{
        company_id: companyId,
        user_id: userId,
        title,
        message,
        type,
        related_type: relatedType,
        related_id: relatedId
      }]).select().single();

      // Emitir via Realtime (canal: company:{companyId})
      await this.supabase
        .channel(`company-${companyId}`)
        .send({
          type: 'broadcast',
          event: 'new_notification',
          payload: data
        });

      return data;
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  async markAsRead(notificationId, userId) {
    return await this.supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);
  }

  async getUnreadCount(userId) {
    const { count } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  }
}

module.exports = NotificationService;
