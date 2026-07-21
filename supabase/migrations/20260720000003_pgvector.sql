-- ════════════════════════════════════════════════════════════════════════════
-- Fase 7 — pgvector: fundação para busca semântica de currículos (PT-BR).
-- Desbloqueia a Fase 6b do plano AI-native (busca/ranking semântico sobre CVs).
--
-- Dimensão 1024 = Cohere embed-multilingual-v3.0 (escolha do usuário — melhor
-- qualidade em português). ATENÇÃO: a dimensão é FIXA na coluna + índice HNSW;
-- trocar de provedor/dimensão depois exige recriar a coluna e re-embeddar tudo.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists vector schema extensions;

-- Embeddings derivados das candidaturas. Uma linha por (application, kind): o
-- `kind` permite embeddar partes distintas no futuro (texto do CV, perfil
-- estruturado, etc.) sem mudar o schema. `model` registra qual modelo gerou o
-- vetor (p/ reprocessar se trocar de provedor). `content` guarda o texto-fonte
-- (opcional; útil p/ re-embeddar sem reprocessar o PDF).
create table if not exists "application_embeddings" (
  "id"            text primary key default gen_random_uuid()::text,
  "applicationId" text not null references "applications"("id") on delete cascade,
  "kind"          text not null default 'resume_text',
  "content"       text,
  "embedding"     vector(1024) not null,
  "model"         text not null,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now(),
  unique ("applicationId", "kind")
);

create index if not exists "application_embeddings_app_idx"
  on "application_embeddings" ("applicationId");

-- Índice ANN (HNSW) com distância de cosseno — casa com embeddings normalizados
-- (Cohere/OpenAI). Consulta: `order by "embedding" <=> $1 limit k`.
create index if not exists "application_embeddings_hnsw_idx"
  on "application_embeddings" using hnsw ("embedding" vector_cosine_ops);

-- updatedAt mantido por trigger (o app não seta), igual às demais tabelas.
create trigger set_updatedAt before update on "application_embeddings"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- ─── RLS: mesma política das tabelas internas (staff lê, admin escreve) ───────
-- Sem acesso anon (dado derivado de candidato = sensível). O pipeline de IA
-- (sweeps/cron) escreve via service_role, que bypassa RLS.
alter table "application_embeddings" enable row level security;
create policy "application_embeddings_staff_select" on "application_embeddings"
  for select to authenticated using (public.is_staff());
create policy "application_embeddings_admin_all" on "application_embeddings"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── Busca semântica (RPC) ───────────────────────────────────────────────────
-- Retorna as candidaturas mais próximas de um vetor de consulta (kNN por cosseno).
-- O operador `<=>` não é expressável via PostgREST → encapsula na função, chamada
-- por supabase-js: rpc('match_application_embeddings', { query_embedding, match_count }).
-- SECURITY INVOKER (padrão) → respeita a RLS do chamador (staff lê; service_role
-- bypassa). `similarity` = 1 - distância_cosseno (1 = idêntico).
create or replace function public.match_application_embeddings(
  query_embedding vector(1024),
  match_count int default 10,
  filter_kind text default null
)
returns table (
  "applicationId" text,
  kind text,
  similarity float
)
language sql stable as $$
  select
    ae."applicationId",
    ae."kind",
    1 - (ae."embedding" <=> query_embedding) as similarity
  from "application_embeddings" ae
  where filter_kind is null or ae."kind" = filter_kind
  order by ae."embedding" <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_application_embeddings(vector, int, text)
  to authenticated, service_role;
