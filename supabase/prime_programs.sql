-- PRIME-programma's: coach-only aanpasbare, maar voor iedereen zichtbare
-- programma's ("Training > PRIME programma's").
-- Run dit één keer in de Supabase SQL editor van het bestaande project
-- (na schema.sql — hergebruikt de is_coach()-functie die daar al staat).

create table if not exists prime_programs (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table prime_programs enable row level security;

-- Iedereen die is ingelogd (coach én elke klant) mag ze lezen/gebruiken.
create policy "prime_programs: everyone reads" on prime_programs
  for select using (auth.uid() is not null);

-- Alleen de coach mag toevoegen, wijzigen of verwijderen.
create policy "prime_programs: coach inserts" on prime_programs
  for insert with check (is_coach());

create policy "prime_programs: coach updates" on prime_programs
  for update using (is_coach());

create policy "prime_programs: coach deletes" on prime_programs
  for delete using (is_coach());
