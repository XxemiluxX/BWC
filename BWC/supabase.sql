-- Better World Challenge · Supabase Storage
-- Ejecuta este SQL en Supabase → SQL Editor.
-- El bucket es público para que el panel web pueda mostrar las fotografías.
-- NUNCA pongas una service_role/secret key en el navegador.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', true, 52428800, array['image/jpeg','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = array['image/jpeg','video/mp4','video/webm','video/quicktime'];

-- La app sube fotos JPEG ya comprimidas (máx. 5 MB tras comprimir) o videos MP4/WebM/MOV (máx. 50 MB)
-- usando rutas con al menos una carpeta: {firebaseUid}/{archivo}.{jpg|mp4|webm|mov}
-- NOTA: el plan gratuito de Supabase limita cada archivo a 50 MB.
-- IMPORTANTE: como esta versión autentica usuarios con Firebase y no con Supabase Auth,
-- Supabase no puede verificar directamente el Firebase UID en esta política. Para
-- producción con evidencias privadas, sustituye esta política por una Edge Function/backend
-- que valide el Firebase ID token y genere una URL de subida firmada.

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
