import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

export async function fetchTeamMembers() {
  if (!supabase) return [];
  const { data } = await supabase.from('profiles').select('*').order('full_name');
  return data || [];
}

export async function updateProfile(id, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
