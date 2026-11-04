# Agenda de entrevistas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e mostrar a data/hora das entrevistas agendadas (Gente & Gestão e Gestor) de cada candidatura, dentro da vaga.

**Architecture:** Tabela nova `application_interviews` (evento agendado), regras puras testadas em `src/lib/recruitment/interviews/`, server actions finas com compare-and-swap, e três pontos de UI: seção no Quick View (aba Avaliações), sinal no card do Kanban e painel na página da vaga. O parecer continua em `application_assessments`; a entrevista só aponta para ele.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase (`supabase-js`, RLS), zod, `node:test` via `tsx`, Tailwind + `src/components/ui/*`.

**Spec:** `docs/superpowers/specs/2026-11-04-agenda-entrevistas-design.md`

## Ajustes em relação à spec (achados ao ler o código)
1. **Catálogo:** `INTERVIEW_TYPES` (`src/lib/recruitment/evaluations/catalog.ts`) já tem `HR` e `MANAGER`. `round` reusa esses códigos; `interviews/catalog.ts` só acrescenta rótulo e sigla das duas rodadas. Não cria catálogo paralelo.
2. **Histórico:** `logActivity()` só serve para admissões (`entity: ADMISSION|USER|ADMISSION_ATTACHMENT`). O histórico vai para a **timeline da candidatura** (`buildCandidateTimeline`, tipo `INTERVIEW_SCHEDULED` que já existe). Sem `logActivity`.
3. **Card do Kanban:** o card já mostra "Entrevista hoje/amanhã/dd/mm", deduzido de pareceres com data futura (`nextInterview()` em `candidatos/page.tsx`, `candidateSignals` em `candidate-presentation.ts`). Esse sinal passa a vir de `application_interviews`; o caminho antigo vira **fallback só para candidaturas sem nenhuma linha em `application_interviews`**.
4. **Fuso:** o sinal antigo usa o dia em UTC (`iso.slice(0,10)`), o que erra para horários após 21h BRT. Os helpers novos usam sempre `America/Sao_Paulo`.

## Global Constraints
- Fuso de exibição e entrada: `America/Sao_Paulo`; armazenar `timestamptz`.
- `round`: `HR` ("Gente & Gestão", sigla "G&G") e `MANAGER` ("Gestor"). `status`: `SCHEDULED | DONE | CANCELLED | NO_SHOW`. `durationMin` padrão 60, faixa 5–480. `location` ≤ 500, `interviewerName` ≤ 120, `notes` ≤ 2000, `cancelReason` ≤ 500.
- Conflito de horário/entrevistador **só avisa**, nunca bloqueia.
- Todo UPDATE leva guard de status no WHERE (compare-and-swap). Mensagem de falha: "A entrevista já foi alterada. Recarregue."
- Mutações internas = Server Actions; só ADMIN_RH escreve (também na RLS); staff lê. Usar `@/lib/supabase/server`, nunca service-role.
- Migração **aditiva**, aplicada à mão ANTES do push (`SUPABASE_DB_URL` é fornecida pelo usuário). Nome: `supabase/migrations/20261104180000_application_interviews.sql`.
- Texto da UI em sentence case, português, ícones lucide, sem emoji. Reusar `src/components/ui/*`.
- Commits: `tipo(escopo): descrição` em português, terminando com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gates: `node_modules/.bin/tsc --noEmit -p tsconfig.json` e `npm test` verdes ao fim de cada tarefa.
- **Não dar push** antes de a migração estar aplicada (a página de candidatos passa a embutir `application_interviews`; sem a tabela ela quebra).

## Review Focus
- Entrevista às 22h30 BRT (já é o dia seguinte em UTC) aparece no dia certo no card, na timeline e no formatador. → Task 2 e 3
- Duas pessoas mexendo na mesma entrevista: a segunda recebe a mensagem de compare-and-swap, nada é sobrescrito. → Task 4
- Entrevistador vazio, com caixa/acentos/espaços diferentes não gera conflito falso nem deixa de gerar o verdadeiro. → Task 2
- Candidatura antiga só com parecer de data futura continua com o sinal (fallback) e não ganha sinal duplicado depois de ter entrevista agendada. → Task 3
- Entrevista que já passou e segue `SCHEDULED` não some do card: vira sinal de atenção "Registrar resultado da entrevista". → Task 3

## File Structure
| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261104180000_application_interviews.sql` | tabela, RLS, índices, trigger de imutabilidade |
| `scripts/test-interviews.sql` | teste de banco (RLS, constraints, trigger, cascade) |
| `src/lib/recruitment/interviews/catalog.ts` | rodadas, status, rótulos, tipos `InterviewRow` |
| `src/lib/recruitment/interviews/rules.ts` | regras puras (fuso, atraso, conflito, transições, rótulos) |
| `src/lib/recruitment/interviews/schema.ts` | validação zod do agendamento |
| `src/lib/recruitment/interviews/actions.ts` | server actions |
| `src/app/api/applications/[id]/interviews/route.ts` | GET da lista da candidatura |
| `src/components/internal/candidate/evaluations/InterviewsSection.tsx` | seção "Entrevistas" no hub |
| `src/components/internal/candidate/evaluations/InterviewScheduleDialog.tsx` | diálogo de agendar/remarcar |
| `src/components/internal/job/JobInterviewsPanel.tsx` | painel na página da vaga |
| Modificados | `useCandidateWorkspace.ts`, `EvaluationsHub.tsx`, `InterviewDialog.tsx`, `CandidateQuickView.tsx`, `candidate-timeline.ts`, `candidate-presentation.ts`, `candidatos/page.tsx`, `candidates/types.ts`, `editar/page.tsx`, `JobWorkspace.tsx`, `package.json`, `CLAUDE.md`, `docs/DESENVOLVIMENTO.md` |

---

### Task 1: Migração e teste de banco

**Files:**
- Create: `supabase/migrations/20261104180000_application_interviews.sql`
- Create: `scripts/test-interviews.sql`
- Modify: `package.json` (acrescentar `&& node scripts/run-sql-test.mjs scripts/test-interviews.sql` ao script `test:db`)

**Interfaces:**
- Produces: tabela `application_interviews` com colunas `id` (text, `gen_random_uuid()::text`), `applicationId` (text, FK `applications` cascade), `round`, `scheduledAt` (timestamptz), `durationMin`, `location`, `interviewerName`, `notes`, `status`, `cancelReason`, `assessmentId` (text, FK `application_assessments` on delete set null), `createdAt`, `createdBy`, `updatedAt`, `updatedById`, `updatedByName`.

- [ ] **Step 1: Escrever `scripts/test-interviews.sql`** no formato de `scripts/test-assessments-hub.sql` (bloco `do $$`, `raise notice` por cenário, `raise exception` na falha, claims ADMIN/VIEWER via `set_config('request.jwt.claims', ...)` + `set local role authenticated`). Cenários: (C1) ADMIN_RH insere entrevista `HR`; (C2) VIEWER_RH lê 1 linha e o INSERT/UPDATE dele falha por RLS; (C3) `durationMin = 4`, `durationMin = 481`, `status = 'X'` e `round = ''` violam check; (C4) UPDATE tentando mudar `applicationId`/`createdBy` mantém os valores originais (trigger); (C5) apagar o `application_assessments` ligado deixa `assessmentId` nulo; (C6) apagar a candidatura apaga a entrevista.
- [ ] **Step 2: Rodar contra o banco ANTES da migração** — `node scripts/run-sql-test.mjs scripts/test-interviews.sql`. Esperado: FAIL (`relation "application_interviews" does not exist`). Se `SUPABASE_DB_URL` faltar, pedir ao usuário; não improvisar.
- [ ] **Step 3: Escrever a migração** seguindo `20261014120000_assessments_hub.sql` e as policies de `20260721000002_application_assessments.sql`: `create table if not exists`, checks com os limites das Global Constraints (`round` com tamanho 1–40, não lista fechada), índices `("applicationId","scheduledAt")` e parcial `("scheduledAt") where status = 'SCHEDULED'`, `enable row level security`, policy de leitura `is_staff()` e de escrita `is_admin()`, e função/trigger `application_interviews_keep_author` que fixa `applicationId`, `createdAt`, `createdBy` no UPDATE.
- [ ] **Step 4: Rodar o teste com a migração dentro da transação** — `node scripts/run-sql-test.mjs scripts/test-interviews.sql supabase/migrations/20261104180000_application_interviews.sql`. Esperado: `C1`…`C6 ok`, saída com código 0 e ROLLBACK.
- [ ] **Step 5: Commit** — `feat(vagas): tabela application_interviews (agenda de entrevistas)`. **Não aplicar em produção nem dar push aqui**; isso é o Step final da Task 8.

---

### Task 2: Regras puras, catálogo e validação

**Files:**
- Create: `src/lib/recruitment/interviews/catalog.ts`, `rules.ts`, `schema.ts`
- Test: `src/lib/recruitment/interviews/rules.test.ts`, `schema.test.ts`

**Interfaces:**
- Produces (`catalog.ts`): `INTERVIEW_ROUNDS` = `[{code:"HR",label:"Gente & Gestão",short:"G&G"},{code:"MANAGER",label:"Gestor",short:"Gestor"}]`; `type InterviewRoundCode`; `INTERVIEW_STATUSES` com `{code,label,tone}` (tons: SCHEDULED `info`, DONE `success`, CANCELLED `neutral`, NO_SHOW `warning`); `type InterviewStatus`; `roundLabel(code)`, `roundShort(code)` (código desconhecido → "Entrevista"); `interface InterviewRow { id; applicationId; round: string; scheduledAt: string; durationMin: number; location: string|null; interviewerName: string|null; notes: string|null; status: InterviewStatus; cancelReason: string|null; assessmentId: string|null; createdAt: string; createdBy: string|null; updatedAt: string; updatedByName: string|null }`; `INTERVIEW_COLUMNS` (string do `select`). Os códigos de `INTERVIEW_ROUNDS` devem ser do tipo `InterviewTypeCode` importado de `@/lib/recruitment/evaluations/catalog` (erro de compilação se divergirem).
- Produces (`rules.ts`):
  - `brtLocalToIso(local: string): string` e `isoToBrtLocal(iso: string): string` (`"YYYY-MM-DDTHH:mm"` ↔ ISO UTC)
  - `formatInterviewWhen(iso: string): string`
  - `isOverdue(i: Pick<InterviewRow,"status"|"scheduledAt"|"durationMin">, now: Date): boolean`
  - `pickInterviewForCard<T extends Pick<InterviewRow,"status"|"scheduledAt"|"durationMin"|"round">>(list: T[], now: Date): { item: T; overdue: boolean } | null`
  - `interviewSignalLabel(round: string, iso: string, now: Date): string`
  - `canTransition(from: InterviewStatus, to: InterviewStatus): boolean`
  - `normalizeInterviewer(name: string | null): string`
  - `findConflicts(candidate: {id?: string; interviewerName: string|null; scheduledAt: string; durationMin: number}, others: Array<{id: string; interviewerName: string|null; scheduledAt: string; durationMin: number; status: InterviewStatus}>): string[]` (ids em conflito)
- Produces (`schema.ts`): `parseScheduleInput(raw: unknown, now?: Date): { ok: true; value: ScheduleInput } | { ok: false; error: string }`, com `ScheduleInput = { applicationId: string; round: InterviewRoundCode; scheduledAt: string; durationMin: number; location: string|null; interviewerName: string|null; notes: string|null; allowPast: boolean }`. Reusa `firstIssue` de `evaluations/schema.ts` para a mensagem.

- [ ] **Step 1: Escrever `rules.test.ts`** (`node:test` + `node:assert/strict`, `NOW = new Date("2026-11-12T15:00:00Z")` = 12h BRT) com estes testes e valores:
  - `brtLocalToIso("2026-11-12T14:00") === "2026-11-12T17:00:00.000Z"`; `brtLocalToIso("2026-11-12T22:30") === "2026-11-13T01:30:00.000Z"`; `isoToBrtLocal("2026-11-13T01:30:00.000Z") === "2026-11-12T22:30"`
  - `formatInterviewWhen("2026-11-12T17:00:00.000Z") === "12/11 · 14h"`; `formatInterviewWhen("2026-11-13T01:30:00.000Z") === "12/11 · 22h30"` *(Review Focus 1)*
  - `isOverdue`: 14h BRT/60 min é `false` às 12h BRT e às 14h59; `true` às 15h01; `false` se `status` ≠ `SCHEDULED`
  - `pickInterviewForCard`: devolve a futura mais próxima com `overdue:false`; sem futura mas com atrasada devolve a atrasada mais recente com `overdue:true` *(Review Focus 5)*; só `CANCELLED/DONE` → `null`
  - `interviewSignalLabel("HR","2026-11-12T17:00:00Z",NOW) === "Entrevista G&G · hoje 14h"`; `("HR","2026-11-13T12:00:00Z",NOW) === "Entrevista G&G · amanhã 9h"`; `("MANAGER","2026-11-20T13:00:00Z",NOW) === "Entrevista Gestor · 20/11 10h"`
  - `canTransition`: `SCHEDULED→DONE|CANCELLED|NO_SHOW` true; qualquer saída de estado final false; `SCHEDULED→SCHEDULED` false
  - `findConflicts` *(Review Focus 3)*: "Ana Souza" × "  ana   SOUZA " com 14h–15h × 14h30–15h30 → `[id]`; início às 15h exatas → `[]`; nomes diferentes → `[]`; nome nulo ou vazio → `[]`; outro com `CANCELLED` → `[]`; mesmo `id` → `[]`; acento ("José" × "Jose") → conflito
- [ ] **Step 2: Escrever `schema.test.ts`**: `durationMin: 4` e `481` rejeitados; `round: "TECHNICAL"` rejeitado (só `HR`/`MANAGER`); `scheduledAt` no passado rejeitado com "A data da entrevista deve ser futura." e aceito com `allowPast: true`; `durationMin` ausente vira 60; textos vazios ou só espaços viram `null`; `scheduledAt` fora do formato ISO rejeitado.
- [ ] **Step 3: Rodar** `npx tsx --test src/lib/recruitment/interviews/*.test.ts`. Esperado: FAIL (módulos não existem).
- [ ] **Step 4: Implementar `catalog.ts`, `rules.ts`, `schema.ts`** com as assinaturas acima. Fuso: usar `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` (partes de data/hora e cálculo do offset para `brtLocalToIso`), sem somar 3 h fixas.
- [ ] **Step 5: Rodar** o mesmo comando. Esperado: PASS. Depois `node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- [ ] **Step 6: Commit** — `feat(vagas): regras puras da agenda de entrevistas`.

---

### Task 3: Sinal do card e eventos da timeline

**Files:**
- Modify: `src/lib/recruitment/candidate-presentation.ts` (`SignalInput`, `candidateSignals`), `src/lib/recruitment/candidate-timeline.ts` (`TimelineInput`, `buildCandidateTimeline`)
- Test: `src/lib/recruitment/candidate-presentation.test.ts`, `src/lib/recruitment/candidate-timeline.test.ts`

**Interfaces:**
- Consumes: `pickInterviewForCard`, `interviewSignalLabel`, `formatInterviewWhen` (Task 2); `roundLabel` (Task 2).
- Produces: `SignalInput.interviews?: Array<{ round: string; scheduledAt: string; durationMin: number; status: InterviewStatus }>`; `TimelineInput.interviews?: InterviewRow[]`.

- [ ] **Step 1: Testes em `candidate-presentation.test.ts`** (reusar `NOW` e `STAGES` do arquivo): com `interviews` de um `SCHEDULED` futuro, o sinal `key:"interview"` tem `label:"Entrevista G&G · hoje 14h"` (ajustar `NOW` local para 12/11 se o do arquivo for outro), `attention:false`; entrevista atrasada → `label:"Registrar resultado da entrevista"`, `tone:"warning"`, `attention:true`; com `interviews` não vazio e `nextInterviewAt` preenchido sai **um** sinal de entrevista só *(Review Focus 4)*; com `interviews` vazio/ausente e `nextInterviewAt` preenchido o comportamento antigo continua (os testes existentes de `formatInterviewLabel` seguem verdes).
- [ ] **Step 2: Testes em `candidate-timeline.test.ts`**: entrevista `SCHEDULED` gera evento `type:"INTERVIEW_SCHEDULED"`, `title:"Entrevista agendada"`, `detail:"Gente & Gestão · 12/11 · 14h"`, `at` = `createdAt`, `actor` = `createdBy`; `CANCELLED` gera também `title:"Entrevista cancelada"` em `updatedAt` (detail com o motivo, se houver); `NO_SHOW` gera `title:"Candidato não compareceu"`; `DONE` gera só o evento de agendamento.
- [ ] **Step 3: Rodar** `npx tsx --test src/lib/recruitment/candidate-presentation.test.ts src/lib/recruitment/candidate-timeline.test.ts`. Esperado: FAIL nos casos novos.
- [ ] **Step 4: Implementar.** Em `candidateSignals`, se `input.interviews?.length`, usar `pickInterviewForCard(...)` (entrevista futura → `tone:"info"`, `icon:"calendar"`; atrasada → atenção) e **não** avaliar `nextInterviewAt`; caso contrário manter o bloco atual. Em `buildCandidateTimeline`, acrescentar os eventos acima (ids `interview-<id>`, `interview-cancel-<id>`, `interview-noshow-<id>`).
- [ ] **Step 5: Rodar** os dois arquivos e depois `npm test`. Esperado: tudo PASS. `tsc` limpo.
- [ ] **Step 6: Commit** — `feat(vagas): sinal de entrevista no card e eventos na timeline`.

---

### Task 4: Server actions e rota de leitura

**Files:**
- Create: `src/lib/recruitment/interviews/actions.ts`, `src/app/api/applications/[id]/interviews/route.ts`

**Interfaces:**
- Consumes: `parseScheduleInput`, `canTransition`, `findConflicts`, `INTERVIEW_COLUMNS`, `InterviewRow`.
- Produces (todas `"use server"`, retorno `InterviewActionResult = { ok: true; interview: InterviewRow; conflicts: Array<{ candidateName: string; scheduledAt: string }> } | { ok: false; error: string }`):
  - `scheduleInterviewAction(input: unknown)`
  - `updateInterviewAction(id: string, input: unknown)` — só `SCHEDULED`; revalida o payload com `parseScheduleInput(..., allowPast)`
  - `cancelInterviewAction(id: string, reason?: string)`
  - `markNoShowAction(id: string)`
  - `completeInterviewAction(id: string, assessmentId: string)` — confere que o parecer pertence à mesma candidatura
- Produces (rota): `GET /api/applications/[id]/interviews` → `{ interviews: InterviewRow[] }`, mais recentes primeiro por `scheduledAt`; 403 sem sessão.

- [ ] **Step 1: Implementar `actions.ts`** no molde de `src/lib/jobs/position-actions.ts`: helper `actor()` (só `ADMIN_RH`; devolve `{ userId, name }`), `createClient()` de `@/lib/supabase/server`, `revalidatePath` de `/vagas/<jobId>/candidatos` e `/vagas/<jobId>/editar` (obter `jobId` via embed `application:applications(jobId, fullName)` no mesmo `select`). Toda mudança de status usa `.eq("status","SCHEDULED")` + `.select().maybeSingle()`; resultado `null` → `{ ok:false, error:"A entrevista já foi alterada. Recarregue." }`. `scheduleInterviewAction` grava `createdBy = name` e `updatedById/updatedByName`; depois consulta as `SCHEDULED` do mesmo dia ±1 com embed do nome da candidata e chama `findConflicts` para preencher `conflicts` (aviso, nunca erro).
- [ ] **Step 2: Implementar a rota GET** no molde de `src/app/api/applications/[id]/assessments/route.ts` (`auth()` + `createClient()`; staff lê).
- [ ] **Step 3: Verificar** `node_modules/.bin/tsc --noEmit -p tsconfig.json` limpo. Verificação funcional contra o banco só acontece na Task 8 (depende da migração aplicada); registrar isso no commit.
- [ ] **Step 4: Commit** — `feat(vagas): server actions e rota da agenda de entrevistas`.

---

### Task 5: Seção "Entrevistas" no Quick View

**Files:**
- Create: `src/components/internal/candidate/evaluations/InterviewsSection.tsx`, `InterviewScheduleDialog.tsx`
- Modify: `src/components/internal/candidate/useCandidateWorkspace.ts`, `evaluations/EvaluationsHub.tsx`, `evaluations/InterviewDialog.tsx`, `CandidateQuickView.tsx`

**Interfaces:**
- Consumes: Task 4 (actions, rota), Task 2 (regras), `InterviewRow`.
- Produces: no hook, `interviews: Loadable<InterviewRow>`, `setInterviews(update: (items: InterviewRow[]) => InterviewRow[])` e `reloadInterviews()` (mesmo padrão de cache/`isActive` de `assessments`; carregado em paralelo e incluído no `Snapshot`). `EvaluationsHub` ganha props `interviews: Loadable<InterviewRow>` e `onInterviewsChange`. `InterviewDialog` ganha prop opcional `prefill?: { interviewType: string; occurredAt: string; evaluator: string }`, aplicada em `initial` só quando `existing` é `null`.

- [ ] **Step 1: Hook** — acrescentar `loadInterviews` (GET da rota), estado, snapshot, setter e `reloadInterviews`, espelhando `loadAssessments`.
- [ ] **Step 2: `InterviewScheduleDialog`** no padrão de `SimpleEvaluationDialogs.tsx` (`DialogShell`). Campos: rodada (select das `INTERVIEW_ROUNDS`), `datetime-local` (converter com `brtLocalToIso`/`isoToBrtLocal`), duração, entrevistador, local ou link, observações. Props: `applicationId`, `existing: InterviewRow | null`, `defaultInterviewer: string`, `onClose`, `onSaved(item: InterviewRow, conflicts)`. Erros de validação aparecem no diálogo; `conflicts` não vazio mostra toast de aviso ("Fulano já tem entrevista com X às 14h") mas mantém o salvamento. Permitir data passada só quando a pessoa marca "Entrevista já realizada" (`allowPast`).
- [ ] **Step 3: `InterviewsSection`** — lista cronológica (`StatusBadge` pelo `tone` do status, rodada, `formatInterviewWhen`, entrevistador, local; `isOverdue` mostra pílula "Registrar resultado"). Botão "Agendar entrevista" (só `canManage`). Menu `DropdownMenu` por item `SCHEDULED`: Remarcar, Cancelar (`ConfirmDialog` com motivo opcional), Marcar falta, Registrar parecer. `EmptyState` quando vazia.
- [ ] **Step 4: Registrar parecer** — `EvaluationsHub` guarda `fromInterview: InterviewRow | null` no estado do diálogo; abre `InterviewDialog` com `prefill = { interviewType: round, occurredAt: isoToBrtLocal(scheduledAt).slice(0,10), evaluator: interviewerName ?? defaultEvaluator }`. No `onSaved` de criação, chamar `completeInterviewAction(fromInterview.id, item.id)`; em falha, `notify("error", "Parecer salvo, mas não foi possível vincular à entrevista.")` e `reloadInterviews()`.
- [ ] **Step 5: Encaixe** — renderizar `<InterviewsSection>` antes do bloco de pareceres nos dois layouts de `EvaluationsHub` (onde hoje aparece `{interviews}`, linhas ~439 e ~452; renomear o bloco existente para não colidir). Em `CandidateQuickView.tsx`: passar as novas props, incluir `ws.interviews.items` em `buildCandidateTimeline` (campo `interviews`) e em `extrasLoading`.
- [ ] **Step 6: Verificar** `tsc` limpo e `npm test` verde. Verificação visual no navegador fica para a Task 8 (precisa da migração aplicada).
- [ ] **Step 7: Commit** — `feat(vagas): seção de entrevistas agendadas no Quick View`.

---

### Task 6: Sinal no card do Kanban

**Files:**
- Modify: `src/app/(internal)/vagas/[id]/candidatos/page.tsx`, `src/components/internal/candidates/types.ts`

**Interfaces:**
- Consumes: `SignalInput.interviews` (Task 3).
- Produces: `PipelineCandidate.interviews: Array<{ round: string; scheduledAt: string; durationMin: number; status: InterviewStatus }>` (só `SCHEDULED`). `CandidatePipeline` já repassa o objeto ao `candidateSignals` com spread (linhas ~243 e ~719), então não precisa mudar.

- [ ] **Step 1:** em `candidatos/page.tsx`, acrescentar ao `select` de `applications` o embed `interviews:application_interviews(round, scheduledAt, durationMin, status)`, ampliar o tipo de `appList`, e montar `interviews` filtrando `status === "SCHEDULED"`.
- [ ] **Step 2:** `nextInterviewAt: (a.interviews?.length ? null : nextInterview(assessments))` — o caminho antigo só vale para quem **nunca** teve linha em `application_interviews` *(Review Focus 4)*. Para isso o embed precisa trazer todas as linhas e o filtro por `SCHEDULED` acontece depois.
- [ ] **Step 3:** adicionar o campo em `candidates/types.ts` e fornecer `[]` onde `PipelineCandidate` é construído em outros lugares (o compilador aponta).
- [ ] **Step 4: Verificar** `tsc` limpo e `npm test` verde.
- [ ] **Step 5: Commit** — `feat(vagas): sinal de entrevista agendada no card do pipeline`.

---

### Task 7: Painel "Entrevistas" na página da vaga

**Files:**
- Create: `src/components/internal/job/JobInterviewsPanel.tsx`
- Modify: `src/app/(internal)/vagas/[id]/editar/page.tsx`, `src/components/internal/job/JobWorkspace.tsx`

**Interfaces:**
- Produces: `interface JobInterviewItem { id: string; applicationId: string; candidateName: string; round: string; scheduledAt: string; durationMin: number; interviewerName: string | null; location: string | null; overdue: boolean }`; `JobWorkspaceData.interviews: JobInterviewItem[]`; `JobInterviewsPanel({ jobId, items }: { jobId: string; items: JobInterviewItem[] })`.

- [ ] **Step 1: Query** em `editar/page.tsx`, dentro do `Promise.all` existente: `application_interviews` com embed `application:applications!inner(id, fullName, jobId)`, `.eq("application.jobId", id)`, `.eq("status","SCHEDULED")`, `.order("scheduledAt",{ascending:true})`, `.limit(50)`. Montar `JobInterviewItem[]` com `overdue = isOverdue(...)`.
- [ ] **Step 2: Painel** com `Panel` (título "Entrevistas"), atrasadas primeiro e depois as próximas; cada linha com candidata, sigla da rodada, `formatInterviewWhen`, entrevistador e link para `/vagas/<jobId>/candidatos` (se `CandidatePipeline` já tiver parâmetro de URL para abrir um candidato no Quick View, usar esse parâmetro; procurar com `grep` antes de decidir). `EmptyState` curto quando vazio. Não renderizar em vaga de banco de talentos (`job.isTalentPool`).
- [ ] **Step 3: Encaixe** em `JobWorkspace.tsx` na aba Visão, perto de `PipelineOverview` (linha ~641).
- [ ] **Step 4: Verificar** `tsc` limpo e `npm test` verde.
- [ ] **Step 5: Commit** — `feat(vagas): painel de entrevistas na página da vaga`.

---

### Task 8: Documentação, aplicação da migração e verificação final

**Files:**
- Modify: `CLAUDE.md` (mapa de módulos: bullet "Agenda de entrevistas" com os caminhos, a regra "agendada ≠ parecer", o fallback do sinal antigo e a ordem migração→push), `docs/DESENVOLVIMENTO.md` (entrada datada de 2026-11-04)

- [ ] **Step 1: Docs** — editar os dois arquivos conforme acima.
- [ ] **Step 2: Gates locais** — `node_modules/.bin/tsc --noEmit -p tsconfig.json` e `npm test`. Esperado: sem erros, todos os testes PASS.
- [ ] **Step 3: Aplicar a migração** (precisa da `SUPABASE_DB_URL` do usuário): `SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs supabase/migrations/20261104180000_application_interviews.sql 20261104180000`. Depois `npm run test:db`. Esperado: todos os cenários `ok`, incluindo `test-interviews.sql`.
- [ ] **Step 4: Verificação funcional** — `preview_start` do dev server (o dev usa o banco de produção: criar a entrevista de teste, conferir e **cancelar/limpar** em seguida). Conferir: agendar G&G às 22h30 (aparece "12/11 · 22h30"), remarcar, cancelar, marcar falta, registrar parecer a partir da entrevista (status `DONE` e `assessmentId` preenchido), sinal no card, painel na vaga, evento na timeline, e ausência de erros em `read_console_messages`.
- [ ] **Step 5: Commit e push** — `docs(vagas): documenta a agenda de entrevistas`. O push só acontece depois do Step 3 (migração aplicada) e dispara o deploy de produção.
