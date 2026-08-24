-- PRIME-gerechten: coach-only aanpasbare, maar voor iedereen zichtbare
-- gerechten ("Voeding > PRIME gerechten"). Zelfde opzet als
-- prime_programs.sql (Training > PRIME programma's) — draai dit er
-- gewoon los naast in de Supabase SQL editor.

create table if not exists prime_meals (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table prime_meals enable row level security;

-- Iedereen die is ingelogd (coach én elke klant) mag ze lezen/gebruiken.
create policy "prime_meals: everyone reads" on prime_meals
  for select using (auth.uid() is not null);

-- Alleen de coach mag toevoegen, wijzigen of verwijderen.
create policy "prime_meals: coach inserts" on prime_meals
  for insert with check (is_coach());

create policy "prime_meals: coach updates" on prime_meals
  for update using (is_coach());

create policy "prime_meals: coach deletes" on prime_meals
  for delete using (is_coach());
