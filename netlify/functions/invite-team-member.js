// Invites a new team member via Supabase Auth and upserts their profile
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, full_name, designation, department, phone, role, status, bio, skills } = await req.json();

    if (!email) return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Invite user via Supabase Auth Admin API (sends invite email)
    const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: { full_name },
      }),
    });

    const inviteData = await inviteRes.json();

    if (!inviteRes.ok) {
      // If user already exists, try to find them
      if (inviteData.msg?.includes('already') || inviteData.code === 'email_exists') {
        // Update existing profile instead
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
        });
        const listData = await listRes.json();
        const existingUser = listData.users?.[0];
        if (!existingUser) return new Response(JSON.stringify({ error: 'User exists but could not be found' }), { status: 400 });

        await upsertProfile(SUPABASE_URL, SERVICE_KEY, existingUser.id, { email, full_name, designation, department, phone, role: role||'member', status: status||'active', bio, skills });
        return new Response(JSON.stringify({ success: true, existing: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: inviteData.msg || inviteData.message || 'Failed to invite user' }), { status: 400 });
    }

    const userId = inviteData.id;

    // 2. Upsert their profile
    await upsertProfile(SUPABASE_URL, SERVICE_KEY, userId, { email, full_name, designation, department, phone, role: role||'member', status: status||'active', bio, skills });

    return new Response(JSON.stringify({ success: true, userId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

async function upsertProfile(supabaseUrl, serviceKey, userId, data) {
  await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ id: userId, ...data }),
  });
}
