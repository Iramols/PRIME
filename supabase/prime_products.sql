-- PRIME-producten: coach-only aanpasbare, maar voor iedereen zichtbare
-- aanpassingen en toevoegingen op de basisproducten ("Voeding > Basisproducten").
-- Zelfde opzet als prime_meals.sql -- draai dit er gewoon los naast in de
-- Supabase SQL editor.
--
-- Elke rij is een wijziging op de vaste productlijst (data.js):
--   value = { id, op: 'edit', ...gewijzigde velden }   -> bestaand basisproduct aangepast
--   value = { id, op: 'hide' }                         -> bestaand basisproduct verwijderd
--   value = { id, op: 'new', name, cat, kcal, ... }    -> nieuw product voor iedereen

create table if not exists prime_products (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table prime_products enable row level security;

-- Iedereen die is ingelogd (coach én elke klant) mag ze lezen.
create policy "prime_products: everyone reads" on prime_products
  for select using (auth.uid() is not null);

-- Alleen de coach mag toevoegen, wijzigen of verwijderen.
create policy "prime_products: coach inserts" on prime_products
  for insert with check (is_coach());

create policy "prime_products: coach updates" on prime_products
  for update using (is_coach());

create policy "prime_products: coach deletes" on prime_products
  for delete using (is_coach());
