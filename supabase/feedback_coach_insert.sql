-- Feedback namens een klant: de coach die bij een klant is ingelogd (Wissel klant) geeft feedback op naam van die klant.
-- Run dit eenmalig in de Supabase SQL editor (na feedback.sql). Zonder deze regel blijft zulke feedback op naam van de coach staan.

create policy "feedback: coach inserts for clients" on feedback
  for insert to authenticated
  with check (is_coach());
