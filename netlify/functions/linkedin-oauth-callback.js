// Exchanges LinkedIn OAuth code for an access token, fetches profile URN, stores in Supabase
export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const siteUrl = process.env.URL || 'https://itimpact.netlify.app';

  if (!code) return Response.redirect(`${siteUrl}/?linkedin_error=missing_code`, 302);

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: `${siteUrl}/.netlify/functions/linkedin-oauth-callback`,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      return Response.redirect(`${siteUrl}/?linkedin_error=${encodeURIComponent(tokens.error_description || 'token_exchange_failed')}`, 302);
    }

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/integrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'linkedin',
        access_token: tokens.access_token,
        refresh_token: profile.sub || '', // storing the person URN id here for reuse
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    return Response.redirect(`${siteUrl}/?linkedin_connected=1`, 302);
  } catch (err) {
    return Response.redirect(`${siteUrl}/?linkedin_error=${encodeURIComponent(err.message)}`, 302);
  }
};
