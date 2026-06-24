import { supabase } from './supabase.js';

export let currentUser = null;
export let currentProfile = null;

export async function initAuth() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentProfile = await fetchProfile(session.user.id);
  }
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    window.dispatchEvent(new Event('auth-change'));
  });
  return currentUser;
}

async function fetchProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

export async function getTeamMembers() {
  if (!supabase) return [];
  const { data } = await supabase.from('profiles').select('*').order('full_name');
  return data || [];
}
