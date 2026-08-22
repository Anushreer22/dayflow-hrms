-- Phase 5: Storage bucket and policies for leave attachments

-- Create storage bucket for leave attachments
insert into storage.buckets (id, name, public)
values ('leave-attachments', 'leave-attachments', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload files to their own folder
create policy "Users can upload leave attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'leave-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own attachments
create policy "Users can read own leave attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'leave-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to read all attachments (optional, adjust as needed)
create policy "Admins can read all leave attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'leave-attachments'
  and public.is_admin()
);