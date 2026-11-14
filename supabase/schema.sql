-- TrainMind: database per la versione online.
-- Da eseguire una volta in Supabase: SQL Editor > New query > incolla > Run.
-- Ogni allenatore vede e modifica solo le proprie righe (Row Level Security).

-- Documenti dell'app: squadra, giocatori, partite, settimane, esercizi.
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  doc_id     text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, doc_id)
);

alter table public.docs enable row level security;

drop policy if exists "docs: leggo i miei" on public.docs;
drop policy if exists "docs: creo i miei" on public.docs;
drop policy if exists "docs: modifico i miei" on public.docs;
drop policy if exists "docs: cancello i miei" on public.docs;
create policy "docs: leggo i miei"     on public.docs for select using (user_id = auth.uid());
create policy "docs: creo i miei"      on public.docs for insert with check (user_id = auth.uid());
create policy "docs: modifico i miei"  on public.docs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs: cancello i miei"  on public.docs for delete using (user_id = auth.uid());

-- Aggiornamenti in tempo reale tra PC e telefono (rispettano le stesse regole).
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Uso dell'assistente AI: una riga per richiesta, per il limite giornaliero.
create table if not exists public.ai_usage (
  id         bigserial   primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tier       text,
  created_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: leggo le mie" on public.ai_usage;
drop policy if exists "ai_usage: registro le mie" on public.ai_usage;
create policy "ai_usage: leggo le mie"    on public.ai_usage for select using (user_id = auth.uid());
create policy "ai_usage: registro le mie" on public.ai_usage for insert with check (user_id = auth.uid());
-- Nessuna policy di modifica o cancellazione: il conteggio non si può azzerare dall'app.

create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at);
