-- Better World Challenge · Supabase Storage
-- Ejecuta este SQL en Supabase → SQL Editor.
-- El bucket es público para que el panel web pueda mostrar las fotografías.
-- NUNCA pongas una service_role/secret key en el navegador.

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true, 5242880, 'image/jpeg')
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

-- La app solo sube JPEG ya comprimidos y usa rutas con al menos una carpeta:
-- {firebaseUid}/{archivo}.jpg
-- IMPORTANTE: como esta versión autentica usuarios con Firebase y no con Supabase Auth,
-- Supabase no puede verificar directamente el Firebase UID en esta política. Para
-- producción con fotos privadas, sustituye esta política por una Edge Function/backend
-- que valide el Firebase ID token y genere una URL de subida firmada.

drop policy if exists "BWC evidence jpeg uploads" on storage.objects;
create policy "BWC evidence jpeg uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'evidence'
  and name like '%/%'
  and lower(storage.extension(name)) = 'jpg'
  and coalesce(metadata->>'mimetype', 'image/jpeg') = 'image/jpeg'
);
