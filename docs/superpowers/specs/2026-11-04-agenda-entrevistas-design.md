# Agenda de entrevistas da candidatura — design

Data: 2026-11-04 · Status: aguardando revisão

## Objetivo
Registrar, dentro da vaga, a **data e hora das entrevistas agendadas** de cada candidato, em duas rodadas:
**Gente & Gestão (`HR`)** e **Gestor (`MANAGER`)**, no estilo Selecty/InHire. Depois da entrevista, o evento
leva ao parecer que já existe, sem duplicar dados.

## Escopo
**v1 (esta spec):** registrar e visualizar. Sem e-mail, convite, .ics, link público ou Google Calendar.

**Fora de escopo (fase 2):** agenda geral (calendário), e-mail/convite ao candidato e ao gestor, confirmação de
presença, automação de entrada em etapa do funil.

## Decisões (confirmadas ou assumidas)
| # | Decisão | Origem |
|---|---|---|
| 1 | Tabela nova `application_interviews`; agendada ≠ realizada | confirmada |
| 2 | Várias entrevistas por candidato e por rodada (histórico de remarcação/cancelamento) | assumida |
| 3 | Entrevistador em texto livre (`interviewerName`), pois o gestor pode não ter usuário | assumida |
| 4 | Local e link em um único campo livre (`location`) | assumida |
| 5 | Parecer continua em `application_assessments` (`kind = INTERVIEW`); a agenda só aponta para ele | confirmada |

## Dados
Migração **aditiva** `supabase/migrations/AAAAMMDDHHMMSS_application_interviews.sql`, aplicada à mão ANTES do push
(ver CLAUDE.md). Colunas em camelCase com aspas, como o resto do schema.

`application_interviews`:
- `id` uuid PK
- `applicationId` FK → `applications` (on delete cascade), índice em `("applicationId", "scheduledAt")`
- `round` text, check em (`HR`, `MANAGER`) — catálogo extensível por `catalog.ts`; o check é relaxado
  para tamanho (1–40) como `interviewType`, para novo tipo não exigir migração
- `scheduledAt` timestamptz NOT NULL (exibido em America/Sao_Paulo)
- `durationMin` int NOT NULL default 60, check 5–480
- `location` text (≤ 500), `interviewerName` text (≤ 120), `notes` text (≤ 2000)
- `status` text NOT NULL default `SCHEDULED`, check em (`SCHEDULED`, `DONE`, `CANCELLED`, `NO_SHOW`)
- `cancelReason` text (≤ 500)
- `assessmentId` FK → `application_assessments` (on delete set null), preenchido ao registrar o parecer
- `createdAt`, `createdBy`, `updatedAt`, `updatedById`, `updatedByName` (mesmo padrão de `application_assessments`);
  trigger mantém `applicationId`, `createdAt`, `createdBy` imutáveis
- **RLS:** `is_staff()` lê, `is_admin()` escreve (helpers de `20260720000001_rls.sql`)
- Índice parcial em `("scheduledAt") where status = 'SCHEDULED'` para a lista da vaga

Sem cópia de dados do parecer: a recomendação, o conteúdo e o entrevistador real ficam só em
`application_assessments`.

## Regras puras (`src/lib/recruitment/interviews/`)
Testadas com `node:test` (`npm test`), sem acesso a banco.
- `catalog.ts`: rodadas (`HR` → "Gente & Gestão", `MANAGER` → "Gestor"), rótulos e status.
- `rules.ts`:
  - `isOverdue(interview, now)`: `SCHEDULED` com `scheduledAt + durationMin` no passado → "Registrar resultado".
  - `nextInterview(list, now)`: próxima `SCHEDULED` futura da candidatura (para o selo do Kanban).
  - `findConflicts(candidate, list)`: mesmo `interviewerName` (comparação normalizada) com horários sobrepostos.
    Só **avisa**, nunca bloqueia.
  - `canTransition(from, to)`: `SCHEDULED → DONE | CANCELLED | NO_SHOW`; estados finais não voltam
    (remarcar = cancelar a atual com motivo "Remarcada" e criar outra, ou editar a data enquanto `SCHEDULED`).
  - `formatInterviewWhen(date)`: "12/11 · 14h" em BRT.
- `schema.ts`: zod do payload (data futura exigida só ao criar; permitir passado ao registrar entrevista já feita).

## Ações (server actions finas, `src/lib/recruitment/interviews/actions.ts`)
- `scheduleInterview`, `updateInterview` (só `SCHEDULED`), `cancelInterview` (motivo opcional),
  `markNoShow`, `completeInterview` (recebe `assessmentId` do parecer salvo).
- Todo UPDATE leva guard de status no WHERE (compare-and-swap), como a solicitação de vaga.
- `revalidatePath` da vaga e do candidato; `logActivity()` com `action` mapeada no feed
  (`ADMISSION_LOG_ACTIONS` equivalente / `catalog.ts` de atividades) para aparecer na timeline.
- Client do usuário (`@/lib/supabase/server`), respeitando RLS. Sem service-role.

## Interface (v1)
1. **Quick View e aba Avaliações** (`src/components/internal/candidate/evaluations/`): seção "Entrevistas" acima do
   hub, lista cronológica com status (`StatusBadge`), botão "Agendar entrevista" → `InterviewScheduleDialog`
   (rodada, data/hora, duração, entrevistador, local/link, observações; aviso de conflito).
   Menu por item: Remarcar, Cancelar, Marcar falta, **Registrar parecer**.
   "Registrar parecer" abre o `InterviewDialog` existente com tipo, data e entrevistador pré-preenchidos; ao salvar,
   chama `completeInterview` com o `assessmentId` (mesma transação lógica: parecer primeiro, depois o vínculo).
2. **Card do Kanban** (`CandidateCard`): selo discreto com a próxima entrevista, ex.: "Entrevista G&G · 12/11 14h";
   atrasada vira pílula de atenção com motivo (padrão de `attention.ts`). Dados vêm de uma consulta única por
   vaga (sem N+1), agrupada por `applicationId`.
3. **Página da vaga** (`/vagas/[id]/editar?tab=visao`): painel "Entrevistas" com próximas e atrasadas, link para o
   candidato. Sem Kanban novo (decisão de 2026-10-08 vale só para lista de vagas/admissões; aqui é lista).
4. Design System: `Panel`, `StatusBadge`, `EmptyState`, `ConfirmModal`, `cn()`; sentence case; ícones lucide.

## Erros e casos de borda
- Data inválida ou duração fora da faixa: erro de validação no diálogo, nada gravado.
- Concorrência (duas pessoas alteram a mesma entrevista): o guard de status faz o segundo falhar com mensagem
  "A entrevista já foi alterada. Recarregue."
- Candidatura reprovada ou contratada: entrevistas `SCHEDULED` continuam visíveis, mas o selo do Kanban só aparece
  para candidaturas ativas; **não há cancelamento automático** na v1 (registrar como risco conhecido).
- Fuso: sempre `timestamptz`; entrada e saída convertidas de/para BRT no cliente e no formatador.
- Excluir candidatura apaga as entrevistas (cascade); excluir parecer só desvincula (`set null`).

## Testes
- `rules.test.ts`: atraso, próxima entrevista, conflitos (sobreposição, mesmo nome com caixa/acentos diferentes),
  transições válidas e inválidas, formatação BRT.
- `schema.test.ts`: limites e datas.
- Banco: cenário em `scripts/test-interviews.sql` (transação com ROLLBACK, como `test-process-templates.sql`):
  RLS (VIEWER lê, não escreve), constraints, trigger de imutabilidade, cascade.
- Type-check: `node_modules/.bin/tsc --noEmit -p tsconfig.json`.

## Fatiamento de entrega
1. Migração + regras puras + testes.
2. Ações + diálogo + seção no Quick View/aba Avaliações.
3. Selo no Kanban + painel na página da vaga.
4. Atualizar `CLAUDE.md` (mapa de módulos) e `docs/DESENVOLVIMENTO.md`.

## Riscos
- Aplicar a migração antes do push (ordem segura do CLAUDE.md); é aditiva e não quebra o código antigo.
- O parecer e a agenda podem divergir se o usuário registrar parecer sem passar pela entrevista agendada; é
  permitido (parecer avulso continua existindo) e a agenda não depende dele.
