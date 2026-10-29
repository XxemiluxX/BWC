
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'];


drop policy if exists "BWC evidence jpeg uploads" on storage.objects;
drop policy if exists "ECRA evidence uploads" on storage.objects;
create policy "ECRA evidence uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'evidence'
  and name like '%/%'
  and lower(storage.extension(name)) in ('jpg','mp4','webm','mov')
  and coalesce(metadata->>'mimetype', 'image/jpeg') in ('image/jpeg','video/mp4','video/webm','video/quicktime')
);

