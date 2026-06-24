import { supabase } from './supabase.js';

export async function fetchAnalyticsOverview(days = 7) {
  if (!supabase) return { sessions: 0, pageViews: 0, avgTime: 0, topPages: [], events: [] };

  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [sessionsRes, eventsRes] = await Promise.all([
    supabase.from('analytics_sessions').select('*').gte('started_at', since).order('started_at', { ascending: false }),
    supabase.from('analytics_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
  ]);

  const sessions = sessionsRes.data || [];
  const events = eventsRes.data || [];

  const pageViews = events.filter(e => e.event_type === 'pageview').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  const avgTime = sessions.length ? Math.round(sessions.reduce((s, x) => s + (x.total_time || 0), 0) / sessions.length) : 0;

  const pageCounts = {};
  events.filter(e => e.event_type === 'pageview').forEach(e => {
    const p = e.page_url || '/';
    pageCounts[p] = (pageCounts[p] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([url, count]) => ({ url, count }));

  const dailyViews = {};
  events.filter(e => e.event_type === 'pageview').forEach(e => {
    const day = new Date(e.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    dailyViews[day] = (dailyViews[day] || 0) + 1;
  });

  const dailyData = Object.entries(dailyViews).reverse().slice(0, days);

  return { sessions: sessions.length, pageViews, clicks, avgTime, topPages, events, dailyData, totalSessions: sessions };
}
