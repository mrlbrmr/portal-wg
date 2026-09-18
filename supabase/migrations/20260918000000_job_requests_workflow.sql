-- ========================================================================================
-- Fluxo de aprovação da Requisição de Pessoal (RP)
--
-- Antes: o formulário do gestor criava direto uma vaga DRAFT — pedido e vaga eram a
-- mesma coisa, sem ninguém aprovar, e `jobs.responsible` (recrutador) recebia o nome
-- do gestor.
--
-- Agora: `job_requests` vira um objeto de gestão com ciclo próprio
--   SUBMITTED → IN_REVIEW → APPROVED (aí sim nasce a vaga) | RETURNED | REJECTED | CANCELLED
-- e a vaga ganha `hiringManager` (gestor solicitante) + `requestId` (rastro da RP).
--
-- Migração ADITIVA — o código antigo continua funcionando durante o build.
-- ========================================================================================

-- ─── Enum de status da requisição ──────────────────────────────────────────────────────
do $$
begin
  create type "JobRequestStatus" as enum (
    'SUBMITTED',  -- Solicitada — na fila do RH
    'IN_REVIEW',  -- Em análise pelo RH
    'RETURNED',   -- Devolvida ao gestor para ajustes
    'APPROVED',   -- Aprovada — libera a abertura da vaga
    'REJECTED',   -- Reprovada com justificativa
    'CANCELLED'   -- Cancelada (desistência)
  );
exception
  when duplicate_object then null;
end $$;

-- ─── Colunas de workflow em job_requests ───────────────────────────────────────────────
-- form_data (jsonb) segue sendo a fonte do que o gestor digitou; as colunas abaixo são
-- derivadas para permitir listar, filtrar e ordenar a fila sem abrir o JSON.
alter table public.job_requests
  add column if not exists status             "JobRequestStatus" not null default 'SUBMITTED',
  add column if not exists title              text,
  add column if not exists requester_name     text,
  add column if not exists requester_email    text,
  add column if not exists reason             text,
  add column if not exists location           text,
  add column if not exists openings           integer,
  add column if not exists priority           "JobPriority" not null default 'MEDIUM',
  add column if not exists desired_start_date date,
  add column if not exists decision_note      text,
  add column if not exists decided_by         text,
  add column if not exists decided_at         timestamptz,
  add column if not exists updated_at         timestamptz not null default now();

create index if not exists job_requests_status_idx
  on public.job_requests (status, created_at desc);

drop trigger if exists set_job_requests_updated_at on public.job_requests;
create trigger set_job_requests_updated_at
  before update on public.job_requests
  for each row execute procedure extensions.moddatetime(updated_at);

-- Backfill das solicitações já recebidas: preenche as colunas a partir do form_data e
-- marca como APPROVED as que já geraram vaga (senão reapareceriam como pendentes).
update public.job_requests
set
  title           = coalesce(title,           nullif(form_data->>'funcao', '')),
  requester_name  = coalesce(requester_name,  nullif(form_data->>'gestor', '')),
  requester_email = coalesce(requester_email, nullif(form_data->>'emailGestor', '')),
  reason          = coalesce(reason,          nullif(form_data->>'motivo', '')),
  location        = coalesce(location,        nullif(form_data->>'local', '')),
  status          = case when job_id is not null then 'APPROVED'::"JobRequestStatus" else status end,
  decided_at      = case when job_id is not null then coalesce(decided_at, created_at) else decided_at end,
  decided_by      = case when job_id is not null then coalesce(decided_by, 'Migração (fluxo antigo)') else decided_by end;

-- ─── Vaga: gestor solicitante + rastro da requisição ───────────────────────────────────
alter table public."jobs"
  add column if not exists "hiringManager" text,
  add column if not exists "requestId"     uuid references public.job_requests (id) on delete set null;

create index if not exists "jobs_requestId_idx" on public."jobs" ("requestId");

-- Religa as vagas criadas pelo fluxo antigo à sua requisição.
update public."jobs" j
set "requestId" = r.id
from public.job_requests r
where r.job_id = j.id and j."requestId" is null;

-- Corrige o campo sequestrado: onde `responsible` guardava o nome do GESTOR (fluxo
-- antigo), move para `hiringManager` e libera `responsible` para o recrutador.
update public."jobs" j
set
  "hiringManager" = coalesce(j."hiringManager", r.requester_name),
  "responsible"   = case when j."responsible" = r.requester_name then null else j."responsible" end
from public.job_requests r
where r.job_id = j.id;

-- ─── Formulário do gestor: campos que faltavam para uma RP completa ────────────────────
-- Acrescenta ao singleton apenas as keys ausentes (preserva customizações feitas no
-- editor). `emailGestor` entra logo depois de `gestor`; o resto vai para o fim.
do $$
declare
  atual    jsonb;
  saida    jsonb := '[]'::jsonb;
  elem     jsonb;
  novo     jsonb;
  email_fd jsonb := jsonb_build_object(
    'id', 'emailGestor', 'key', 'emailGestor', 'label', 'E-mail do gestor(a)',
    'type', 'email', 'required', true, 'placeholder', 'nome@wgbaterias.com.br'
  );
  novos    jsonb := jsonb_build_array(
    jsonb_build_object(
      'id', 'quantidade', 'key', 'quantidade', 'label', 'Quantidade de posições',
      'type', 'number', 'required', true, 'placeholder', 'Ex: 1'
    ),
    jsonb_build_object(
      'id', 'tipoContratacao', 'key', 'tipoContratacao', 'label', 'Tipo de contratação',
      'type', 'select', 'required', true,
      'options', jsonb_build_array('CLT', 'Estágio', 'Jovem aprendiz', 'Temporário', 'PJ')
    ),
    jsonb_build_object(
      'id', 'dataInicio', 'key', 'dataInicio', 'label', 'Data desejada de início',
      'type', 'date', 'required', false
    ),
    jsonb_build_object(
      'id', 'salarioPretendido', 'key', 'salarioPretendido', 'label', 'Faixa salarial pretendida',
      'type', 'text', 'required', false, 'placeholder', 'Ex: R$ 2.500 a R$ 3.000 (ou "a combinar")'
    ),
    jsonb_build_object(
      'id', 'dataDesligamento', 'key', 'dataDesligamento', 'label', 'Data de desligamento do colaborador',
      'type', 'date', 'required', false,
      'showWhen', jsonb_build_object('fieldKey', 'motivo', 'operator', 'is', 'value', 'Substituição')
    )
  );
begin
  select fields into atual from public.job_request_form_config where id = 'singleton';
  if atual is null then
    return; -- sem config salva: o DEFAULT_FORM_CONFIG do app já traz os campos novos
  end if;

  for elem in select value from jsonb_array_elements(atual)
  loop
    saida := saida || jsonb_build_array(elem);
    if elem->>'key' = 'gestor'
       and not exists (select 1 from jsonb_array_elements(atual) e where e->>'key' = 'emailGestor')
    then
      saida := saida || jsonb_build_array(email_fd);
    end if;
  end loop;

  -- 'gestor' pode não existir na config customizada — garante o e-mail mesmo assim
  if not exists (select 1 from jsonb_array_elements(saida) e where e->>'key' = 'emailGestor') then
    saida := saida || jsonb_build_array(email_fd);
  end if;

  for novo in select value from jsonb_array_elements(novos)
  loop
    if not exists (select 1 from jsonb_array_elements(saida) e where e->>'key' = novo->>'key') then
      saida := saida || jsonb_build_array(novo);
    end if;
  end loop;

  update public.job_request_form_config set fields = saida where id = 'singleton';
end $$;
