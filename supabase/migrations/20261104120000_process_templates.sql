-- ========================================================================================
-- MODELOS DE PROCESSO  (Configurações › Recrutamento › Modelos de processo)
--
-- O catálogo de etapas (application_stages) continua único. Um MODELO é uma lista ORDENADA
-- de etapas do catálogo (ex.: "Operacional", "Administrativo", "Liderança"). Ao criar a vaga
-- (ou depois, em "Configurar etapas") o RH escolhe o modelo e pode ajustar só aquela vaga.
--
--   • Aplicar = COPIAR para job_stage_config (agora com ordem própria). Editar o modelo depois
--     NÃO altera vagas já configuradas; jobs."processTemplateId" é só a PROCEDÊNCIA.
--   • Vaga sem linhas em job_stage_config segue o modelo PADRÃO (isDefault) — o seed abaixo
--     reproduz exatamente o comportamento anterior (todas as etapas ativas, na ordem do funil).
--   • Etapa com candidatos só sai da vaga se os candidatos forem movidos (regra no app).
--
-- ADITIVA: tabelas novas + colunas com default. O código antigo ignora tudo isso e segue
-- lendo job_stage_config como antes.
-- ========================================================================================

-- 1. Modelos ────────────────────────────────────────────────────────────────────────────
create table if not exists public."process_templates" (
  "id"          text        primary key default gen_random_uuid()::text,
  "name"        text        not null check (char_length("name") between 1 and 120),
  "description" text        check ("description" is null or char_length("description") <= 400),
  "isDefault"   boolean     not null default false,
  "active"      boolean     not null default true,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now(),
  "createdBy"   text,
  "updatedBy"   text
);

create unique index if not exists "process_templates_name_key"
  on public."process_templates" (lower("name"));
-- No máximo um modelo padrão.
create unique index if not exists "process_templates_one_default"
  on public."process_templates" ("isDefault") where "isDefault";

drop trigger if exists set_updatedAt on public."process_templates";
create trigger set_updatedAt before update on public."process_templates"
  for each row execute procedure extensions.moddatetime("updatedAt");

-- 2. Etapas do modelo (ordenadas) ───────────────────────────────────────────────────────
create table if not exists public."process_template_stages" (
  "templateId" text    not null references public."process_templates"("id") on delete cascade,
  "stageId"    text    not null references public."application_stages"("id") on delete cascade,
  "sortOrder"  integer not null default 0,
  primary key ("templateId", "stageId")
);
create index if not exists "process_template_stages_stage_idx"
  on public."process_template_stages" ("stageId");

-- 3. Ordem própria da vaga + procedência ────────────────────────────────────────────────
alter table public."job_stage_config"
  add column if not exists "sortOrder" integer not null default 0;

alter table public."jobs"
  add column if not exists "processTemplateId" text
  references public."process_templates"("id") on delete set null;

comment on column public."jobs"."processTemplateId" is
  'Modelo de processo aplicado (procedência). As etapas foram COPIADAS para job_stage_config: editar o modelo não altera a vaga.';

-- 4. RLS (staff lê, admin escreve) ──────────────────────────────────────────────────────
alter table public."process_templates" enable row level security;
alter table public."process_template_stages" enable row level security;

create policy process_templates_staff_select on public."process_templates"
  for select to authenticated using ((select public.is_staff()));
create policy process_templates_admin_all on public."process_templates"
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy process_template_stages_staff_select on public."process_template_stages"
  for select to authenticated using ((select public.is_staff()));
create policy process_template_stages_admin_all on public."process_template_stages"
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 5. Gravação ATÔMICA ───────────────────────────────────────────────────────────────────
-- Troca a lista de etapas do modelo de uma vez (SECURITY INVOKER: a RLS acima vale).
create or replace function public.process_template_set_stages(p_template text, p_stage_ids text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from "process_template_stages" where "templateId" = p_template;
  insert into "process_template_stages" ("templateId", "stageId", "sortOrder")
  select p_template, s.id, (s.ord * 10)::integer
  from unnest(p_stage_ids) with ordinality as s(id, ord);
end;
$$;

-- Troca as etapas da vaga de uma vez. Lista vazia = volta ao modelo padrão.
create or replace function public.job_process_set(p_job text, p_stage_ids text[], p_template text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from "job_stage_config" where "jobId" = p_job;
  if coalesce(array_length(p_stage_ids, 1), 0) > 0 then
    insert into "job_stage_config" ("jobId", "stageId", "sortOrder")
    select p_job, s.id, (s.ord * 10)::integer
    from unnest(p_stage_ids) with ordinality as s(id, ord);
  end if;
  update "jobs" set "processTemplateId" = case when coalesce(array_length(p_stage_ids, 1), 0) > 0 then p_template else null end
  where "id" = p_job;
end;
$$;

grant execute on function public.process_template_set_stages(text, text[]) to authenticated;
grant execute on function public.job_process_set(text, text[], text) to authenticated;

-- 6. Seed: modelo PADRÃO = todas as etapas ativas, na ordem atual do funil ──────────────
-- Vagas sem ajuste continuam vendo exatamente o que viam. Idempotente.
do $$
declare
  v_id text;
begin
  select "id" into v_id from public."process_templates" where "isDefault" limit 1;
  if v_id is null then
    insert into public."process_templates" ("name", "description", "isDefault")
    values ('Padrão', 'Todas as etapas do funil. Vagas sem ajuste seguem este modelo.', true)
    on conflict (lower("name")) do nothing
    returning "id" into v_id;
    if v_id is null then
      select "id" into v_id from public."process_templates" where lower("name") = 'padrão';
      update public."process_templates" set "isDefault" = true where "id" = v_id
        and not exists (select 1 from public."process_templates" where "isDefault");
    end if;
  end if;

  if v_id is not null and not exists (select 1 from public."process_template_stages" where "templateId" = v_id) then
    insert into public."process_template_stages" ("templateId", "stageId", "sortOrder")
    select v_id, s."id", s."sortOrder"
    from public."application_stages" s
    where s."active";
  end if;
end $$;

-- 7. Vagas com ajuste antigo (sem ordem própria) ficam na ordem do funil ────────────────
update public."job_stage_config" c
set "sortOrder" = s."sortOrder"
from public."application_stages" s
where s."id" = c."stageId" and c."sortOrder" = 0;
