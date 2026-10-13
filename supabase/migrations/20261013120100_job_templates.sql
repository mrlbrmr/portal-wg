-- ========================================================================================
-- MODELOS DE VAGA  (Configurações › Recrutamento › Modelos de vaga)
--
-- A WG abre sempre os mesmos cargos. O modelo guarda o que se repete (cargo, área, dados
-- padrão e o conteúdo da vaga por seção) para o RH não redigitar a cada abertura.
--
--   • O modelo é COPIADO para a vaga no momento em que é aplicado. Não há vínculo vivo:
--     editar ou arquivar um modelo nunca altera vagas já criadas.
--   • jobs."templateId" é só a PROCEDÊNCIA (de qual modelo a vaga partiu), informativa;
--     `on delete set null` — e a aplicação nem exclui modelos, só arquiva.
--   • O que é da ABERTURA (posições, motivo, salário, prazos, status, publicação, unidade,
--     solicitação) não existe no modelo.
--   • Conteúdo em Markdown por seção; ao aplicar, o painel monta o mesmo texto do editor
--     (### Responsabilidades / ### Requisitos Obrigatórios / ...).
--
-- ADITIVA: tabela nova + coluna nullable. O código antigo ignora as duas.
-- ========================================================================================

create table if not exists public."job_templates" (
  "id"                   text        primary key default gen_random_uuid()::text,
  "name"                 text        not null,
  "title"                text        not null,
  "department"           text,
  "modality"             "Modality",
  "contractType"         "ContractType",
  "workSchedule"         text,
  -- Texto de abertura e seções que não são as quatro padrão (Markdown).
  "about"                text,
  "responsibilities"     text,
  "requiredRequirements" text,
  "desiredRequirements"  text,
  "benefits"             text,
  "active"               boolean     not null default true,
  "createdAt"            timestamptz not null default now(),
  "updatedAt"            timestamptz not null default now(),
  "createdBy"            text,
  "updatedBy"            text
);

create unique index if not exists "job_templates_name_key" on public."job_templates" (lower("name"));

drop trigger if exists set_updatedAt on public."job_templates";
create trigger set_updatedAt before update on public."job_templates"
  for each row execute procedure extensions.moddatetime("updatedAt");

alter table public."job_templates" enable row level security;

create policy job_templates_staff_select on public."job_templates"
  for select to authenticated using ((select public.is_staff()));
create policy job_templates_admin_insert on public."job_templates"
  for insert to authenticated with check ((select public.is_admin()));
create policy job_templates_admin_update on public."job_templates"
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy job_templates_admin_delete on public."job_templates"
  for delete to authenticated using ((select public.is_admin()));

-- Procedência da vaga (informativa, sem vínculo vivo).
alter table public."jobs"
  add column if not exists "templateId" text references public."job_templates"("id") on delete set null;

comment on column public."jobs"."templateId" is
  'Modelo de vaga aplicado na criação (procedência). O conteúdo foi COPIADO: editar/arquivar o modelo não altera a vaga.';
