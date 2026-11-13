# Filial, área e cargo vindos dos cadastros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solicitação e vaga escolhem Filial e Área dos cadastros (a filial leva cidade/UF), e o cargo da admissão
define uniforme e documentos de motorista/operador no formulário digital.

**Architecture:** Migração aditiva cria `admission_areas`, dá cidade/UF às filiais e três marcações aos cargos, e liga
`job_requests`/`jobs` aos cadastros por id (as colunas de texto continuam preenchidas com o nome). Regras puras novas
em `src/lib/registries/org-units.ts` (filial/área) e em `form-config.ts` (perfil do cargo); servidor e telas usam as
mesmas funções.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase (Postgres + supabase-js), zod, `node:test` via tsx.

**Spec:** `docs/superpowers/specs/2026-11-13-cadastros-filial-area-cargo-design.md`

## Global Constraints

- Migração **aditiva**, aplicada à mão **antes** do push: `SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs <arquivo> <versão>`.
- Ids dos cadastros são `text`; FKs novas são `text` e **nullable**.
- `jobs.company`, `jobs.department`, `jobs.city`, `jobs.state`, `job_requests.location`, `job_requests.department`
  continuam sendo gravados (com o **nome** do cadastro) — portal, feeds, Intranet e WG Jornada leem essas colunas.
- Item de cadastro em uso nunca é excluído (`registry-usage.ts`); toda ação de cadastro chama `logConfigChange()`.
- Admissão **sem cargo** mantém o comportamento atual (pergunta ao candidato).
- Textos em sentence case, sem emoji como ícone; type-check `node_modules/.bin/tsc --noEmit -p tsconfig.json` e `npm test` verdes ao fim de cada tarefa.
- Commits `tipo(escopo): descrição` em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Solicitação/vaga antiga sem `branch_id`** aberta para edição: o select mostra o valor antigo como aviso e salvar sem escolher filial não apaga o texto antigo (Task 4/5 testam `resolveOrgUnits` com `branchId` ausente + texto legado).
2. **Filial ou área desativada** que já está na solicitação/vaga: continua aparecendo no select daquele registro (Task 2 testa `selectableOptions`).
3. **Cargo com todas as marcações desmarcadas:** formulário não mostra calça/bota nem MOPP/empilhadeira e o envio não exige esses documentos (Task 7 testa `resolvePositionAnswers` + `missingRequiredItems`).
4. **Configuração de formulário salva com a condição antiga `isDriverOperator`** continua funcionando com e sem cargo (Task 7 testa `matchesCondition`).
5. **POST público de solicitação com `branchId` inexistente ou inativo** é recusado com erro no campo, não grava texto vazio (Task 4 testa `resolveOrgUnits`).

---

### Task 1: Migração do banco

**Files:**
- Create: `supabase/migrations/20261113120000_cadastros_filial_area_cargo.sql`

**Interfaces:**
- Produces: tabela `admission_areas(id text pk, name text not null, active bool default true, "sortOrder" int, "createdAt", "updatedAt")`;
  `admission_branches.city text`, `admission_branches.state text`;
  `admission_positions."usesOperationalUniform" bool not null default false`, `"isDriver"`, `"isForkliftOperator"` (idem);
  `job_requests.branch_id text`, `job_requests.area_id text`; `jobs."branchId" text`, `jobs."areaId" text` (FKs `on delete set null`).

- [ ] **Step 1: Escrever a migração**
  - Tabela `admission_areas` no formato de `admission_branches`; RLS habilitada; policies `is_staff()` select e `is_admin()` insert/update/delete (copiar as de `admission_branches`, ver `supabase/migrations/20260720000001_rls.sql`); trigger de `updatedAt` igual ao de `admission_branches`.
  - Sementes de áreas (sortOrder 1..7): Logística, Comercial, Financeiro, Administrativo, Serviços Gerais, Varejo, Trade.
  - Sementes de cidade/UF por nome: Matriz (SJP) → São José dos Pinhais/PR; Rio de Janeiro → Nova Iguaçu/RJ; Maringá → Maringá/PR; Londrina → Londrina/PR; Sumaré → Sumaré/SP; São Paulo → São Paulo/SP.
  - Sementes das marcações pelo nome (tabela do spec, "Dados existentes"): uniforme = Motorista de Caminhão Junior/Pleno/Senior, Técnico Entregador, Operador Multifuncional, Encarregado de Logística, Auxiliar de Logística, Auxiliar de Serviços Gerais; `isDriver` = Motorista de Caminhão Junior/Pleno/Senior; `isForkliftOperator` = Operador Multifuncional, Encarregado de Logística.
  - `create or replace function public.create_job_from_request(...)`: copiar a definição **vigente** (`select pg_get_functiondef('public.create_job_from_request'::regproc)` em produção) e mudar só o INSERT em `jobs`: incluir `"branchId" = r.branch_id`, `"areaId" = r.area_id`, `city`/`state` = cidade/UF da filial (`left join`/subselect em `admission_branches`) no lugar de `null, null`.
  - Cabeçalho de comentário no padrão das migrações do projeto (o quê, por quê, comando para aplicar).

- [ ] **Step 2: Aplicar em produção e conferir**

Run: `node scripts/_supabase-apply.mjs supabase/migrations/20261113120000_cadastros_filial_area_cargo.sql 20261113120000`
Expected: `✅ migration aplicada` e `✅ registrada`. Conferir por consulta: 7 áreas; 6 filiais com cidade/UF; 3 cargos com `isDriver`; 2 com `isForkliftOperator`; 8 com uniforme; `pg_get_functiondef` contém `"branchId"`.

- [ ] **Step 3: Commit** (`feat(cadastros): áreas, cidade da filial e marcações do cargo no banco`)

### Task 2: Regras puras de filial e área

**Files:**
- Create: `src/lib/registries/org-units.ts`, `src/lib/registries/org-units.test.ts`

**Interfaces:**
- Produces:
  - `interface OrgUnit { id: string; name: string; active: boolean; city?: string | null; state?: string | null }`
  - `selectableOptions(options: OrgUnit[], currentId: string | null): OrgUnit[]` — ativos + o atual mesmo inativo, na ordem recebida.
  - `resolveOrgUnits(input: { branchId?: string | null; areaId?: string | null; legacyLocation?: string | null; legacyDepartment?: string | null }, branches: OrgUnit[], areas: OrgUnit[], opts: { requireIds: boolean }): { ok: true; branchId: string | null; areaId: string | null; location: string | null; department: string | null; city: string | null; state: string | null } | { ok: false; field: "branchId" | "areaId"; message: string }`

- [ ] **Step 1: Testes que falham** (`org-units.test.ts`)
  - `selectableOptions`: inativa só aparece se for a atual; ordem preservada.
  - `resolveOrgUnits` com ids válidos → `location`/`department` = nomes; `city`/`state` = da filial.
  - `requireIds: true` sem `branchId` → `{ ok:false, field:"branchId", message:"Escolha a filial." }`; sem `areaId` → `"Escolha a área."`.
  - id inexistente → erro no campo (`"Filial não encontrada."` / `"Área não encontrada."`); id de item **inativo** com `requireIds: true` (envio novo) → `"Esta filial está desativada."`.
  - `requireIds: false` sem ids → mantém `legacyLocation`/`legacyDepartment` e `city`/`state` null (registro antigo).
- [ ] **Step 2:** `npx tsx --test src/lib/registries/org-units.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar as duas funções.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** (`feat(cadastros): regras puras de filial e área`)

### Task 3: Cadastros — Áreas, cidade/UF da filial, marcações do cargo

**Files:**
- Modify: `src/lib/admissao/registry-usage.ts` (`CatEntity` + `"area"`, `CATEGORY_TABLE.area = "admission_areas"`, `SUPPORTS_ACTIVE.area = true`, `SOURCES`: branch += `jobs."branchId"` ("vaga"), `job_requests.branch_id` ("solicitação"); area = `jobs."areaId"`, `job_requests.area_id`)
- Modify: `src/lib/admissao/registry-data.ts` (`COLUMNS`: branch `id, name, active, city, state`; position `id, name, active, usesOperationalUniform, isDriver, isForkliftOperator`; area `id, name, active`; `RegistryItem` += `city`, `state`, `usesOperationalUniform`, `isDriver`, `isForkliftOperator`, todos `| null`)
- Modify: `src/lib/admissao/config-actions.ts` (`createCategory`/`updateCategory` input += `city?`, `state?`, `usesOperationalUniform?`, `isDriver?`, `isForkliftOperator?`; gravados só para a entidade certa; UF validada contra `BRAZIL_STATES`)
- Modify: `src/lib/settings/registry.ts` (`RegistryEntity` + `"area"`; item `cadastros.areas`, `/configuracoes/cadastros/areas`, título "Áreas", descrição "Áreas usadas na solicitação de vaga e nas vagas.", ícone lucide `Layers`, singular "área", plural "áreas", artigo "a")
- Modify: `src/components/internal/cadastros/RegistryItemDialog.tsx` (filial: Cidade + UF; cargo: três checkboxes "Usa uniforme operacional (calça e bota)", "Motorista (pede MOPP)", "Operador de empilhadeira", com as dicas do spec)
- Modify: `src/components/internal/cadastros/RegistryTable.tsx` (filial mostra "Cidade/UF"; cargo mostra as marcações ativas em texto curto: "Calça e bota · MOPP · Empilhadeira")
- Create: `src/lib/registries/org-units-data.ts` — `loadOrgUnits(client): Promise<{ branches: OrgUnit[]; areas: OrgUnit[] }>` (ordenado por `sortOrder`; aceita client do servidor ou admin)

**Interfaces:**
- Consumes: `OrgUnit` (Task 2).
- Produces: `loadOrgUnits(client: SupabaseClient)`.

- [ ] **Step 1:** Implementar os arquivos acima.
- [ ] **Step 2:** `node_modules/.bin/tsc --noEmit -p tsconfig.json` e `npm test` → limpos.
- [ ] **Step 3: Commit** (`feat(cadastros): áreas, cidade/UF da filial e marcações do cargo na tela`)

### Task 4: Solicitação de vaga com filial e área do cadastro

**Files:**
- Modify: `src/components/job-requests/JobRequestFormFields.tsx` — `JobRequestFormValues` += `branchId: string`, `areaId: string`; `EMPTY_JOB_REQUEST_FORM` com `""`; `toPayload` envia `branchId || null`, `areaId || null` (mantém `location`/`department` como texto legado); props `unitOptions`/`departmentOptions` → `branchOptions: OrgUnit[]`, `areaOptions: OrgUnit[]`; campos viram `<select>` "Filial" e "Área" (opções de `selectableOptions`); se o registro tem texto legado e nenhum id, mostrar abaixo do select: "Valor antigo: {texto}. Escolha a filial para atualizar."
- Modify: `src/lib/job-requests/schema.ts` — payload e rascunho += `branchId`, `areaId` (`z.string().trim().min(1).nullish()`); `location`/`department` passam a `optionalText(120)` no payload (o servidor preenche); mensagem de `title`: "Informe o cargo solicitado"; `payloadToColumns` += `branch_id`, `area_id`.
- Modify: `src/lib/job-requests/service.ts` — `createJobRequest` e `updateJobRequest` chamam `resolveOrgUnits` (create: `requireIds: true`; update: `requireIds: false` com legado do registro) e gravam ids + nomes; erro vira `fieldErrors` para a tela.
- Modify: `src/app/api/job-requests/route.ts` — devolve o erro de `resolveOrgUnits` como `fieldErrors` 422; e-mail ao RH usa "Filial"/"Área".
- Modify: `src/lib/job-requests/workflow.ts` — `CRITICAL_FIELD_LABELS.location = "Filial"`, `.title = "Cargo solicitado"`.
- Modify: `src/app/solicitar-vaga/page.tsx`, `src/app/(internal)/solicitacoes/nova/page.tsx`, `src/app/(internal)/solicitacoes/[id]/page.tsx`, `src/components/public/JobRequestForm.tsx`, `src/components/internal/job-requests/NewJobRequestForm.tsx`, `src/components/internal/job-requests/JobRequestDetail.tsx` (`toFormValues` lê `branchId`/`areaId` da linha; `JobRequestRow` += `branchId`, `areaId`) — trocar sugestões por `loadOrgUnits`.
- Test: `src/lib/registries/org-units.test.ts` (casos de envio público já cobertos na Task 2) + `src/lib/job-requests/workflow.test.ts` continua verde.

**Interfaces:**
- Consumes: `OrgUnit`, `selectableOptions`, `resolveOrgUnits` (Task 2), `loadOrgUnits` (Task 3).

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** type-check + `npm test` → limpos.
- [ ] **Step 3: Commit** (`feat(solicitacoes): filial e área escolhidas dos cadastros`)

### Task 5: Vaga com filial e área do cadastro

**Files:**
- Modify: `src/lib/jobs/draft.ts` — `JobDraft` += `branchId: string`, `areaId: string`; `jobToDraft` lê `job.branchId`/`job.areaId`; `draftToPayload` envia `branchId || null`, `areaId || null`.
- Modify: `src/components/internal/job/JobFields.tsx` — `OpportunityFields` recebe `branchOptions: OrgUnit[]`, `areaOptions: OrgUnit[]`; "Área / departamento" e "Empresa / unidade" (rótulo vira "Filial") viram `<select>`; ao escolher filial, `patch({ branchId, company: nome, city: filial.city ?? draft.city, state: filial.state ?? draft.state })`; cidade/UF seguem editáveis; banco de talentos não mostra filial. Manter o rótulo "Área / departamento" (`templates.test.ts` o usa).
- Modify: `src/components/internal/JobForm.tsx`, `src/components/internal/job/JobWorkspace.tsx` e as páginas que os renderizam (`src/app/(internal)/vagas/nova/page.tsx`, `src/app/(internal)/vagas/[id]/editar/page.tsx`) — carregar `loadOrgUnits` e repassar.
- Modify: `src/app/api/jobs/route.ts` (POST) e `src/app/api/jobs/[id]/route.ts` (PATCH) — schema += `branchId`, `areaId` (`z.string().nullish()`); com id, grava `company`/`department` = nome do cadastro (via `resolveOrgUnits` com `requireIds: false`); id inexistente → 400 com a mensagem.
- Modify: tipo `Job` em `src/types/domain.ts` += `branchId?: string | null; areaId?: string | null`.

**Interfaces:**
- Consumes: Tasks 2–3.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** type-check + `npm test` (inclui `templates.test.ts`, `jobs-rules.test.ts`) → limpos.
- [ ] **Step 3: Commit** (`feat(vagas): filial e área do cadastro; filial preenche cidade e UF`)

### Task 6: Contratar pelo pipeline já com a filial da vaga

**Files:**
- Modify: `src/components/internal/AdmissionLinkModal.tsx` — `AdmissionMeta` += `defaultBranchId?: string | null`; no reset ao abrir, `setBranchId(meta?.defaultBranchId ?? "")`.
- Modify: `src/app/(internal)/vagas/[id]/candidatos/page.tsx` — select da vaga += `branchId`; `admissionMeta.defaultBranchId = job.branchId` (só se a filial estiver ativa na lista de filiais do meta).

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** type-check → limpo.
- [ ] **Step 3: Commit** (`feat(admissoes): contratar já abre com a filial da vaga`)

### Task 7: Formulário de admissão usa o cargo

**Files:**
- Modify: `src/lib/admissao/form-config.ts`
  - `CONDITION_TYPES` += `'positionDriver'`, `'positionForkliftOperator'`; `DocCondition` += `{ type: 'positionDriver' }`, `{ type: 'positionForkliftOperator' }`; `CONDITION_LABELS`: "Se o cargo é motorista", "Se o cargo é operador de empilhadeira".
  - `FormAnswers` += `isDriver?: boolean; isForkliftOperator?: boolean`. `matchesCondition`: `positionDriver` → `a.isDriver ?? !!a.isDriverOperator`; `positionForkliftOperator` → `a.isForkliftOperator ?? !!a.isDriverOperator`.
  - `interface PositionProfile { usesOperationalUniform: boolean; isDriver: boolean; isForkliftOperator: boolean }`.
  - `resolvePositionAnswers(profile: PositionProfile | null, candidate: { isDriverOperator: boolean | null; noOperationalUniform: boolean }): { isDriverOperator: boolean; isDriver?: boolean; isForkliftOperator?: boolean; noOperationalUniform: boolean; asksDriverQuestion: boolean; asksUniformQuestion: boolean }` — com perfil: `asks* = false`, `isDriverOperator = isDriver || isForkliftOperator`, `noOperationalUniform = !usesOperationalUniform`; sem perfil: valores do candidato e `asks* = true`.
  - `DEFAULT_FORM_CONFIG`: "Certificado MOPP + CNH com observação" → `{ type: 'positionDriver' }`; "Certificado Operador de Empilhadeira" → `{ type: 'positionForkliftOperator' }`.
- Test: `src/lib/admissao/form-submit.test.ts` (acrescentar)
  - `resolvePositionAnswers` com perfil Motorista → não pergunta; `isDriver: true`, `isForkliftOperator: false`, `noOperationalUniform: false`.
  - com perfil todo desmarcado → `noOperationalUniform: true`, `isDriverOperator: false`.
  - sem perfil → repete o candidato e `asks* = true`.
  - `missingRequiredItems` com MOPP obrigatório em `positionDriver`: perfil operador não exige MOPP; perfil motorista exige.
  - `matchesCondition({type:'isDriverOperator'}, {isDriverOperator:true})` continua `true` (configuração antiga).
- Modify: `src/app/admissao/[token]/page.tsx` — select += `positionId`; carrega as marcações de `admission_positions` e passa `positionProfile` ao `DigitalForm`.
- Modify: `src/app/admissao/[token]/DigitalForm.tsx` — prop `positionProfile?: PositionProfile | null`; usa `resolvePositionAnswers` para esconder a pergunta "motorista/operador" e o "Não utilizarei calça e bota", mostrar calça/bota só com uniforme, e nas respostas de `getVisibleDocuments`/envio; `validateStep1` não exige respostas ocultas. Modo `preview` (Configurações) sem perfil.
- Modify: `src/app/api/admissao/[token]/submit/route.ts` — carrega `positionId` + marcações; schema torna `isDriverOperator`/`noOperationalUniform`/`uniformPants`/`uniformShoe` opcionais quando há perfil; grava os valores de `resolvePositionAnswers`; passa `isDriver`/`isForkliftOperator` a `missingRequiredItems`.
- Modify: `src/components/internal/admissao/form-editor/DocumentsTab.tsx` (`buildCondition` com os dois tipos novos), `shared.tsx` (rótulo da condição), `RulesTab.tsx` (excluir os dois tipos novos de `RULE_QUESTIONS`, pois não são perguntas ao candidato).

**Interfaces:**
- Consumes: `missingRequiredItems` (já existe).
- Produces: `PositionProfile`, `resolvePositionAnswers` (usados por page, DigitalForm e submit).

- [ ] **Step 1:** Testes que falham (acima). `npx tsx --test src/lib/admissao/form-submit.test.ts` → FAIL.
- [ ] **Step 2:** Implementar `form-config.ts`; testes → PASS.
- [ ] **Step 3:** Implementar page, DigitalForm, submit e editor; type-check + `npm test` → limpos.
- [ ] **Step 4: Commit** (`feat(admissoes): cargo define uniforme e documentos de motorista e operador`)

### Task 8: Documentação, deploy e verificação

- [ ] **Step 1:** CLAUDE.md: Cadastros (Áreas; cidade/UF da filial; marcações do cargo), Solicitação/Vaga (filial e área por id + nome copiado; `resolveOrgUnits`), Admissão digital (`resolvePositionAnswers`, condições `positionDriver`/`positionForkliftOperator`).
- [ ] **Step 2:** Commit e push para `master` (migração já aplicada na Task 1).
- [ ] **Step 3:** Após o deploy, conferir logado:
  - Configurações › Cadastros: "Áreas" lista 7; Filiais mostram cidade/UF; Cargos mostram as marcações.
  - `/solicitar-vaga`: Filial e Área são selects com os itens ativos.
  - Vaga em Rascunho: escolher filial preenche cidade/UF.
  - Prévia do formulário de admissão (Configurações) continua abrindo.
- [ ] **Step 4:** Atualizar a auditoria (`docs/ux-discovery/2026-11-13-auditoria-formularios.md`) marcando S2, A6, A7 e X2 como resolvidos.
