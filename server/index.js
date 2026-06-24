import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (avoid dotenv complexity with ESM)
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

// Serve built frontend if dist/ exists (production / Replit)
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

const APOLLO_KEY = process.env.APOLLO_API_KEY;

// ── Health check ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apolloConfigured: !!(APOLLO_KEY && APOLLO_KEY !== 'your_apollo_api_key_here'),
  });
});

// ── Apollo people search ───────────────────────────────────────────────
app.post('/api/leads/search', async (req, res) => {
  if (!APOLLO_KEY || APOLLO_KEY === 'your_apollo_api_key_here') {
    return res.status(400).json({
      error: 'Apollo API key not configured.',
      setup: 'Add your key to the .env file: APOLLO_API_KEY=your_key_here\nGet your key at: app.apollo.io → Settings → Integrations → API Keys',
    });
  }

  try {
    const {
      titles = ['Managing Partner', 'Operating Partner', 'CIO', 'CTO', 'VP Portfolio Operations', 'Head of Value Creation'],
      sectors = ['private equity', 'venture capital', 'healthcare', 'dental'],
      locations = ['New York, NY', 'Chicago, IL', 'San Francisco, CA', 'Boston, MA', 'Los Angeles, CA', 'Houston, TX', 'Dallas, TX'],
      page = 1,
    } = req.body;

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': APOLLO_KEY,
      },
      body: JSON.stringify({
        page,
        per_page: 10,
        person_titles: titles,
        person_seniorities: ['c_suite', 'vp', 'partner', 'director'],
        q_organization_keyword_tags: sectors,
        person_locations: locations,
        organization_num_employees_ranges: ['11,50', '51,200', '201,500'],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Apollo returned ${response.status}`, detail: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// For production/Replit: send index.html for any unmatched route (SPA fallback)
if (existsSync(distPath)) {
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  const configured = !!(APOLLO_KEY && APOLLO_KEY !== 'your_apollo_api_key_here');
  console.log(`Server running on port ${PORT}`);
  console.log(`Apollo: ${configured ? '✓ configured' : '✗ not configured'}`);
});
