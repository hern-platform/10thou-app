// Vercel Edge Function — serves the app shell with per-post OG tags injected,
// so LinkedIn/Twitter crawlers get a rich card while humans still get the SPA.
//
// Env vars (set in Vercel project settings):
//   SUPABASE_URL       — https://xxx.supabase.co
//   SUPABASE_ANON_KEY  — public anon key (RLS-gated)
//
// Route: /post/[id]  (via vercel.json rewrite → /api/post/[id])

export const config = { runtime: 'edge' };

const SITE = 'https://10thou.com';
const DEFAULT_IMG = `${SITE}/icon-512.png`;

export default async function handler(request) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').filter(Boolean).pop();

  const post = await fetchPost(id, url.origin);
  const shell = await fetchShell(url.origin);

  if (!post) {
    return injectMeta(shell, {
      title: 'Post not found · 10THOU',
      description: 'This post may have been removed or the link is broken.',
      image: DEFAULT_IMG,
      canonical: `${SITE}/post/${encodeURIComponent(id)}`,
      ogType: 'website'
    }, null, 404);
  }

  const authorName = post.author?.name || 'A 10THOU engineer';
  const authorTitle = post.author?.title ? ` · ${post.author.title}` : '';
  const title = `${authorName}${authorTitle} — ${post.domain || '10THOU'}`;
  const description = (post.caption || 'Hardware project shared on 10THOU.').slice(0, 200);
  const image = post.image_url || DEFAULT_IMG;
  const canonical = `${SITE}/post/${post.id}`;

  return injectMeta(shell, { title, description, image, canonical, ogType: 'article' }, post, 200);
}

async function fetchPost(id, origin) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!base || !key || !isUuid(id)) return null;

  const u = new URL('/rest/v1/posts', base);
  u.searchParams.set('id', `eq.${id}`);
  u.searchParams.set('select', 'id,type,domain,caption,image_url,spec_tags,created_at,author:author_id(name,title,slug,photo_url)');
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

function injectMeta(shell, meta, post, status) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}">`,
    `<meta property="og:type" content="${meta.ogType}">`,
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

  const hydrate = post
    ? `<script>window.__POST__=${JSON.stringify(post).replace(/</g, '\\u003c')};</script>`
    : '';

  // Strip shell's existing <title> and canonical/og tags, then inject fresh ones.
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
