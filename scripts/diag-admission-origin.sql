-- ========================================================================================
-- DIAGNÓSTICO (SOMENTE LEITURA) — admissões que perderam o vínculo com a vaga/candidatura
--
-- Até o commit 3dc31fe (2026-09-24), PATCH /api/admissoes/[id] gravava "sourceJobId" e
-- "sourceApplicationId" como null a cada "Salvar" da antiga /admissoes/[id]/editar
-- (bug presente desde ccddc77, 2026-08-03). Esta consulta lista as admissões ativas com
-- origem nula e as evidências para recuperá-la. Não altera nada.
--
--   Rodar em transação READ ONLY (Supabase SQL Editor ou psql):
--     begin transaction read only; <esta consulta>; rollback;
--
-- Evidências:
--   • job_positions."admissionId"  — a posição da vaga que a admissão ocupa (FILLED). É o
--     vínculo gravado por job_position_fill(); é a ÚNICA fonte usada pela migração
--     20260924120000_restore_admission_origin.sql.
--   • job_events POSITION_RELEASED — a admissão ocupou uma posição que depois foi liberada.
--   • applications                 — mesma pessoa (CPF, e-mail ou talento) e mesma vaga
--     (quando "sourceJobId" sobreviveu), criada antes da admissão e sem outra admissão ativa.
--   • admission_activity_log ADMISSION_UPDATED após a criação — prova de edição pelo
--     formulário. Só existe desde 2e0f7a0 (2026-09-23): edições anteriores não deixaram log,
--     então a ausência dele NÃO prova que a admissão não foi editada.
--
-- Classificação:
--   RESTAURAR_POR_POSICAO   — a migração restaura (inequívoco).
--   REVISAR_POSICAO         — há posição, mas algo impede a restauração automática (motivo).
--   REVISAR_CANDIDATURA     — sem posição; exatamente 1 candidatura compatível. Revisão manual.
--   REVISAR_AMBIGUO         — sem posição; várias candidaturas compatíveis.
--   REVISAR_POSICAO_LIBERADA— só evidência em job_events (posição liberada/desistência).
--   SEM_EVIDENCIA           — provavelmente admissão criada à mão (origem nula é esperada).
-- ========================================================================================
with alvo as (
  select a."id", a."fullName", a."createdAt", a."updatedAt",
         a."sourceJobId", a."sourceApplicationId",
         nullif(regexp_replace(coalesce(a."cpf", ''), '[^0-9]', '', 'g'), '') as cpf_digits,
         nullif(lower(trim(a."email")), '')                                    as email_norm
    from public."admissions" a
   where a."deletedAt" is null
     and (a."sourceJobId" is null or a."sourceApplicationId" is null)
),
pos as (
  select p."admissionId",
         count(*)                   as n,
         min(p."id")                as position_id,
         min(p."jobId")             as job_id,
         min(p."applicationId")     as app_id,
         min(p."positionNumber")    as position_number
    from public."job_positions" p
   where p."admissionId" in (select "id" from alvo)
   group by p."admissionId"
),
pos_check as (
  select t."id",
         pos.n, pos.position_id, pos.job_id, pos.app_id, pos.position_number,
         case
           when pos.n > 1 then 'admissão ocupa mais de uma posição'
           when t."sourceJobId" is not null and t."sourceJobId" <> pos.job_id
             then 'sourceJobId atual difere da vaga da posição'
           when t."sourceApplicationId" is not null and t."sourceApplicationId" is distinct from pos.app_id
             then 'sourceApplicationId atual difere da candidatura da posição'
           when pos.app_id is not null and not exists (
                  select 1 from public."applications" ap where ap."id" = pos.app_id and ap."jobId" = pos.job_id)
             then 'candidatura da posição não pertence à vaga'
           when pos.app_id is not null and exists (
                  select 1 from public."admissions" o
                   where o."id" <> t."id" and o."deletedAt" is null and o."sourceApplicationId" = pos.app_id)
             then 'candidatura já vinculada a outra admissão ativa'
           when t."sourceJobId" is not distinct from pos.job_id
            and not (t."sourceApplicationId" is null and pos.app_id is not null)
             then 'nada a restaurar (candidatura da posição foi excluída)'
         end as bloqueio
    from alvo t
    join pos on pos."admissionId" = t."id"
),
released as (
  select e."data"->>'admissionId' as adm_id,
         count(*)                  as n,
         min(e."jobId")            as job_id,
         min(e."data"->>'applicationId') as app_id
    from public."job_events" e
   where e."type" = 'POSITION_RELEASED'
     and e."data"->>'admissionId' in (select "id" from alvo)
   group by 1
),
apps as (
  select t."id" as adm_id, ap."id" as app_id, ap."jobId", s."kind" as stage_kind
    from alvo t
    join public."applications" ap
      on ap."createdAt" <= t."createdAt"
     and (t."sourceJobId" is null or ap."jobId" = t."sourceJobId")
     and (
           (length(t.cpf_digits) = 11 and ap."cpf_digits" = t.cpf_digits)
        or (t.email_norm is not null and lower(trim(ap."email")) = t.email_norm)
        or exists (
             select 1 from public."talentos" tl
              where tl."id" = ap."talentoId"
                and ((length(t.cpf_digits) = 11 and tl."cpfDigits" = t.cpf_digits)
                  or (t.email_norm is not null and tl."emailNormalizado" = t.email_norm)))
         )
    left join public."application_stages" s on s."id" = ap."stageId"
   where not exists (
           select 1 from public."admissions" o
            where o."id" <> t."id" and o."deletedAt" is null and o."sourceApplicationId" = ap."id")
),
apps_agg as (
  select adm_id,
         count(*)                                                        as n,
         count(*) filter (where stage_kind in ('WON', 'ADMISSION'))      as n_contratacao,
         min(app_id)                                                     as app_id,
         min("jobId")                                                    as job_id
    from apps
   group by adm_id
),
upd as (
  select l."admissionId", count(*) as n, min(l."createdAt") as primeira
    from public."admission_activity_log" l
    join alvo t on t."id" = l."admissionId"
   where l."action" = 'ADMISSION_UPDATED'
     and l."createdAt" > t."createdAt"
   group by l."admissionId"
)
select
  case
    when pc."id" is not null and pc.bloqueio is null then 'RESTAURAR_POR_POSICAO'
    when pc."id" is not null                         then 'REVISAR_POSICAO'
    when aa.n = 1                                    then 'REVISAR_CANDIDATURA'
    when aa.n > 1                                    then 'REVISAR_AMBIGUO'
    when r.n >= 1                                    then 'REVISAR_POSICAO_LIBERADA'
    else                                                  'SEM_EVIDENCIA'
  end                                   as classificacao,
  pc.bloqueio,
  t."id"                                as admission_id,
  t."fullName",
  t."createdAt"::date                   as criada_em,
  t."updatedAt" > t."createdAt" + interval '1 minute' as editada_depois,
  coalesce(u.n, 0)                      as logs_admission_updated,
  t."sourceJobId"                       as source_job_atual,
  t."sourceApplicationId"               as source_app_atual,
  -- evidência 1: posição
  pc.job_id                             as pos_job_id,
  pc.app_id                             as pos_application_id,
  pc.position_number                    as pos_numero,
  pc.n                                  as pos_qtd,
  -- evidência 2: posição liberada
  r.job_id                              as liberada_job_id,
  r.app_id                              as liberada_application_id,
  -- evidência 3: candidaturas compatíveis
  coalesce(aa.n, 0)                     as cand_compativeis,
  coalesce(aa.n_contratacao, 0)         as cand_em_contratacao,
  case when aa.n = 1 then aa.job_id end as cand_job_id,
  case when aa.n = 1 then aa.app_id end as cand_application_id
from alvo t
left join pos_check pc on pc."id" = t."id"
left join released  r  on r.adm_id = t."id"
left join apps_agg  aa on aa.adm_id = t."id"
left join upd       u  on u."admissionId" = t."id"
order by classificacao, t."createdAt";
