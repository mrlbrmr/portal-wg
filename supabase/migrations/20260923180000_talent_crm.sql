-- ========================================================================================
-- Banco de Talentos → CRM de talentos
--
-- ADITIVA: nada é removido. O código antigo continua funcionando durante o build
-- (talento_tags/talento_tag_assignments ficam no banco, sem uso, até uma limpeza futura).
--
-- 1. talentos: favorito, área de interesse, status INDISPONIVEL, origem CADASTRO_MANUAL
-- 2. Tags do banco passam a usar o cadastro central (admission_tags) — talento_tag_links
-- 3. Anotações com nome do autor e edição pelo autor
-- 4. Segmentos salvos (guardam FILTROS, nunca uma lista de candidatos)
-- 5. Histórico de ações do CRM visível à equipe (talento_audit_log)
-- 6. "Última atividade" mantida pelo banco (triggers) + recálculo
-- 7. View talentos_crm: situação calculada, resumo do histórico e busca
--
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--            supabase/migrations/20260923180000_talent_crm.sql 20260923180000
-- ========================================================================================

create extension if not exists unaccent with schema extensions;

-- ─── 1. talentos ─────────────────────────────────────────────────────────────────────
alter table "talentos"
  add column if not exists "favorito"      boolean not null default false,
  add column if not exists "areaInteresse" text;

-- Status do BANCO (editável): ATIVO (= Disponível), INDISPONIVEL, ARQUIVADO.
-- "Em processo" e "Contratado" passam a ser CALCULADOS pelas candidaturas (view abaixo);
-- os valores antigos continuam aceitos para o código em produção durante o deploy.
alter table "talentos" drop constraint if exists "talentos_statusBanco_check";
alter table "talentos" add constraint "talentos_statusBanco_check" check ("statusBanco" in (
  'ATIVO', 'INDISPONIVEL', 'ARQUIVADO', 'EM_PROCESSO', 'CONTRATADO', 'NAO_ADERENTE'
));
update "talentos" set "statusBanco" = 'ATIVO'        where "statusBanco" in ('EM_PROCESSO', 'CONTRATADO');
update "talentos" set "statusBanco" = 'INDISPONIVEL' where "statusBanco" = 'NAO_ADERENTE';

alter table "talentos" drop constraint if exists "talentos_origem_check";
alter table "talentos" add constraint "talentos_origem_check" check ("origem" in (
  'CANDIDATURA_ESPONTANEA', 'VAGA_ESPECIFICA', 'INDICACAO', 'IMPORTACAO', 'CADASTRO_MANUAL'
));

create index if not exists "talentos_favorito_idx" on "talentos" ("favorito") where "favorito";

-- ─── 2. Tags: cadastro central (Configurações › Cadastros › Tags) ────────────────────
-- "Excel", "excel" e " EXCEL " são a mesma tag.
create unique index if not exists "admission_tags_name_ci_unique"
  on "admission_tags" (lower(btrim("name")));

create table if not exists "talento_tag_links" (
  "talentoId"   text        not null references "talentos"("id") on delete cascade,
  "tagId"       text        not null references "admission_tags"("id") on delete cascade,
  "createdById" text,
  "createdAt"   timestamptz not null default now(),
  primary key ("talentoId", "tagId")
);
create index if not exists "talento_tag_links_tag_idx" on "talento_tag_links" ("tagId");

alter table "talento_tag_links" enable row level security;
create policy "talento_tag_links_staff_select" on "talento_tag_links"
  for select to authenticated using (public.is_staff());
create policy "talento_tag_links_admin_all" on "talento_tag_links"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── 3. Anotações ────────────────────────────────────────────────────────────────────
alter table "talento_notes"
  add column if not exists "autorNome" text,
  add column if not exists "updatedAt" timestamptz not null default now();

update "talento_notes" n set "autorNome" = u."name"
  from "users" u where u."id" = n."autorId" and n."autorNome" is null;

drop trigger if exists "talento_notes_updated_at" on "talento_notes";
create trigger "talento_notes_updated_at" before update on "talento_notes"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- Como application_notes: admin escreve em nome próprio; só o autor edita; admin exclui.
drop policy if exists "talento_notes_staff_insert" on "talento_notes";
create policy "talento_notes_admin_insert" on "talento_notes"
  for insert to authenticated
  with check (
    public.is_admin()
    and "autorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );
create policy "talento_notes_author_update" on "talento_notes"
  for update to authenticated
  using (
    public.is_admin()
    and "autorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  )
  with check (
    public.is_admin()
    and "autorId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );

-- ─── 4. Segmentos salvos ─────────────────────────────────────────────────────────────
-- Guarda a COMBINAÇÃO de filtros: um talento novo que atenda aos critérios entra no
-- segmento automaticamente.
create table if not exists "talento_segments" (
  "id"            text        primary key default gen_random_uuid()::text,
  "nome"          text        not null check (char_length(btrim("nome")) between 1 and 80),
  "filtros"       jsonb       not null default '{}'::jsonb,
  "criadoPorId"   text        not null,
  "criadoPorNome" text        not null,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create unique index if not exists "talento_segments_nome_unique"
  on "talento_segments" (lower(btrim("nome")));

drop trigger if exists "talento_segments_updated_at" on "talento_segments";
create trigger "talento_segments_updated_at" before update on "talento_segments"
  for each row execute procedure extensions.moddatetime("updatedAt");

alter table "talento_segments" enable row level security;
create policy "talento_segments_staff_select" on "talento_segments"
  for select to authenticated using (public.is_staff());
create policy "talento_segments_admin_all" on "talento_segments"
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── 5. Histórico de ações do CRM ────────────────────────────────────────────────────
-- A equipe vê as ações de relacionamento (não os acessos, que seguem só para admin).
-- Admin registra em nome próprio; o log é append-only (sem update/delete).
create policy "talento_audit_log_admin_insert" on "talento_audit_log"
  for insert to authenticated
  with check (
    public.is_admin()
    and "userId" = coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', auth.uid()::text)
  );
create policy "talento_audit_log_staff_select_crm" on "talento_audit_log"
  for select to authenticated
  using (
    public.is_staff()
    and "acao" in (
      'CRIADO', 'DADOS_EDITADOS', 'TAGS_ALTERADAS', 'STATUS_ALTERADO',
      'ARQUIVADO', 'RESTAURADO', 'ADICIONADO_A_VAGA'
    )
  );

-- ─── 6. Última atividade ─────────────────────────────────────────────────────────────
-- Conta como atividade: candidatura, vínculo a uma candidatura, mudança de etapa,
-- anotação e avaliação concluída (aqui, pelo banco) + cadastro, edição de dados e
-- mudança de status (na aplicação). Abrir o perfil NÃO conta.
create or replace function public.talento_touch_from_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new."talentoId" is not null then
    update "talentos" set "ultimaAtividadeEm" = greatest("ultimaAtividadeEm", now())
     where "id" = new."talentoId";
  end if;
  return new;
end $$;

drop trigger if exists "applications_touch_talento_ins" on "applications";
create trigger "applications_touch_talento_ins" after insert on "applications"
  for each row execute function public.talento_touch_from_application();

drop trigger if exists "applications_touch_talento_upd" on "applications";
create trigger "applications_touch_talento_upd" after update of "talentoId", "stageId" on "applications"
  for each row
  when (new."talentoId" is distinct from old."talentoId" or new."stageId" is distinct from old."stageId")
  execute function public.talento_touch_from_application();

create or replace function public.talento_touch_from_note()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update "talentos" set "ultimaAtividadeEm" = greatest("ultimaAtividadeEm", now())
   where "id" = new."talentoId";
  return new;
end $$;

drop trigger if exists "talento_notes_touch_talento" on "talento_notes";
create trigger "talento_notes_touch_talento" after insert on "talento_notes"
  for each row execute function public.talento_touch_from_note();

create or replace function public.talento_touch_from_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update "talentos" set "ultimaAtividadeEm" = greatest("ultimaAtividadeEm", now())
   where "id" = coalesce(
     new."talentoId",
     (select a."talentoId" from "applications" a where a."id" = new."applicationId")
   );
  return new;
end $$;

drop trigger if exists "assessment_sessions_touch_talento" on "assessment_sessions";
create trigger "assessment_sessions_touch_talento" after update of "submittedAt" on "assessment_sessions"
  for each row when (old."submittedAt" is null and new."submittedAt" is not null)
  execute function public.talento_touch_from_session();

revoke execute on function public.talento_touch_from_application() from public, anon, authenticated;
revoke execute on function public.talento_touch_from_note()        from public, anon, authenticated;
revoke execute on function public.talento_touch_from_session()     from public, anon, authenticated;

-- Recalcula a partir dos eventos reais (o valor antigo usava applications.updatedAt,
-- que muda até com reordenação do Kanban).
update "talentos" t set "ultimaAtividadeEm" = greatest(
  t."createdAt",
  (select max(a."createdAt") from "applications" a where a."talentoId" = t."id"),
  (select max(h."changedAt") from "application_stage_history" h
     join "applications" a on a."id" = h."applicationId" where a."talentoId" = t."id"),
  (select max(n."createdAt") from "talento_notes" n where n."talentoId" = t."id"),
  (select max(s."submittedAt") from "assessment_sessions" s where s."talentoId" = t."id")
);

-- ─── 7. View talentos_crm ────────────────────────────────────────────────────────────
-- security_invoker: respeita o RLS de talentos/applications de quem consulta.
-- situacao (calculada, nesta ordem):
--   ARQUIVADO    → statusBanco = ARQUIVADO (manual)
--   EM_PROCESSO  → candidatura em etapa aberta (OPEN/TEST/ADMISSION) de vaga não encerrada
--   CONTRATADO   → alguma candidatura em etapa WON
--   INDISPONIVEL → statusBanco = INDISPONIVEL (manual)
--   DISPONIVEL   → demais
create or replace view public."talentos_crm" with (security_invoker = true) as
select
  t."id", t."nomeCompleto", t."email", t."telefone", t."cidade", t."estado",
  t."cargoDesejado", t."areaInteresse", t."curriculoUrl", t."curriculoNome",
  t."origem", t."statusBanco", t."favorito", t."ultimaAtividadeEm", t."createdAt",
  coalesce(ap."total", 0)::int                 as "processos",
  coalesce(ap."abertos", 0)::int               as "processosAbertos",
  coalesce(ap."contratado", false)             as "contratado",
  ap."ultimaCandidaturaEm",
  lt."jobId"                                   as "ultimoJobId",
  lt."jobTitle"                                as "ultimoJobTitulo",
  lt."jobArea"                                 as "ultimoJobArea",
  lt."stageName"                               as "ultimaEtapaNome",
  lt."stageKind"                               as "ultimaEtapaTipo",
  cv."lastPosition"                            as "ultimoCargoCv",
  case
    when t."statusBanco" = 'ARQUIVADO'                        then 'ARQUIVADO'
    when coalesce(ap."abertos", 0) > 0                        then 'EM_PROCESSO'
    when coalesce(ap."contratado", false)                     then 'CONTRATADO'
    when t."statusBanco" in ('INDISPONIVEL', 'NAO_ADERENTE')  then 'INDISPONIVEL'
    else 'DISPONIVEL'
  end                                          as "situacao",
  case
    when t."origem" in ('CADASTRO_MANUAL', 'INDICACAO', 'IMPORTACAO', 'CANDIDATURA_ESPONTANEA')
      then t."origem"
    when ap."primeiraOrigem" = 'INTERNAL_REFERRAL' then 'INDICACAO'
    else coalesce(ap."primeiraOrigem", t."origem")
  end                                          as "origemDetalhe",
  coalesce(tg."ids", '{}')                     as "tagIds",
  coalesce(ap."jobIds", '{}')                  as "jobIds",
  coalesce(st."ids", '{}')                     as "etapaIds",
  array_remove(array[t."areaInteresse"] || coalesce(ap."areas", '{}'), null) as "areas",
  coalesce(se."n", 0)::int                     as "avaliacoesConcluidas",
  lower(extensions.unaccent(concat_ws(' ',
    t."nomeCompleto", t."email", t."telefone", regexp_replace(coalesce(t."telefone", ''), '\D', '', 'g'),
    t."cargoDesejado", t."areaInteresse", t."cidade", t."estado", t."resumoProfissional",
    tg."names", ap."titles", cv."lastPosition", cv."skills"
  )))                                          as "busca"
from "talentos" t
left join lateral (
  select
    count(*)                                                        as "total",
    count(*) filter (
      where s."kind" in ('OPEN', 'TEST', 'ADMISSION')
        and j."status"::text not in ('CLOSED', 'FILLED')
    )                                                               as "abertos",
    coalesce(bool_or(s."kind" = 'WON'), false)                      as "contratado",
    max(a."createdAt")                                              as "ultimaCandidaturaEm",
    array_agg(distinct a."jobId")                                   as "jobIds",
    array_agg(distinct j."department") filter (where j."department" is not null) as "areas",
    string_agg(distinct j."title", ' ')                             as "titles",
    (array_agg(a."source" order by a."createdAt"))[1]               as "primeiraOrigem"
  from "applications" a
  join "jobs" j on j."id" = a."jobId"
  left join "application_stages" s on s."id" = a."stageId"
  where a."talentoId" = t."id"
) ap on true
left join lateral (
  select a."jobId", j."title" as "jobTitle", j."department" as "jobArea",
         s."name" as "stageName", s."kind" as "stageKind"
  from "applications" a
  join "jobs" j on j."id" = a."jobId"
  left join "application_stages" s on s."id" = a."stageId"
  where a."talentoId" = t."id"
  order by a."createdAt" desc
  limit 1
) lt on true
left join lateral (
  select a."cv_profile" ->> 'lastPosition' as "lastPosition",
         (select string_agg(x, ' ') from jsonb_array_elements_text(
            case when jsonb_typeof(a."cv_profile" -> 'skills') = 'array'
                 then a."cv_profile" -> 'skills' else '[]'::jsonb end) x) as "skills"
  from "applications" a
  where a."talentoId" = t."id" and a."cv_profile" is not null
  order by a."createdAt" desc
  limit 1
) cv on true
left join lateral (
  select array_agg(l."tagId") as "ids", string_agg(g."name", ' ') as "names"
  from "talento_tag_links" l
  join "admission_tags" g on g."id" = l."tagId"
  where l."talentoId" = t."id"
) tg on true
left join lateral (
  select array_agg(distinct x."stageId") as "ids"
  from (
    select a."stageId" from "applications" a where a."talentoId" = t."id"
    union
    select h."stageId" from "application_stage_history" h
      join "applications" a on a."id" = h."applicationId"
     where a."talentoId" = t."id" and h."stageId" is not null
  ) x
) st on true
left join lateral (
  select count(*) as "n"
  from "assessment_sessions" ss
  where ss."submittedAt" is not null
    and ss."invalidadoEm" is null
    and (
      ss."talentoId" = t."id"
      or ss."applicationId" in (select a."id" from "applications" a where a."talentoId" = t."id")
    )
) se on true;

revoke all on public."talentos_crm" from anon;
grant select on public."talentos_crm" to authenticated;
