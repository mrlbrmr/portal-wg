-- ========================================================================================
-- RESTAURA A ORIGEM (vaga/candidatura) DE ADMISSÕES — só casos inequívocos
--
-- Até o commit 3dc31fe (2026-09-24), PATCH /api/admissoes/[id] gravava "sourceJobId" e
-- "sourceApplicationId" como null a cada edição feita pela antiga /admissoes/[id]/editar.
-- Admissões criadas pelo pipeline (AdmissionLinkModal → POST /api/admissoes) e editadas
-- depois perderam o vínculo com a vaga/candidatura.
--
-- Fonte ÚNICA: job_positions."admissionId" (gravado por job_position_fill()). Restaura só
-- quando:
--   • a admissão está ativa e tem sourceJobId e/ou sourceApplicationId nulos;
--   • ela ocupa exatamente UMA posição;
--   • o valor que sobreviveu (se algum) bate com a posição — nada é sobrescrito;
--   • a candidatura da posição pertence à vaga da posição;
--   • a candidatura não está vinculada a outra admissão ativa.
-- Candidatura excluída (applicationId nulo na posição) → restaura só a vaga.
-- Demais casos (casamento por CPF/e-mail, posição liberada) ficam para revisão manual:
-- ver scripts/diag-admission-origin.sql.
--
-- Cada restauração deixa uma linha em admission_activity_log (action ORIGIN_RESTORED, com
-- os valores anteriores em metadata — permite desfazer). A ação não está mapeada em
-- ADMISSION_LOG_ACTIONS, então não aparece no feed de Atividades.
--
-- Idempotente (rodar de novo não altera nada). Não mexe em "updatedAt"/"updatedById":
-- restaurar dado perdido não é atividade do RH.
--
--   SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--     supabase/migrations/20260924120000_restore_admission_origin.sql 20260924120000
-- ========================================================================================

alter table public."admissions" disable trigger set_updatedAt;

with pos as (
  select p."admissionId",
         count(*)               as n,
         min(p."id")            as position_id,
         min(p."jobId")         as job_id,
         min(p."applicationId") as app_id
    from public."job_positions" p
   where p."admissionId" is not null
   group by p."admissionId"
),
alvo as (
  select a."id", a."fullName",
         a."sourceJobId"         as old_job_id,
         a."sourceApplicationId" as old_app_id,
         pos.position_id, pos.job_id, pos.app_id
    from public."admissions" a
    join pos on pos."admissionId" = a."id"
   where a."deletedAt" is null
     and (a."sourceJobId" is null or a."sourceApplicationId" is null)
     and pos.n = 1
     and (a."sourceJobId" is null or a."sourceJobId" = pos.job_id)
     and (a."sourceApplicationId" is null or a."sourceApplicationId" = pos.app_id)
     and (pos.app_id is null or exists (
           select 1 from public."applications" ap
            where ap."id" = pos.app_id and ap."jobId" = pos.job_id))
     and not exists (
           select 1 from public."admissions" o
            where o."id" <> a."id" and o."deletedAt" is null and o."sourceApplicationId" = pos.app_id)
     -- só o que muda de fato
     and (a."sourceJobId" is distinct from pos.job_id
          or (a."sourceApplicationId" is null and pos.app_id is not null))
),
restored as (
  update public."admissions" a
     set "sourceJobId"         = alvo.job_id,
         "sourceApplicationId" = coalesce(a."sourceApplicationId", alvo.app_id)
    from alvo
   where a."id" = alvo."id"
  returning a."id", a."sourceJobId", a."sourceApplicationId"
)
insert into public."admission_activity_log"
  ("userId", "admissionId", "entity", "entityId", "action", "description", "metadata")
select null, r."id", 'ADMISSION', r."id", 'ORIGIN_RESTORED',
       'Vínculo com a vaga/candidatura restaurado (correção do PATCH que apagava a origem)',
       jsonb_build_object(
         'subjectName', alvo."fullName",
         'via',         'job_positions.admissionId',
         'positionId',  alvo.position_id,
         'from', jsonb_build_object('sourceJobId', alvo.old_job_id, 'sourceApplicationId', alvo.old_app_id),
         'to',   jsonb_build_object('sourceJobId', r."sourceJobId", 'sourceApplicationId', r."sourceApplicationId"),
         'migration',   '20260924120000'
       )
  from restored r
  join alvo on alvo."id" = r."id";

alter table public."admissions" enable trigger set_updatedAt;
