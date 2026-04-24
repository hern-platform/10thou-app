-- 10THOU community — auth trigger + storage bucket for Feed images.

-- ─── Users row created on first LinkedIn login ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_slug  text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'given_name',
    'engineer'
  );
  -- slug: lowercased name + 6 char uuid fragment for uniqueness
  v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')
            || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  v_slug := trim(both '-' from v_slug);

  insert into public.users (
    id, linkedin_sub, email, name, photo_url, slug, auth_active
  ) values (
    new.id,
    new.raw_user_meta_data->>'sub',
    new.email,
    v_name,
    new.raw_user_meta_data->>'picture',
    v_slug,
    true  -- LinkedIn OIDC account is verified at creation
  )
  on conflict (id) do update set
    linkedin_sub = excluded.linkedin_sub,
    email        = coalesce(excluded.email, public.users.email),
    name         = coalesce(public.users.name, excluded.name),
    photo_url    = coalesce(excluded.photo_url, public.users.photo_url),
    auth_active  = true,
    updated_at   = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage: post-images bucket (public read, authed write) ───────────────
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Public can read all images
create policy "public read post-images"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Signed-in + auth_active users may upload
create policy "auth users upload post-images"
  on storage.objects for insert
  with check (
    bucket_id = 'post-images'
    and auth.uid() is not null
    and exists (select 1 from public.users u where u.id = auth.uid() and u.auth_active)
  );

-- Users may delete only their own uploads
create policy "users delete own post-images"
  on storage.objects for delete
  using (
    bucket_id = 'post-images'
    and owner = auth.uid()
  );
