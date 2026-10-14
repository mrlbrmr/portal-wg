-- Admissão ↔ candidatura: quem tem admissão ligada conta como CONTRATADO no Banco de Talentos.
--
-- A central da admissão passa a permitir VINCULAR uma admissão a uma candidatura do processo
-- seletivo (admissions."sourceApplicationId"/"sourceJobId" — as mesmas colunas que o
-- "Contratar" do pipeline já grava). Com o vínculo, o talento é a mesma pessoa da admissão:
--   • "contratado" = alguma candidatura em etapa WON  OU  com admissão (não excluída) ligada;
--   • "abertos"    = não conta a candidatura que já virou admissão (ela saiu do processo).
-- Mesmas colunas, na mesma ordem: create or replace view basta (aditiva para o código antigo).
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs --   supabase/migrations/20261014150000_admission_application_link.sql 20261014150000

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
  )))                                          as "busca",
  nullif(lower(extensions.unaccent(btrim(coalesce(t."cidade", '')))), '') as "cidadeChave",
  nullif(upper(btrim(coalesce(t."estado", ''))), '')                      as "ufChave"
from "talentos" t
left join lateral (
  select
    count(*)                                                        as "total",
    count(*) filter (
      where s."kind" in ('OPEN', 'TEST', 'ADMISSION')
        and j."status"::text not in ('CLOSED', 'FILLED')
        and adm."id" is null
    )                                                               as "abertos",
    coalesce(bool_or(s."kind" = 'WON' or adm."id" is not null), false) as "contratado",
    max(a."createdAt")                                              as "ultimaCandidaturaEm",
    array_agg(distinct a."jobId")                                   as "jobIds",
    array_agg(distinct j."department") filter (where j."department" is not null) as "areas",
    string_agg(distinct j."title", ' ')                             as "titles",
    (array_agg(a."source" order by a."createdAt"))[1]               as "primeiraOrigem"
  from "applications" a
  join "jobs" j on j."id" = a."jobId"
  left join "application_stages" s on s."id" = a."stageId"
  left join lateral (
    select ad."id" from "admissions" ad
     where ad."sourceApplicationId" = a."id" and ad."deletedAt" is null
     limit 1
  ) adm on true
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
