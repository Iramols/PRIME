-- Feedback van deelnemers (knop "Feedback geven" en verzoek tot verwijdering
-- van gegevens). Deelnemers kunnen alleen zelf iets toevoegen; alleen de
-- coach kan feedback lezen, afvinken of verwijderen. Draai dit eenmalig in
-- de Supabase SQL editor.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'other' check (kind in ('bug', 'idea', 'other', 'delete_request')),
  message text not null check (char_length(message) between 1 and 2000),
  app_build text,
  user_agent text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback: insert own" on feedback
  for insert to authenticated
  with check (client_id = auth.uid());

create policy "feedback: coach reads" on feedback
  for select using (is_coach());

create policy "feedback: coach updates" on feedback
  for update using (is_coach());

create policy "feedback: coach deletes" on feedback
  for delete using (is_coach());
