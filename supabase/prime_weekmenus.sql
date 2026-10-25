-- PRIME weekmenu's: door de coach gemaakte weekmenu's die voor iedereen zichtbaar zijn
-- (Voeding > Weekmenu's). Run dit één keer in de Supabase SQL editor van het bestaande project
-- (na schema.sql: hergebruikt de is_coach()-functie die daar al staat).

create table if not exists prime_weekmenus (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table prime_weekmenus enable row level security;

-- Iedereen die is ingelogd (coach en elke klant) mag ze lezen en laden.
create policy "prime_weekmenus: everyone reads" on prime_weekmenus
  for select using (auth.uid() is not null);

-- Alleen de coach mag toevoegen, wijzigen of verwijderen.
create policy "prime_weekmenus: coach inserts" on prime_weekmenus
  for insert with check (is_coach());

create policy "prime_weekmenus: coach updates" on prime_weekmenus
  for update using (is_coach());

create policy "prime_weekmenus: coach deletes" on prime_weekmenus
  for delete using (is_coach());
