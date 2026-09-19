-- Foto-opslag voor eigen producten/gerechten/oefeningen/programma's en
-- PRIME-content. Foto's staan als losse bestanden in Supabase Storage;
-- in de app-data (client_state/prime_meals/prime_programs) staat alleen
-- nog de publieke URL i.p.v. een megabyte-grote base64-tekst. Draai dit
-- eenmalig in de Supabase SQL editor.

-- Publieke bucket (foto's zijn gewone app-content, geen gevoelige data;
-- de URL's zijn niet te raden en worden alleen in de app getoond).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prime-photos', 'prime-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Lezen: iedereen (nodig voor <img src="...">).
create policy "prime-photos: public read" on storage.objects
  for select using (bucket_id = 'prime-photos');

-- Uploaden: ingelogde gebruikers, alleen in hun eigen map (<user-id>/...).
create policy "prime-photos: upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prime-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verwijderen: eigen bestanden, of alles voor de coach.
create policy "prime-photos: delete own or coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prime-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_coach())
  );
