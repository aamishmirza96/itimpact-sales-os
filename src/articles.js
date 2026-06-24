import { supabase } from './supabase.js';
import { currentUser } from './auth.js';

export async function fetchArticles() {
  if (!supabase) return [];
  const { data } = await supabase.from('articles')
    .select('*, author:author_id(full_name)')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createArticle(article) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('articles').insert({
    ...article, author_id: currentUser.id,
  }).select('*, author:author_id(full_name)').single();
  if (error) throw error;
  return data;
}

export async function updateArticle(id, updates) {
  if (!supabase) return null;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('articles').update(updates).eq('id', id).select('*, author:author_id(full_name)').single();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id) {
  if (!supabase) return;
  await supabase.from('articles').delete().eq('id', id);
}
