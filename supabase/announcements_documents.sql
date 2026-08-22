-- Dayflow HRMS: Phase 8 additions
-- Announcements table, documents table, and storage buckets for
-- profile pictures and documents.

-- ===== Announcements =====

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- All authenticated users can read announcements
drop policy if exists "Announcements are readable by all" on public.announcements;
create policy "Announcements are readable by all"
on public.announcements
for select
to authenticated
using (true);

-- Only admins can create announcements
drop policy if exists "Admins can create announcements" on public.announcements;
create policy "Admins can create announcements"
on public.announcements
for insert
to authenticated
with check (
  public.is_admin()
  and created_by = auth.uid()
);

-- Only admins can update/delete announcements
drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
on public.announcements
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
on public.announcements
for delete
to authenticated
using (public.is_admin());

-- ===== Documents =====

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

-- Users can read their own documents; admins can read all
drop policy if exists "Users can read own documents" on public.documents;
create policy "Users can read own documents"
on public.documents
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Users can insert documents for themselves only
drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
on public.documents
for insert
to authenticated
with check (user_id = auth.uid());

-- Users can delete their own documents
drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
on public.documents
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- ===== Storage buckets =====

-- Public bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Users upload only into their own folder
drop policy if exists "Users can upload own profile pictures" on storage.objects;
create policy "Users can upload own profile pictures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public bucket for documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Users upload only into their own folder
drop policy if exists "Users can upload own documents" on storage.objects;
create policy "Users can upload own documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
