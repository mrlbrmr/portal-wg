-- ========================================================================================
-- RESTAURA A ORIGEM (vaga/candidatura) DE ADMISSÕES — só casos inequívocos
--
-- Até o commit 3dc31fe (2026-09-24), PATCH /api/admissoes/[id] gravava "sourceJobId" e
-- "sourceApplicationId" como null a cada edição feita pela antiga /admissoes/[id]/editar.
-- Admissões criadas pelo pipeline (AdmissionLinkModal → POST /api/admissoes) e editadas
-- depois perderam o vínculo com a vaga/candidatura.
--
-- PARTE 1 — regra geral, fonte job_positions."admissionId" (gravado por job_position_fill()).
-- Restaura só quando:
--   • a admissão está ativa e tem sourceJobId e/ou sourceApplicationId nulos;
--   • ela ocupa exatamente UMA posição;
--   • o valor que sobreviveu (se algum) bate com a posição — nada é sobrescrito;
--   • a candidatura da posição pertence à vaga da posição;
--   • a candidatura não está vinculada a outra admissão ativa.
-- Candidatura excluída (applicationId nulo na posição) → restaura só a vaga.
--
-- PARTE 2 — 3 casos revisados e aprovados pelo RH em 2026-09-24 (lista fechada). O backfill
-- de job_positions (20260923200000) ligou a candidatura à posição, mas não achou a admissão
-- porque o bug já tinha apagado sourceApplicationId. Evidência dupla, reconferida aqui:
--   • e-mail da admissão = e-mail da candidatura, e é a ÚNICA candidatura compatível;
--   • a candidatura está em etapa de contratação (WON/ADMISSION) e ocupa a posição FILLED
--     da vaga, sem admissão vinculada.
-- Além da origem, liga a admissão à posição (job_positions."admissionId"; data prevista de
-- início só se estiver vazia) — o que job_position_fill() teria feito.
-- Se algum dos 3 não bater mais com a evidência, a migração inteira FALHA (rollback): rode
-- scripts/diag-admission-origin.sql de novo antes de decidir.
--
-- Demais casos (ex.: Luciano Leão de Souza, candidatura ainda em entrevista) ficam para
-- revisão manual — ver scripts/diag-admission-origin.sql.
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

-- Tudo num ÚNICO bloco DO = um único comando: é atômico em qualquer cliente (script, psql ou
-- SQL Editor do Supabase, que pode executar comando a comando ou só o trecho selecionado).
-- Se algo falhar, nada fica pela metade — inclusive os gatilhos de "updatedAt", desligados
-- só dentro do bloco.
do $fn$
declare
  c        record;
  v_adm    public."admissions"%rowtype;
  v_app    record;
  v_pos    public."job_positions"%rowtype;
  v_n      int;
begin
  alter table public."admissions"     disable trigger set_updatedAt;
  alter table public."job_positions" disable trigger set_updatedAt;

-- ─── Parte 1: pela posição que a admissão ocupa ──────────────────────────────────────
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

-- ─── Parte 2: casos aprovados (candidatura na posição + mesmo e-mail) ─────────────────
  for c in
    select * from (values
      ('17d88130-43c0-4193-9fc5-ef3c023719cc', '7b17ae61-aa30-4b2b-a9d9-09d2b3516a35'),  -- Maiara Aparecida Candido · VAG-2026-0014
      ('f7a0ea4d-ed04-4da6-9df5-b6be8009b30f', 'fb3e2b64-94f9-4478-aa2a-43ef87fb0bc7'),  -- Nicole Schmidt de Morais · VAG-2026-0015
      ('9afdd394-d61d-4daa-9eef-31c2d410969d', '2f2ba831-cc74-408c-bb71-3aff0b8ac2fb')   -- Felipe Silva de Almeida · VAG-2026-0011
    ) as t(admission_id, application_id)
  loop
    select * into v_adm from public."admissions" where "id" = c.admission_id for update;
    if not found or v_adm."deletedAt" is not null then
      raise exception 'Admissão % não existe ou foi excluída.', c.admission_id;
    end if;

    select ap."id", ap."jobId", ap."email", s."kind" into v_app
      from public."applications" ap
      left join public."application_stages" s on s."id" = ap."stageId"
     where ap."id" = c.application_id;
    if not found then
      raise exception 'Candidatura % não existe.', c.application_id;
    end if;

    -- Já restaurada (nova execução): confere e segue.
    if v_adm."sourceApplicationId" = v_app."id" and v_adm."sourceJobId" = v_app."jobId" then
      continue;
    end if;

    if v_adm."sourceJobId" is not null or v_adm."sourceApplicationId" is not null then
      raise exception 'Admissão % já tem outra origem (vaga %, candidatura %).',
        c.admission_id, v_adm."sourceJobId", v_adm."sourceApplicationId";
    end if;
    if nullif(lower(trim(v_adm."email")), '') is distinct from lower(trim(v_app."email")) then
      raise exception 'Admissão %: o e-mail não bate mais com o da candidatura.', c.admission_id;
    end if;
    select count(*) into v_n
      from public."applications" ap
     where lower(trim(ap."email")) = lower(trim(v_adm."email"))
       and ap."createdAt" <= v_adm."createdAt"
       and not exists (select 1 from public."admissions" o
                        where o."id" <> v_adm."id" and o."deletedAt" is null and o."sourceApplicationId" = ap."id");
    if v_n <> 1 then
      raise exception 'Admissão %: esperava 1 candidatura com o mesmo e-mail (encontradas: %).', c.admission_id, v_n;
    end if;
    if v_app."kind" is distinct from 'WON' and v_app."kind" is distinct from 'ADMISSION' then
      raise exception 'Candidatura % não está em etapa de contratação (kind %).', c.application_id, v_app."kind";
    end if;
    if exists (select 1 from public."admissions" o
                where o."id" <> v_adm."id" and o."deletedAt" is null and o."sourceApplicationId" = v_app."id") then
      raise exception 'Candidatura % já está vinculada a outra admissão ativa.', c.application_id;
    end if;
    if exists (select 1 from public."job_positions" x where x."admissionId" = v_adm."id") then
      raise exception 'Admissão % já ocupa uma posição.', c.admission_id;
    end if;

    select count(*) into v_n
      from public."job_positions"
     where "applicationId" = v_app."id" and "jobId" = v_app."jobId" and "status" = 'FILLED' and "admissionId" is null;
    if v_n <> 1 then
      raise exception 'Candidatura % deveria ocupar 1 posição sem admissão na vaga (encontradas: %).', c.application_id, v_n;
    end if;
    select * into v_pos
      from public."job_positions"
     where "applicationId" = v_app."id" and "jobId" = v_app."jobId" and "status" = 'FILLED' and "admissionId" is null
     for update;

    update public."admissions"
       set "sourceJobId" = v_app."jobId", "sourceApplicationId" = v_app."id"
     where "id" = v_adm."id";

    update public."job_positions"
       set "admissionId" = v_adm."id",
           "expectedStartDate" = coalesce("expectedStartDate", v_adm."startDate")
     where "id" = v_pos."id";

    insert into public."admission_activity_log"
      ("userId", "admissionId", "entity", "entityId", "action", "description", "metadata")
    values (null, v_adm."id", 'ADMISSION', v_adm."id", 'ORIGIN_RESTORED',
            'Vínculo com a vaga/candidatura restaurado (correção do PATCH que apagava a origem)',
            jsonb_build_object(
              'subjectName', v_adm."fullName",
              'via',         'application_email+job_positions.applicationId (aprovado pelo RH)',
              'positionId',  v_pos."id",
              'positionExpectedStartDateBefore', v_pos."expectedStartDate",
              'from', jsonb_build_object('sourceJobId', null, 'sourceApplicationId', null),
              'to',   jsonb_build_object('sourceJobId', v_app."jobId", 'sourceApplicationId', v_app."id"),
              'migration',   '20260924120000'
            ));
  end loop;

  alter table public."job_positions" enable trigger set_updatedAt;
  alter table public."admissions"     enable trigger set_updatedAt;
end $fn$;
