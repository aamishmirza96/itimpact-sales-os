import { supabase } from './supabase.js';

export async function fetchContactSubmissions() {
  if (!supabase) return [];
  const { data } = await supabase.from('contact_submissions').select('*').order('created_at', { ascending: false });
  return data || [];
}
export async function updateContactStatus(id, status) {
  await supabase.from('contact_submissions').update({ status }).eq('id', id);
}

export async function fetchGeneralCVs() {
  if (!supabase) return [];
  const { data } = await supabase.from('general_cv_submissions').select('*').order('created_at', { ascending: false });
  return data || [];
}
export async function updateGeneralCVStatus(id, status) {
  await supabase.from('general_cv_submissions').update({ status }).eq('id', id);
}
export async function updateGeneralCVNotes(id, notes) {
  await supabase.from('general_cv_submissions').update({ notes }).eq('id', id);
}

export async function fetchJobApplications() {
  if (!supabase) return [];
  const { data } = await supabase.from('job_applications').select('*').order('created_at', { ascending: false });
  return data || [];
}
export async function updateJobApplicationStatus(id, status) {
  await supabase.from('job_applications').update({ status }).eq('id', id);
}
export async function updateJobApplicationNotes(id, notes) {
  await supabase.from('job_applications').update({ notes }).eq('id', id);
}

export async function fetchAIAssessments() {
  if (!supabase) return [];
  const { data } = await supabase.from('ai_assessments').select('*').order('created_at', { ascending: false });
  return data || [];
}
export async function updateAIAssessmentStatus(id, status) {
  await supabase.from('ai_assessments').update({ status }).eq('id', id);
}
