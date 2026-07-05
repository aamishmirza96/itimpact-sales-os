import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env in local dev
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APOLLO_KEY   = process.env.APOLLO_API_KEY;
const APP_URL      = process.env.APP_URL || 'http://localhost:3002';

// Serve built frontend
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) app.use(express.static(distPath));

// ── Health ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apolloConfigured: !!(APOLLO_KEY && APOLLO_KEY !== 'your_apollo_api_key_here') });
});

// ── Apollo lead search ────────────────────────────────────────────────
app.post('/api/leads/search', async (req, res) => {
  if (!APOLLO_KEY || APOLLO_KEY === 'your_apollo_api_key_here')
    return res.status(400).json({ error: 'Apollo API key not configured.' });
  try {
    const { titles, sectors, locations, page = 1 } = req.body;
    const r = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': APOLLO_KEY },
      body: JSON.stringify({
        page, per_page: 10,
        person_titles: titles || ['Managing Partner','CIO','CTO','VP Portfolio Operations'],
        person_seniorities: ['c_suite','vp','partner','director'],
        q_organization_keyword_tags: sectors || ['private equity','venture capital','healthcare','dental'],
        person_locations: locations || ['New York, NY','Chicago, IL','San Francisco, CA','Boston, MA'],
        organization_num_employees_ranges: ['11,50','51,200','201,500'],
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: `Apollo ${r.status}`, detail: await r.text() });
    res.json(await r.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Google OAuth callback ─────────────────────────────────────────────
app.get('/api/google-oauth-callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${APP_URL}/?google_error=${error || 'missing_code'}`);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/google-oauth-callback`,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return res.redirect(`${APP_URL}/?google_error=${encodeURIComponent(tokens.error_description || 'token_failed')}`);

    await fetch(`${SUPABASE_URL}/rest/v1/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 'google', access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
    });
    res.redirect(`${APP_URL}/?google_connected=1`);
  } catch (err) { res.redirect(`${APP_URL}/?google_error=${encodeURIComponent(err.message)}`); }
});

// ── GA4 data ──────────────────────────────────────────────────────────
app.get('/api/ga-data', async (req, res) => {
  try {
    const { start, end } = req.query;
    const intRow = await fetch(`${SUPABASE_URL}/rest/v1/integrations?id=eq.google&select=*`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const rows = await intRow.json();
    if (!rows.length) return res.status(400).json({ error: 'Google not connected' });

    let { access_token, refresh_token, expires_at } = rows[0];
    if (!access_token) return res.status(400).json({ error: 'No access token' });

    // Refresh if expired
    if (new Date(expires_at) < new Date()) {
      const ref = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
      });
      const newTokens = await ref.json();
      if (newTokens.access_token) {
        access_token = newTokens.access_token;
        await fetch(`${SUPABASE_URL}/rest/v1/integrations?id=eq.google`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ access_token: newTokens.access_token, expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString() }),
        });
      }
    }

    const gaRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:runReport`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: start || '7daysAgo', endDate: end || 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      }),
    });
    res.json(await gaRes.json());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LinkedIn OAuth callback ───────────────────────────────────────────
app.get('/api/linkedin-oauth-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${APP_URL}/?linkedin_error=missing_code`);
  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET, redirect_uri: `${APP_URL}/api/linkedin-oauth-callback` }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return res.redirect(`${APP_URL}/?linkedin_error=${encodeURIComponent(tokens.error_description || 'token_failed')}`);

    const profile = await (await fetch('https://api.linkedin.com/v2/userinfo', { headers: { 'Authorization': `Bearer ${tokens.access_token}` } })).json();

    await fetch(`${SUPABASE_URL}/rest/v1/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 'linkedin', access_token: tokens.access_token, refresh_token: profile.sub || '', expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }),
    });
    res.redirect(`${APP_URL}/?linkedin_connected=1`);
  } catch (err) { res.redirect(`${APP_URL}/?linkedin_error=${encodeURIComponent(err.message)}`); }
});

// ── LinkedIn post ─────────────────────────────────────────────────────
app.post('/api/linkedin-post', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'No content' });
    const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/integrations?id=eq.linkedin&select=*`, { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } })).json();
    if (!rows.length) return res.status(400).json({ error: 'LinkedIn not connected' });
    const { access_token, refresh_token: personUrn } = rows[0];

    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}`, 'LinkedIn-Version': '202405', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify({ author: `urn:li:person:${personUrn}`, commentary: content, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }),
    });
    if (!postRes.ok) return res.status(postRes.status).json({ error: await postRes.text() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Invite team member ────────────────────────────────────────────────
app.post('/api/invite-team-member', async (req, res) => {
  try {
    const { email, full_name, designation, department, phone, role, status, bio, skills } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ email, email_confirm: true, user_metadata: { full_name } }),
    });
    const inviteData = await inviteRes.json();

    let userId = inviteData.id;
    let existing = false;

    if (!inviteRes.ok) {
      if (inviteData.msg?.includes('already') || inviteData.code === 'email_exists') {
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } });
        const listData = await listRes.json();
        userId = listData.users?.[0]?.id;
        existing = true;
        if (!userId) return res.status(400).json({ error: 'User exists but not found' });
      } else {
        return res.status(400).json({ error: inviteData.msg || 'Failed to invite' });
      }
    }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: userId, email, full_name, designation, department, phone, role: role || 'member', status: status || 'active', bio, skills }),
    });

    res.json({ success: true, existing });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SPA fallback
if (existsSync(distPath)) {
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT} · APP_URL: ${APP_URL}`));
