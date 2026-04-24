// Vercel Edge Function — receives Stripe webhooks and flips users.pro_active
// to true on a successful checkout.
//
// Env vars (Vercel → Settings → Environment Variables):
//   STRIPE_WEBHOOK_SECRET       whsec_... (from the webhook endpoint in Stripe)
//   SUPABASE_URL                https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   service_role key (bypasses RLS; never exposed
//                               to the browser)
//
// Stripe configuration: in the Stripe dashboard → Developers → Webhooks,
// add endpoint https://<your-domain>/api/stripe/webhook and subscribe to
// `checkout.session.completed`. Copy the signing secret into
// STRIPE_WEBHOOK_SECRET.
//
// Client integration: the Stripe Payment Link is appended with
//   ?client_reference_id=<users.id>&prefilled_email=<email>
// when the user is signed in (see index.html showProPayStep). If no
// client_reference_id is provided we fall back to matching by email so
// anonymous purchases can still be claimed once the same email signs in.

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await request.text();
  const sigHeader = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sigHeader || !secret) {
    return new Response('missing signature or secret', { status: 400 });
  }

  const verified = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!verified) {
    return new Response('invalid signature', { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response('invalid json', { status: 400 }); }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object || {};
    const userId = s.client_reference_id || null;
    const customerId = s.customer || null;
    const email = s.customer_email
      || (s.customer_details && s.customer_details.email)
      || null;

    const patch = { pro_active: true };
    if (customerId) patch.stripe_customer_id = customerId;

    let ok = false;
    if (userId) {
      ok = await sbAdminPatch('users', `id=eq.${encodeURIComponent(userId)}`, patch);
    } else if (email) {
      // Anonymous buyer — match by email. Only works if the account
      // already exists (signed in with the same LinkedIn email before buying).
      ok = await sbAdminPatch('users', `email=eq.${encodeURIComponent(email)}`, patch);
    }

    // Always respond 200 so Stripe doesn't retry; unmatched purchases are a
    // known gap (anonymous buyer who never signs in on this email).
    return new Response(JSON.stringify({ ok, matched: Boolean(userId || email) }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Ignore other event types — 200 OK so Stripe stops retrying.
  return new Response('ignored', { status: 200 });
}

async function sbAdminPatch(table, filter, body) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return false;
  try {
    const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Stripe's signature header is: t=<ts>,v1=<hex>[,v1=<hex>...]
// Signed payload is `${t}.${body}`; signature is HMAC-SHA256 with the
// webhook secret. 5 minute timestamp tolerance guards against replay.
async function verifyStripeSignature(body, header, secret) {
  const parts = {};
  for (const p of header.split(',')) {
    const i = p.indexOf('=');
    if (i === -1) continue;
    const k = p.slice(0, i);
    const v = p.slice(i + 1);
    // Accumulate all v1 values in an array; any match is acceptable.
    if (k === 'v1') (parts.v1 = parts.v1 || []).push(v);
    else parts[k] = v;
  }
  const t = parts.t;
  const sigs = parts.v1 || [];
  if (!t || !sigs.length) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parseInt(t, 10)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`));
  const expected = toHex(new Uint8Array(sigBuf));

  return sigs.some(sig => timingSafeEq(expected, sig));
}

function toHex(u8) {
  let out = '';
  for (let i = 0; i < u8.length; i++) out += u8[i].toString(16).padStart(2, '0');
  return out;
}
function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
