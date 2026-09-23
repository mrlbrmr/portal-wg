# CLAUDE.md — Portal de Vagas WG Baterias

Orientação para o Claude Code neste repositório. **Este arquivo é commitado e carregado
automaticamente em qualquer notebook** que baixe o projeto do GitHub. Histórico detalhado
e decisões: [`docs/DESENVOLVIMENTO.md`](docs/DESENVOLVIMENTO.md). Instalação: [`INSTALACAO.md`](INSTALACAO.md).

## O que é
Portal de carreiras + ATS (recrutamento) + Admissões + Avaliações/Testes da WG Baterias.
Produção: **carreiras.wgbaterias.com.br** (deploy na Vercel).

## Stack
- **Next.js 15** (App Router) · React 19 · TypeScript · Tailwind 3
- **Supabase** (Postgres + Auth + Storage) — acesso a dados em runtime é via **`supabase-js`**
- `@google/genai` — **toda IA passa por `src/lib/ai/gemini.ts`** (Gemini, plano gratuito: validação de documentos, análise de CV, geração de testes; modelo via `GEMINI_MODEL`); `exceljs`, `resend`, `@dnd-kit`, `tiptap`, `zod`
- ⚠️ **`prisma/schema.prisma` é APENAS documentação do schema.** Não há Prisma client em runtime
  (não existe dependência `prisma`/`@prisma/client`; `src/lib/prisma.ts` foi removido na migração
  para o Supabase). A **fonte de verdade do schema são as migrações SQL** em `supabase/migrations/`.

## Autorização (RLS no banco, não no app)
- Papéis (claim JWT `app_metadata.user_role`): **ADMIN_RH** (escreve) e **VIEWER_RH** (só lê).
- Policies padrão: `is_staff()` lê o interno; `is_admin()` escreve. Helpers em `supabase/migrations/20260720000001_rls.sql`.
- Clients: `@/lib/supabase/server` (sessão do usuário, respeita RLS — use na maioria dos casos) ·
  `@/lib/supabase/admin` (service-role, ignora RLS — só para POST público de candidatura, feeds e webhooks).

## Comandos
- Dev: `npm run dev`
- **Type-check** (gate principal de validação): `node_modules/.bin/tsc --noEmit -p tsconfig.json`
- Lint: `npm run lint` — ⚠️ abre setup interativo de ESLint se não configurado; prefira o type-check.
- **Testes:** `npm test` — runner `node:test` nativo via `tsx` (sem dependência extra).
  Hoje cobre a máquina de estados da solicitação de vaga (`src/lib/job-requests/workflow.test.ts`).
- **Teste de banco:** `npm run test:db` — cenários das posições contra o banco real, em transação com ROLLBACK.

## Deploy
- **Push em `master` → deploy de produção automático na Vercel** (integração GitHub; não há `vercel.json` nem `.vercel/`).

## Migrações de banco (LER ANTES DE MEXER NO SCHEMA)
- Arquivos SQL em `supabase/migrations/` (nome `AAAAMMDDHHMMSS_descricao.sql`).
- **Aplicadas à mão** (não rodam no deploy):
  `SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs supabase/migrations/<arquivo>.sql <versao>`
  (registra em `supabase_migrations.schema_migrations`). A `SUPABASE_DB_URL` é fornecida pelo usuário.
- **Ordem segura:** aplique migrações **aditivas ANTES de dar push**. Durante o build da Vercel o código
  antigo ainda está no ar; uma migração aditiva (add coluna/tabela) não o quebra. Só depois faça push.
  Evite migrações destrutivas (drop coluna) sem coordenar — quebram o código antigo durante o build.

## Mapa de módulos (`src/app/(internal)` = interno · `src/app/(public)` = público)
- **Admissões:** `src/app/(internal)/admissoes/**`, `src/lib/admissao/**`, `src/components/internal/admissao/**`
- **Modelos de checklist:** `.../admissoes/configuracoes/modelos`, `src/lib/admissao/template-actions.ts`, `checklist.ts`
- **ATS / Vagas:** `src/app/(internal)/vagas/**` (kanban de candidatos, funil configurável)
- **Página da vaga + Posições:** `/vagas/[id]/editar?tab=visao|descricao|processo|divulgacao|historico`
  (`src/components/internal/job/**`, regras puras em `src/lib/jobs/**`). **Vaga = processo seletivo;
  posição = cada contratação** (`job_positions`: OPEN/FILLED/CANCELLED). Nunca crie uma vaga por posição.
  - `jobs.openings`/`jobs.openPositions` são **derivados por trigger** — nunca escreva direto; o número de
    posições muda só por `job_position_add/_cancel` (server actions em `src/lib/jobs/position-actions.ts`).
  - Contratar = `job_position_fill` (modal do pipeline → `POST /api/admissoes` com `jobPositionId`);
    desistência = `job_position_release`. Cancelar/liberar nunca apaga; tudo vai para `job_events`.
  - `jobs.approvedScope` = snapshot do que a solicitação aprovou (comparação em `approved-scope.ts`).
  - Salário: `salaryRange` (lido por portal/feeds) é DERIVADO de `salary` + `salaryPublic` (`salary.ts`).
  - Público: use `PUBLIC_JOB_COLUMNS` (`src/lib/jobs-query.ts`), nunca `select("*")`.
- **Quick View do candidato** (abre ao lado do pipeline da vaga): `src/components/internal/candidate/CandidateQuickView.tsx`
  (split view no desktop, J/K, barra de decisão). Anotações por autor em `application_notes`
  (`/api/applications/[id]/notes`); `applications.notes` = "anotações anteriores" + motivo de reprovação.
  Análise de IA estruturada em `application_assessments.metadata` (lida por `src/lib/recruitment/ai-analysis.ts`).
- **Solicitação de vaga:** módulo próprio em `/solicitacoes` (`src/app/(internal)/solicitacoes/**`).
  **Solicitação ≠ Vaga.** A solicitação é o pedido de AUTORIZAÇÃO para contratar; a vaga é o
  processo seletivo que nasce depois. Gestor pede em `/solicitar-vaga` (público, campos
  estruturados) → `DRAFT → PENDING_HR → PENDING_APPROVAL → APPROVED → RECRUITING`
  (+ `RETURNED/REJECTED/CANCELLED`). Números humanos: `REQ-AAAA-NNNN` / `VAG-AAAA-NNNN`.
  - **Onde está a regra:** `src/lib/job-requests/workflow.ts` — módulo PURO (transições,
    permissões, comentário obrigatório, campos críticos). A UI e o service consultam o mesmo
    módulo, então o botão que aparece é o que o servidor aceita. Testes: `npm test`.
  - **Use cases:** `src/lib/job-requests/service.ts`; server actions são casca fina
    (`actions.ts`). Todo UPDATE leva guard de status no WHERE (compare-and-swap).
  - **A vaga só nasce em** `create_job_from_request()` (função plpgsql, transacional, com
    `for update`) — nunca no `JobForm`. Clicar duas vezes não cria duas vagas.
  - Campo crítico alterado depois de aprovado ⇒ volta para `PENDING_APPROVAL`.
  - `jobs.responsible` = recrutador; `jobs.hiringManager` = gestor solicitante;
    `jobs.requestId` = solicitação de origem (**null em vagas legadas — é esperado**).
  - **Colunas que existem no banco mas a aplicação NÃO usa** (reservadas, não remover sem
    migração): `priority` (priorização é externa), `salary_min`/`salary_max` (o RH define o
    salário direto na vaga), `cost_center` (a WG não usa) e `budget_status` (headcount é
    controlado fora do sistema). O gestor não informa nenhum desses no formulário.
  - `job_request_form_config` agora guarda só **perguntas complementares** (→ `extra_data`).
- **Banco de Talentos (CRM):** `src/app/(internal)/talentos/**`, `src/lib/talentos/**`, `src/components/internal/talentos/**`.
  **Talento (perfil) ≠ candidatura:** `talentos` 1 → N `applications.talentoId`; nunca duplique o perfil.
  - Listagem = view `talentos_crm` (situação CALCULADA, resumo do histórico, coluna `busca`) + RPC
    `talentos_crm_facets()`; filtros/ordem/página no servidor (`list.ts`), regras puras em `crm.ts` (testado).
  - Situação: só Disponível/Indisponível e Arquivar são manuais; Em processo/Contratado vêm das candidaturas.
  - Adicionar à vaga: `service.ts#addTalentsToJob` (sem candidatura duplicada; origem `BANCO_TALENTOS`).
  - Tags = cadastro central `admission_tags` via `talento_tag_links` (`talento_tags` antigo não é usado).
  - Mutações em `actions.ts`; ações relevantes registradas em `talento_audit_log` (histórico somente leitura).
  - Drawer e `/talentos/[id]` usam o mesmo `TalentWorkspace`. Nada de score/"fit" no banco.
- **E-mail transacional:** `src/lib/email.ts` (Resend) — sem `RESEND_API_KEY`/`RESEND_FROM_EMAIL`
  nada é enviado (só loga). Templates em `src/lib/email-templates.ts`. Avisos ao RH: nova
  solicitação de vaga e formulário de admissão enviado (`src/lib/admissao/notify-submitted.ts`).
- **Avaliações / Testes:** `src/app/(internal)/avaliacoes/{banco,aplicacoes,resultados}`, `src/lib/avaliacoes/**`,
  página pública `src/app/avaliacao/[token]`.
  - **A UI decide pelo TIPO, nunca pelo nome do teste:** `assessment_templates."assessmentType"`
    (`TECHNICAL_OBJECTIVE | TECHNICAL_MIXED | BEHAVIORAL`) e `"gradingMode"` são derivados por trigger de
    `kind` + `questions` (espelho: `classifyTemplate()`/`resolveAssessmentType()` em `schema.ts`).
  - **Comportamental (Big Five) nunca tem nota, aprovação, reprovação nem correção** (trigger zera `outcome`).
    O valor por dimensão NÃO é percentil (média 1–5 → 20–100); textos em `big-five.ts`.
  - Rótulos/status únicos em `presentation.ts`; pontuação e correção manual em `scoring.ts` (puro, testado).
    Vocabulário: "Teste técnico", "Avaliação comportamental", "Resultado disponível", "Aguardando correção".
- **Admissão digital (candidato, por token):** `src/app/admissao/[token]`, `src/app/api/admissao/[token]/**`
  (`DigitalForm` tem modo `preview` — usado na aba Visualização das Configurações, sem upload/envio).
  ⚠️ O documento do formulário é ligado ao cadastro "Tipos de documento" **pelo nome exato** (upload route).
- **Configurações** (`src/app/(internal)/configuracoes/**`): mapa único de seções/páginas/cadastros em
  `src/lib/settings/registry.ts` (home, breadcrumbs e navegação de Cadastros leem dele). Toda página usa
  `SettingsPage` (breadcrumb + container 1180px + "Última alteração"); formulários usam
  `useSettingsDraft` + `SettingsSaveBar` (estado sujo, Ctrl+S, aviso ao sair); listas usam `SortableList`
  (dnd-kit acessível). Componentes em `src/components/internal/settings/`.
  - **Histórico de alterações:** `config_change_log` via `logConfigChange()` (`src/lib/settings/audit.ts`) —
    chame em toda ação que salva configuração.
  - **Cadastros** (`/configuracoes/cadastros/<slug>`; "Categorias" redireciona): item EM USO nunca é excluído
    (`src/lib/admissao/registry-usage.ts`) — cargos/empresas/filiais/etapas são desativados, tags só com
    "desvincular", tipos de documento em uso ficam. Etapa de conclusão da admissão é ÚNICA (`setConclusionStage`).
  - **Funil:** automações de entrada na etapa em `src/lib/selection-funnel/automations.ts` (puro, testado) +
    `run-automations.ts` (servidor, chamado no PATCH da candidatura). Só existem as reais: abrir cadastro da
    admissão e gerar link do teste. Remover etapa com candidatos exige mover para outra etapa; etapa com
    histórico é desativada, nunca excluída.
  - **Campos adicionais da solicitação:** regras em `src/lib/job-requests/extra-fields.ts` (visibilidade,
    obrigatoriedade só se visível, múltipla escolha = JSON de string[] em `extra_data`).

## Design System do painel (ler antes de criar UI)
- Tokens: cores semânticas `success/info/warning/danger/neutral` (`bg-*-bg text-*-fg`), radius
  `rounded-control` (8px) / `rounded-card` (12px), tipografia `text-page-title … text-label`.
- Reutilize `src/components/ui/*`: `Button`/`ButtonLink`, `StatusBadge` (status) × `StageBadge`
  (etapa), `ProgressBar`, `CompactMetrics`, `Panel`, `ActionListItem`, `ActivityTimeline`,
  `FilterPopover`/`ActiveFilterChips`/`QuickFilterChips`, `EmptyState`, `Skeleton`, `ConfirmModal`.
- Status da vaga × etapa: sempre via `src/lib/recruitment/job-presentation.ts` (não use o enum cru).
  Alertas de vaga sempre com motivo (`src/lib/recruitment/attention.ts`); SLA em `sla.ts` (política
  ainda `null`). Sentence case nos textos ("Nova vaga"), sem emoji como ícone (use lucide).

## Convenções
- Mutações internas = **Server Actions** (revalidam a página com `revalidatePath`); uploads (>1 MB) e
  fluxos públicos = **API routes**.
- Reordenação: setas ↑↓ (server actions que trocam `sortOrder`) ou drag-and-drop nativo do HTML5.
- Commits: `tipo(escopo): descrição` em português.
