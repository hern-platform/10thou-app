// Vercel Edge Function — serves the client-side Supabase config.
//
// The anon key is RLS-gated and safe to expose to the browser; this endpoint
// exists so the same key can be rotated via Vercel env vars without editing
// index.html or running a build step.
//
// Env vars (set in Vercel project settings, Preview + Production):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

export const config = { runtime: 'edge' };

export default function handler() {
  return new Response(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
