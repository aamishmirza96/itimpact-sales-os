import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

export async function fetchNotifications() {
  if (!supabase || !currentUser) return [];
  const { data } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function getUnreadCount() {
  if (!supabase || !currentUser) return 0;
  const { count } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('read', false);
  return count || 0;
}

export async function markAsRead(id) {
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllRead() {
  if (!supabase || !currentUser) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false);
}

export async function sendNotification(userId, type, title, body, link) {
  if (!supabase) return;
  await supabase.from('notifications').insert({ user_id: userId, type, title, body, link });
}

export function subscribeToNotifications(callback) {
  if (!supabase || !currentUser) return () => {};
  const channel = supabase.channel(`notif-${currentUser.id}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
