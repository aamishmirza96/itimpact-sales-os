import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

export const LEAD_STATUSES = [
  { id: 'new', label: 'New', color: '#5a5a72' },
  { id: 'contacted', label: 'Contacted', color: '#6366f1' },
  { id: 'qualified', label: 'Qualified', color: '#818cf8' },
  { id: 'proposal', label: 'Proposal', color: '#f59e0b' },
  { id: 'won', label: 'Won', color: '#10b981' },
  { id: 'lost', label: 'Lost', color: '#ef4444' },
];

export async function fetchLeads() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*, assigned:assigned_to(full_name), creator:created_by(full_name)')
    .order('created_at', { ascending: false });
  if (error) { console.warn('Fetch leads error', error); return []; }
  return data || [];
}

export async function createLead(lead) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('leads').insert({
    ...lead,
    created_by: currentUser?.id,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLead(id, updates) {
  if (!supabase) return null;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id) {
  if (!supabase) return;
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}
