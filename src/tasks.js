import { supabase } from './supabase.js';
import { currentUser } from './auth.js';
import { sendNotification } from './notifications.js';

export async function fetchTasks(filters = {}) {
  if (!supabase) return [];
  let q = supabase.from('tasks')
    .select('*, assignee:assigned_to(id,full_name,email), assigner:assigned_by(id,full_name)')
    .order('created_at', { ascending: false });
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type);
  if (filters.entity_id) q = q.eq('entity_id', filters.entity_id);
  if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
  if (filters.status) q = q.eq('status', filters.status);
  const { data } = await q;
  return data || [];
}

export async function createTask({ title, description, entity_type, entity_id, entity_label, assigned_to, due_date }) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('tasks').insert({
    title, description, entity_type, entity_id, entity_label,
    assigned_to, assigned_by: currentUser?.id, due_date, status: 'todo',
  }).select('*, assignee:assigned_to(id,full_name,email)').single();
  if (error) throw error;

  if (assigned_to && assigned_to !== currentUser?.id) {
    await sendNotification(assigned_to, 'task_assigned',
      `Task assigned: ${title}`,
      `${currentUser?.email} assigned you a task${due_date ? ' due '+due_date : ''}`,
      entity_type === 'lead' ? 'leads' : entity_type === 'project' ? 'projects' : 'submissions'
    );
  }
  return data;
}

export async function updateTask(id, updates) {
  if (!supabase) return;
  if (updates.status === 'completed') updates.completed_at = new Date().toISOString();
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id)
    .select('*, assignee:assigned_to(id,full_name,email)').single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  if (!supabase) return;
  await supabase.from('tasks').delete().eq('id', id);
}
