-- Banco de Talentos: chaves normalizadas de localização para os filtros.
--
-- As cidades vêm digitadas pelo candidato ("Curitiba", "CURITIBA", "Curitiba "), então o
-- filtro agrupa por uma chave sem acento/caixa/espaços e exibe a grafia mais comum.
-- Aditiva: a view ganha colunas no FIM (create or replace view só permite acrescentar).
-- Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--   supabase/migrations/20260923180002_talent_crm_location_keys.sql 20260923180002

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

create or replace function public.talentos_crm_facets()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with v as materialized (
    select "cidade", "cidadeChave", "ufChave", "cargoDesejado", "areas", "origemDetalhe",
           "situacao", "favorito", "createdAt"
    from "talentos_crm"
  ),
  ativos as (select * from v where "situacao" <> 'ARQUIVADO')
  select jsonb_build_object(
    'total',      (select count(*) from ativos),
    'arquivados', (select count(*) from v where "situacao" = 'ARQUIVADO'),
    'favoritos',  (select count(*) from ativos where "favorito"),
    'novosMes',   (select count(*) from ativos
                    where "createdAt" >= (date_trunc('month', now() at time zone 'America/Sao_Paulo')
                                          at time zone 'America/Sao_Paulo')),
    'situacoes',  (select coalesce(jsonb_object_agg("situacao", n), '{}'::jsonb)
                     from (select "situacao", count(*) n from v group by 1) x),
    'estados',    (select coalesce(jsonb_agg(jsonb_build_object('value', "ufChave", 'label', "ufChave", 'count', n) order by "ufChave"), '[]'::jsonb)
                     from (select "ufChave", count(*) n from ativos where "ufChave" is not null group by 1) x),
    'cidades',    (select coalesce(jsonb_agg(jsonb_build_object('value', "cidadeChave", 'label', label, 'count', n) order by "cidadeChave"), '[]'::jsonb)
                     from (select "cidadeChave", mode() within group (order by btrim("cidade")) as label, count(*) n
                             from ativos where "cidadeChave" is not null group by 1) x),
    'cargos',     (select coalesce(jsonb_agg(jsonb_build_object('value', c, 'label', c, 'count', n) order by c), '[]'::jsonb)
                     from (select btrim("cargoDesejado") c, count(*) n from ativos
                            where coalesce(btrim("cargoDesejado"), '') <> '' group by 1) x),
    'areas',      (select coalesce(jsonb_agg(jsonb_build_object('value', a, 'label', a, 'count', n) order by a), '[]'::jsonb)
                     from (select a, count(*) n from ativos, unnest("areas") a where coalesce(a, '') <> '' group by 1) x),
    'origens',    (select coalesce(jsonb_agg(jsonb_build_object('value', "origemDetalhe", 'count', n) order by n desc), '[]'::jsonb)
                     from (select "origemDetalhe", count(*) n from ativos where "origemDetalhe" is not null group by 1) x)
  );
$$;

revoke execute on function public.talentos_crm_facets() from public, anon;
grant execute on function public.talentos_crm_facets() to authenticated;
