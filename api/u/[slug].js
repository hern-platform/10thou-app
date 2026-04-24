// Vercel Edge Function — serves the app shell with per-profile OG tags
// injected, so shared profile links render a rich card on LinkedIn / Twitter.
//
// Route: /u/[slug]  (via vercel.json rewrite → /api/u/[slug])

export const config = { runtime: 'edge' };

const SITE = 'https://10thou.com';
const DEFAULT_IMG = `${SITE}/icon-512.png`;

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');

  const user = await fetchUser(slug);
  const shell = await fetchShell(url.origin);

  if (!user) {
    return injectMeta(shell, {
      title: 'Profile not found · 10THOU',
      description: 'No engineer profile matches this link.',
      image: DEFAULT_IMG,
      canonical: `${SITE}/u/${encodeURIComponent(slug)}`
    }, null, 404);
  }

  const titlePart = user.title ? ` · ${user.title}` : '';
  const title = `${user.name || 'Engineer'}${titlePart} — 10THOU`;
  const description = user.title
    ? `${user.name} (${user.title}) shares hardware projects and specs on 10THOU.`
    : `${user.name} shares hardware projects and specs on 10THOU.`;
  const image = user.photo_url || DEFAULT_IMG;
  const canonical = `${SITE}/u/${encodeURIComponent(user.slug)}`;

  return injectMeta(shell, { title, description, image, canonical }, user, 200);
}

async function fetchUser(slug) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key || !slug) return null;

  const u = new URL('/rest/v1/users', base);
  u.searchParams.set('slug', `eq.${slug}`);
  u.searchParams.set('select', 'id,name,title,photo_url,slug,auth_active');
  u.searchParams.set('limit', '1');

  try {
    const res = await fetch(u.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cf: { cacheTtl: 60 }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

async function fetchShell(origin) {
  try {
    const res = await fetch(`${origin}/index.html`, { cf: { cacheTtl: 300 } });
    if (res.ok) return await res.text();
  } catch {}
  return '<!doctype html><html><head></head><body></body></html>';
}

function injectMeta(shell, meta, user, status) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:url" content="${escapeAttr(meta.canonical)}">`,
    `<meta property="og:site_name" content="10THOU">`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:image" content="${escapeAttr(meta.image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(meta.image)}">`
  ].join('\n');

  const hydrate = user
    ? `<script>window.__USER__=${JSON.stringify(user).replace(/</g, '\\u003c')};</script>`
    : '';

  let out = shell
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, '');

  out = out.replace(/<\/head>/i, `${tags}\n${hydrate}\n</head>`);

  return new Response(out, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
