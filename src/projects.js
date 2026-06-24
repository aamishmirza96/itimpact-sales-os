import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

// ── Projects CRUD ────────────────────────────────────────────────────
export async function fetchProjects() {
  if (!supabase) return [];
  const { data } = await supabase.from('projects').select('*, creator:created_by(full_name)').order('created_at', { ascending: false });
  return data || [];
}

export async function createProject(name, description) {
  const { data, error } = await supabase.from('projects').insert({
    name, description, created_by: currentUser?.id,
  }).select().single();
  if (error) throw error;
  // add creator as member
  await supabase.from('project_members').insert({ project_id: data.id, user_id: currentUser.id, role: 'admin' });
  return data;
}

export async function fetchProjectMembers(projectId) {
  const { data } = await supabase.from('project_members').select('*, profile:user_id(id, full_name, email)').eq('project_id', projectId);
  return data || [];
}

export async function addProjectMember(projectId, userId) {
  await supabase.from('project_members').insert({ project_id: projectId, user_id: userId });
}

// ── Messages (Message Board) ─────────────────────────────────────────
export async function fetchMessages(projectId) {
  const { data } = await supabase.from('messages').select('*, author:author_id(full_name, email)').eq('project_id', projectId).order('created_at', { ascending: false });
  return data || [];
}

export async function createMessage(projectId, title, body) {
  const { data, error } = await supabase.from('messages').insert({
    project_id: projectId, author_id: currentUser.id, title, body,
  }).select('*, author:author_id(full_name, email)').single();
  if (error) throw error;
  return data;
}

export async function fetchComments(messageId) {
  const { data } = await supabase.from('message_comments').select('*, author:author_id(full_name)').eq('message_id', messageId).order('created_at');
  return data || [];
}

export async function createComment(messageId, body) {
  const { data, error } = await supabase.from('message_comments').insert({
    message_id: messageId, author_id: currentUser.id, body,
  }).select('*, author:author_id(full_name)').single();
  if (error) throw error;
  return data;
}

// ── To-dos ───────────────────────────────────────────────────────────
export async function fetchTodoLists(projectId) {
  const { data } = await supabase.from('todo_lists').select('*, todos(*, assignee:assigned_to(full_name))').eq('project_id', projectId).order('position');
  return (data || []).map(l => ({ ...l, todos: (l.todos || []).sort((a, b) => a.position - b.position) }));
}

export async function createTodoList(projectId, name) {
  const { data, error } = await supabase.from('todo_lists').insert({ project_id: projectId, name }).select().single();
  if (error) throw error;
  return data;
}

export async function createTodo(listId, title, assignedTo, dueDate) {
  const { data, error } = await supabase.from('todos').insert({
    list_id: listId, title, assigned_to: assignedTo || null, due_date: dueDate || null,
  }).select('*, assignee:assigned_to(full_name)').single();
  if (error) throw error;
  return data;
}

export async function toggleTodo(id, completed) {
  await supabase.from('todos').update({ completed }).eq('id', id);
}

export async function deleteTodo(id) {
  await supabase.from('todos').delete().eq('id', id);
}

// ── Schedule ─────────────────────────────────────────────────────────
export async function fetchEvents(projectId) {
  const { data } = await supabase.from('events').select('*, creator:created_by(full_name)').eq('project_id', projectId).order('event_date');
  return data || [];
}

export async function createEvent(projectId, title, description, eventDate, eventTime) {
  const { data, error } = await supabase.from('events').insert({
    project_id: projectId, title, description, event_date: eventDate, event_time: eventTime || null, created_by: currentUser.id,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── Chat (Campfire) ──────────────────────────────────────────────────
export async function fetchChatMessages(projectId) {
  const { data } = await supabase.from('chat_messages').select('*, author:author_id(full_name)').eq('project_id', projectId).order('created_at');
  return data || [];
}

export async function sendChatMessage(projectId, body) {
  const { data, error } = await supabase.from('chat_messages').insert({
    project_id: projectId, author_id: currentUser.id, body,
  }).select('*, author:author_id(full_name)').single();
  if (error) throw error;
  return data;
}

export function subscribeToChatMessages(projectId, callback) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`chat-${projectId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `project_id=eq.${projectId}` },
      async (payload) => {
        const { data } = await supabase.from('chat_messages').select('*, author:author_id(full_name)').eq('id', payload.new.id).single();
        if (data) callback(data);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ── Check-ins ────────────────────────────────────────────────────────
export async function fetchCheckins(projectId) {
  const { data } = await supabase.from('checkins').select('*, responses:checkin_responses(*, author:author_id(full_name))').eq('project_id', projectId).order('created_at', { ascending: false });
  return (data || []).map(c => ({ ...c, responses: (c.responses || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) }));
}

export async function createCheckin(projectId, question, frequency) {
  const { data, error } = await supabase.from('checkins').insert({ project_id: projectId, question, frequency }).select().single();
  if (error) throw error;
  return data;
}

export async function respondToCheckin(checkinId, body) {
  const { data, error } = await supabase.from('checkin_responses').insert({
    checkin_id: checkinId, author_id: currentUser.id, body,
  }).select('*, author:author_id(full_name)').single();
  if (error) throw error;
  return data;
}
