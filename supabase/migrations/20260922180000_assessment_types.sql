-- Avaliações: tipo de avaliação e modo de correção explícitos.
--
-- Até aqui a UI decidia o comportamento olhando `kind` e, em vários lugares, tratava o
-- Big Five como exceção ("PENDING_REVIEW, mas não é revisão"). Agora cada template tem:
--
--   assessmentType  TECHNICAL_OBJECTIVE | TECHNICAL_MIXED | BEHAVIORAL
--   gradingMode     AUTO | HYBRID | MANUAL | NONE
--
-- Os dois são DERIVADOS de `kind` + `questions` por trigger — nunca informados pela
-- aplicação — para não divergirem quando alguém edita as questões (ex.: acrescenta uma
-- dissertativa a um teste objetivo). A regra espelha `classifyTemplate()` em
-- src/lib/avaliacoes/schema.ts.
--
-- Invariante nova: avaliação comportamental NÃO tem outcome (sem aprovação, reprovação ou
-- correção). Um trigger em assessment_sessions garante isso mesmo para código antigo em
-- execução durante o deploy.
--
-- Migração aditiva: colunas novas preenchidas por trigger (inserts do código antigo
-- continuam válidos). O backfill só limpa o "PENDING_REVIEW" que o Big Five gravava.

-- ─── 1. Templates: tipo + modo de correção ──────────────────────────────────────────
alter table "assessment_templates"
  add column if not exists "assessmentType" text
    check ("assessmentType" in ('TECHNICAL_OBJECTIVE', 'TECHNICAL_MIXED', 'BEHAVIORAL')),
  add column if not exists "gradingMode" text
    check ("gradingMode" in ('AUTO', 'HYBRID', 'MANUAL', 'NONE'));

create or replace function assessment_template_classify()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n_manual int := 0;
  n_auto   int := 0;
begin
  if new."kind" = 'PERSONALITY_BIG5' then
    new."assessmentType" := 'BEHAVIORAL';
    new."gradingMode"    := 'NONE';
    new."passingScore"   := null; -- perfil não tem nota de corte
    return new;
  end if;

  if jsonb_typeof(new."questions") = 'array' then
    select
      count(*) filter (where q->>'type' in ('SHORT_TEXT', 'SCALE_LIKERT')),
      count(*) filter (where q->>'type' in ('MULTIPLE_CHOICE', 'TRUE_FALSE'))
    into n_manual, n_auto
    from jsonb_array_elements(new."questions") q;
  end if;

  if n_manual > 0 then
    new."assessmentType" := 'TECHNICAL_MIXED';
    new."gradingMode"    := case when n_auto > 0 then 'HYBRID' else 'MANUAL' end;
  else
    new."assessmentType" := 'TECHNICAL_OBJECTIVE';
    new."gradingMode"    := 'AUTO';
  end if;
  return new;
end;
$$;

drop trigger if exists "assessment_templates_classify" on "assessment_templates";
create trigger "assessment_templates_classify"
  before insert or update on "assessment_templates"
  for each row execute function assessment_template_classify();

-- Backfill: o trigger calcula os campos para os templates existentes.
update "assessment_templates" set "kind" = "kind";

alter table "assessment_templates"
  alter column "assessmentType" set not null,
  alter column "gradingMode"    set not null;

-- ─── 2. Sessões: correção manual ────────────────────────────────────────────────────
alter table "assessment_sessions"
  add column if not exists "gradedAt" timestamptz,
  add column if not exists "gradedBy" text;

-- ─── 3. Invariante: comportamental não tem outcome ──────────────────────────────────
create or replace function assessment_session_behavioral_no_outcome()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new."outcome" is not null and exists (
    select 1 from "assessment_templates" t
    where t."id" = new."templateId" and t."assessmentType" = 'BEHAVIORAL'
  ) then
    new."outcome" := null;
  end if;
  return new;
end;
$$;

drop trigger if exists "assessment_sessions_behavioral_no_outcome" on "assessment_sessions";
create trigger "assessment_sessions_behavioral_no_outcome"
  before insert or update of "outcome" on "assessment_sessions"
  for each row execute function assessment_session_behavioral_no_outcome();

-- Backfill: Big Five concluído não está "aguardando revisão" — o resultado está disponível.
update "assessment_sessions" s
set "outcome" = null
from "assessment_templates" t
where t."id" = s."templateId"
  and t."assessmentType" = 'BEHAVIORAL'
  and s."outcome" is not null;

create index if not exists "assessment_sessions_template_idx" on "assessment_sessions" ("templateId");
