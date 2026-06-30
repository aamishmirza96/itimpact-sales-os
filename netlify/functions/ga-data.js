// Fetches GA4 + Search Console data server-side using stored refresh token
async function getAccessToken() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integrations?id=eq.google_analytics&select=*`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const rows = await res.json();
  if (!rows.length) throw new Error('Google account not connected');
  const row = rows[0];

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokens.error_description || 'Token refresh failed');
  return tokens.access_token;
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start') || '7daysAgo';
    const endDate = url.searchParams.get('end') || 'today';

    const accessToken = await getAccessToken();
    const propertyId = process.env.GA4_PROPERTY_ID;

    const reportRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
    });
    const report = await reportRes.json();
    if (!reportRes.ok) {
      return new Response(JSON.stringify({ error: report.error?.message || 'GA4 request failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
