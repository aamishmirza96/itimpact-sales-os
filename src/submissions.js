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

export async function deleteGeneralCV(id) {
  const { data } = await supabase.from('general_cv_submissions').select('resume_url').eq('id', id).single();
  if (data?.resume_url) {
    const path = data.resume_url.split('/resumes/')[1];
    if (path) await supabase.storage.from('resumes').remove([decodeURIComponent(path)]);
  }
  await supabase.from('general_cv_submissions').delete().eq('id', id);
}

export async function uploadAndAddCV({ name, email, phone, currentTitle, currentCompany, location, file }) {
  let resume_url = null;
  if (file) {
    const ext = file.name.split('.').pop();
    const path = `manual/${Date.now()}_${name.replace(/\s+/g,'_')}.${ext}`;
    const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(path);
      resume_url = urlData.publicUrl;
    }
  }
  const { data, error } = await supabase.from('general_cv_submissions').insert({
    name, email, phone: phone || null,
    current_title: currentTitle || null,
    current_company: currentCompany || null,
    location: location || null,
    resume_url,
    status: 'new',
    source: 'manual',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function fetchAIAssessments() {
  if (!supabase) return [];
  const { data } = await supabase.from('ai_assessments').select('*').order('created_at', { ascending: false });
  return data || [];
}
export async function updateAIAssessmentStatus(id, status) {
  await supabase.from('ai_assessments').update({ status }).eq('id', id);
}
