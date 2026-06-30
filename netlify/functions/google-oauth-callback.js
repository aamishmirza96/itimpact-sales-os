// Exchanges Google OAuth code for tokens, stores refresh token in Supabase, redirects back to dashboard
export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const siteUrl = process.env.URL || 'https://itimpact.netlify.app';

  if (!code) {
    return Response.redirect(`${siteUrl}/?google_error=missing_code`, 302);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${siteUrl}/.netlify/functions/google-oauth-callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      return Response.redirect(`${siteUrl}/?google_error=${encodeURIComponent(tokens.error_description || 'token_exchange_failed')}`, 302);
    }

    // Store refresh token in Supabase using service role key
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/integrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'google_analytics',
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    return Response.redirect(`${siteUrl}/?google_connected=1`, 302);
  } catch (err) {
    return Response.redirect(`${siteUrl}/?google_error=${encodeURIComponent(err.message)}`, 302);
  }
};
