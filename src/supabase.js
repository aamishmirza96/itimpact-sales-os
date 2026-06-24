import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (URL && KEY && URL !== 'your_supabase_url_here')
  ? createClient(URL, KEY)
  : null;

export const DB_ENABLED = !!supabase;

// ── Load all mutable state from Supabase ──────────────────────────────
export async function loadDbState() {
  if (!supabase) return { prospects: {}, candidates: {}, added: [] };
  try {
    const [p, c, a] = await Promise.all([
      supabase.from('prospects_state').select('*'),
      supabase.from('candidates_state').select('*'),
      supabase.from('added_prospects').select('*').order('created_at', { ascending: true }),
    ]);
    const prospects = {};
    (p.data || []).forEach(row => { prospects[row.id] = row; });
    const candidates = {};
    (c.data || []).forEach(row => { candidates[row.id] = row; });
    const added = (a.data || []).map(row => row.data);
    return { prospects, candidates, added };
  } catch (e) {
    console.warn('Supabase load failed, using localStorage', e);
    return { prospects: {}, candidates: {}, added: [] };
  }
}

// ── Upsert a prospect's mutable state ─────────────────────────────────
export function syncProspect(p) {
  if (!supabase) return;
  supabase.from('prospects_state').upsert({
    id: String(p.id),
    stage: p.stage,
    notes: p.notes || '',
    research_done: p.researchDone || false,
    outreach_written: p.outreachWritten || false,
    spoken_to: p.spokenTo || false,
    meeting_booked: p.meetingBooked || false,
    meeting_date: p.meetingDate || null,
    updated_at: new Date().toISOString(),
  }).then(({ error }) => { if (error) console.warn('Supabase prospect sync error', error); });
}

// ── Upsert a candidate's mutable state ────────────────────────────────
export function syncCandidate(c) {
  if (!supabase) return;
  supabase.from('candidates_state').upsert({
    id: String(c.id),
    status: c.status || 'new',
    email_sent: c.emailSent || false,
    notes: c.notes || '',
    updated_at: new Date().toISOString(),
  }).then(({ error }) => { if (error) console.warn('Supabase candidate sync error', error); });
}

// ── Save a new prospect added via Apollo search ───────────────────────
export function syncAddedProspect(p) {
  if (!supabase) return;
  supabase.from('added_prospects').upsert({
    id: String(p.id),
    data: p,
    created_at: new Date().toISOString(),
  }).then(({ error }) => { if (error) console.warn('Supabase added prospect sync error', error); });
}
