// Vercel Edge Function — serves the app shell with per-thread OG tags so
// shared Forum links render rich cards on LinkedIn/Twitter.
//
// Route: /thread/[id]  (via vercel.json rewrite → /api/thread/[id])

export const config = { runtime: 'edge' };

const SITE = 'https://10thou.com';
const DEFAULT_IMG = `${SITE}/icon-512.png`;

export default async function handler(request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').filter(Boolean).pop();

  const thread = await fetchThread(id);
  const shell = await fetchShell(url.origin);

  if (!thread) {
    return injectMeta(shell, {
      title: 'Thread not found · 10THOU',
      description: 'This thread may have been removed or the link is broken.',
      image: DEFAULT_IMG,
      canonical: `${SITE}/thread/${encodeURIComponent(id)}`
    }, null, 404);
  }

  const authorName = thread.author?.name || 'A 10THOU engineer';
  const authorTitle = thread.author?.title ? ` · ${thread.author.title}` : '';
  const title = `${thread.title} — 10THOU Forum`;
  const description = (thread.body || `Question from ${authorName}${authorTitle}`).slice(0, 200);
  const canonical = `${SITE}/thread/${thread.id}`;

  return injectMeta(shell, { title, description, image: DEFAULT_IMG, canonical }, thread, 200);
}

async function fetchThread(id) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key || !isUuid(id)) return null;

  const u = new URL('/rest/v1/threads', base);
  u.searchParams.set('id', `eq.${id}`);
  u.searchParams.set('select', 'id,title,body,domain,spec_tags,created_at,author:author_id(name,title,slug,photo_url)');
  u.searchParams.set('limit', '1');

  try {
    const res = await fetch(u.toString(), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cf: { cacheTtl: 60 }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch { return null; }
}

async function fetchShell(origin) {
  try {
    const res = await fetch(`${origin}/index.html`, { cf: { cacheTtl: 300 } });
    if (res.ok) return await res.text();
  } catch {}
  return '<!doctype html><html><head></head><body></body></html>';
}

function injectMeta(shell, meta, thread, status) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}">`,
    `<meta property="og:type" content="article">`,
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

  const hydrate = thread
    ? `<script>window.__THREAD__=${JSON.stringify(thread).replace(/</g, '\\u003c')};</script>`
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

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
