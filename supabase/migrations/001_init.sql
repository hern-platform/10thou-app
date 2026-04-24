-- 10THOU community schema — initial
-- Applies to: Feed, Forum, LinkedIn auth, Stripe Pro binding.
-- Access model: free read; LinkedIn sign-in required to post; Pro is an
-- independent tool-feature flag unrelated to posting rights.

create extension if not exists "pgcrypto";

-- ─── USERS ──────────────────────────────────────────────────────────────────
-- users.id = auth.users.id (Supabase-managed auth). A row is created by either
-- LinkedIn OIDC login or Stripe purchase; rows merge on email when both occur.
create table if not exists public.users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  linkedin_sub       text unique,
  email              text,
  name               text,
  title              text,
  photo_url          text,
  slug               text unique,
  auth_active        boolean not null default false,  -- LinkedIn verified → may post
  pro_active         boolean not null default false,  -- Stripe paid → tool features
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_users_slug on public.users(slug);

-- ─── POSTS (Feed) ───────────────────────────────────────────────────────────
do $$ begin
  create type public.post_type as enum ('project','spec','buildlog','question');
exception when duplicate_object then null; end $$;

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.users(id) on delete cascade,
  type       public.post_type not null,
  domain     text not null,                         -- e.g. 'Sealing', 'Machining'
  caption    text,
  image_url  text,
  spec_tags  jsonb not null default '[]'::jsonb,    -- [{kind:'oring', id:'AS568-112'}, ...]
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_created on public.posts(created_at desc);
create index if not exists idx_posts_domain  on public.posts(domain);
create index if not exists idx_posts_author  on public.posts(author_id);

-- ─── THREADS (Forum) ────────────────────────────────────────────────────────
create table if not exists public.threads (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.users(id) on delete cascade,
  title      text not null,
  body       text,
  domain     text not null,
  spec_tags  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_threads_created on public.threads(created_at desc);
create index if not exists idx_threads_domain  on public.threads(domain);

create table if not exists public.replies (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_replies_thread on public.replies(thread_id, created_at);

-- ─── REPORTS (carried for future moderation; not surfaced in v1 UI) ─────────
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','thread','reply','user')),
  target_id   uuid not null,
  reporter_id uuid references public.users(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.users   enable row level security;
alter table public.posts   enable row level security;
alter table public.threads enable row level security;
alter table public.replies enable row level security;
alter table public.reports enable row level security;

-- Public read (free-to-read model)
create policy "public read users"   on public.users   for select using (true);
create policy "public read posts"   on public.posts   for select using (true);
create policy "public read threads" on public.threads for select using (true);
create policy "public read replies" on public.replies for select using (true);

-- Author-owned writes. Posting requires auth_active = true (LinkedIn verified).
create policy "author insert posts" on public.posts
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.users u where u.id = auth.uid() and u.auth_active)
  );
create policy "author update posts" on public.posts for update using (auth.uid() = author_id);
create policy "author delete posts" on public.posts for delete using (auth.uid() = author_id);

create policy "author insert threads" on public.threads
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.users u where u.id = auth.uid() and u.auth_active)
  );
create policy "author update threads" on public.threads for update using (auth.uid() = author_id);
create policy "author delete threads" on public.threads for delete using (auth.uid() = author_id);

create policy "author insert replies" on public.replies
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.users u where u.id = auth.uid() and u.auth_active)
  );
create policy "author update replies" on public.replies for update using (auth.uid() = author_id);
create policy "author delete replies" on public.replies for delete using (auth.uid() = author_id);

-- Users can read/update their own row; the Stripe webhook uses the service role
-- key and bypasses RLS when toggling pro_active.
create policy "self update users" on public.users for update using (auth.uid() = id);

-- Reports: any signed-in user can file; none can read (service role only).
create policy "signed in insert reports" on public.reports
  for insert with check (auth.uid() is not null);
