// Vercel Edge Function — permanently deletes the authenticated user's
// account. Required by the privacy policy (/privacy) "Deletion" right.
//
// Flow:
//   1. Client sends DELETE /api/account with Authorization: Bearer <jwt>
//      (the Supabase session access token).
//   2. We verify the token by calling Supabase's /auth/v1/user endpoint;
//      the response gives us the user's UUID.
//   3. We call Supabase's admin endpoint to delete the auth.users row.
//      The public.users row is FK'd on delete cascade, so posts, threads,
//      replies, and the user's profile are removed in the same transaction.
//   4. Storage objects (post images) are orphaned — they reference an
//      author_id that no longer exists and are no longer linked from any
//      post row. A periodic cleanup job can remove them later.
//
// Env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (server-only; used only for admin delete)

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ error: 'missing_token' }, 401);

  const base = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  // Verify the JWT by asking GoTrue who it belongs to.
  let userId;
  try {
    const whoami = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` }
    });
    if (!whoami.ok) return json({ error: 'invalid_token' }, 401);
    const user = await whoami.json();
    userId = user && user.id;
    if (!userId) return json({ error: 'invalid_token' }, 401);
  } catch {
    return json({ error: 'auth_check_failed' }, 500);
  }

  // Admin-delete the auth.users row. public.users FK on delete cascade
  // cleans up posts, threads, replies.
  try {
    const del = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (!del.ok && del.status !== 404) {
      return json({ error: 'delete_failed', status: del.status }, 500);
    }
  } catch {
    return json({ error: 'delete_failed' }, 500);
  }

  return json({ ok: true }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
