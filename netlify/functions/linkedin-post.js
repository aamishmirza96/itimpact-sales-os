// Publishes a text post to LinkedIn using the stored access token
export default async (req) => {
  try {
    const { content } = await req.json();
    if (!content) return new Response(JSON.stringify({ error: 'No content provided' }), { status: 400 });

    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/integrations?id=eq.linkedin&select=*`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const rows = await res.json();
    if (!rows.length) return new Response(JSON.stringify({ error: 'LinkedIn account not connected' }), { status: 400 });
    const { access_token, refresh_token: personUrn } = rows[0];

    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'LinkedIn-Version': '202405',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${personUrn}`,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      return new Response(JSON.stringify({ error: errText }), { status: postRes.status, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
