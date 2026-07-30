# Histórico de Desenvolvimento

Registro das mudanças e decisões, para retomar o contexto em qualquer notebook (o projeto é
desenvolvido em dois computadores, sincronizados via GitHub). Complementa o [`CLAUDE.md`](../CLAUDE.md).

> Ordem cronológica inversa dentro de cada data. "Aplicada" = migração já rodada no banco de produção.

---

## Como trabalhar neste repo (resumo operacional)

- **Deploy:** `git push origin master` dispara o deploy de produção na Vercel.
- **Type-check:** `node_modules/.bin/tsc --noEmit -p tsconfig.json` (exit 0 = ok). Principal gate,
  já que o app não roda localmente sem `.env` (as variáveis ficam na Vercel).
- **Migrações:** SQL em `supabase/migrations/`, aplicadas à mão com
  `SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs <arquivo>.sql <versao>`.
  Aplique migrações **aditivas antes** do push (não quebram o código antigo durante o build).
- **Schema:** `prisma/schema.prisma` é só documentação; a verdade são as migrações SQL + o banco.

---

## Sessão de 2026-07-30 — reCAPTCHA advisory na candidatura pública

**Bug:** candidato real (iPhone/4G) foi barrado no formulário público de vaga com
*"Falha na verificação de segurança. Recarregue a página e tente novamente."* — falso-positivo
clássico do **reCAPTCHA v3** em mobile. A mensagem vem de `POST /api/applications`, único ponto
que rejeitava a inscrição. O v3 devolve um **score probabilístico** (não pass/fail) e barrava
humanos de 3 formas: (1) iOS com Prevenção de Rastreamento do Safari / content blocker bloqueia
o script → token nunca gerado → `missing_token`; (2) score de celular abaixo do limiar de 0,5 →
`low_score`; (3) em 4G lento o token expira (~2 min) durante o upload do currículo →
`timeout-or-duplicate`.

**Correção — reCAPTCHA virou ADVISORY (sinal, não portão):**
- `src/lib/recaptcha.ts`: `verifyRecaptcha` só retorna `ok:false` para **bot evidente** = token
  válido + score < `RECAPTCHA_BLOCK_SCORE` (0,3). Token ausente/expirado/inválido e falha de rede
  passam (`ok:true` com `reason`). Removido o antigo `RECAPTCHA_MIN_SCORE=0,5` que bloqueava.
- `src/app/api/applications/route.ts`: mantém o 400 só para bot evidente; loga `console.info`
  (`[applications] recaptcha advisory`) nos casos que passaram com sinal fraco, para telemetria.
- `src/components/public/ApplicationForm.tsx`: em erro de carregamento do script, reseta
  `recaptchaLoading = null` (não deixa a Promise rejeitada em cache → permite retry sem recarregar).

**Racional:** perder candidato real > barrar spam. Anti-abuso real = rate-limit 5/min por IP +
revisão manual no Kanban. Para reapertar no futuro: subir `RECAPTCHA_BLOCK_SCORE` e/ou voltar a
bloquear `missing_token`. Type-check OK. Sem migração de banco (só código) → push em `master`
dispara deploy de produção.

## Sessão de 2026-07-25 — Refatoração de UI do painel (4 Épicos)

Refatoração ampla da interface do painel RH focada em **usabilidade, densidade para 1080p**
(viewport útil ~900px), padronização e acessibilidade. Plano completo em
`~/.claude/plans/atue-como-um-engenheiro-floofy-whale.md` (4 épicos). **Execução em 2 partes:**
Épicos 1-2 concluídos e no ar (commit `3b0dddc`); **Épicos 3-4 PENDENTES**.

Decisões alinhadas com o usuário (via AskUserQuestion): (1) criar PageHeader compartilhado;
(2) densidade incluindo a moldura global; (3) alça de arraste do Kanban sempre visível esmaecida;
(4) rebalancear **toda** a paleta de tags num padrão único AA.

### Épico 1 — Layout/viewport (FEITO, commit `3b0dddc`)
- **Novo `PageHeader`** (`src/components/internal/PageHeader.tsx`): título responsivo
  (`text-xl md:text-2xl`), subtítulo opcional e slot `action` no topo-direito; `mb-4` (era `mb-6`).
  Adotado em dashboard, `vagas/gerenciar`, `admissoes`, `admissoes/kanban`, `usuarios`,
  `configuracoes` e `avaliacoes/TemplateBancoList`.
- **Novo `PrimaryActionLink`** (`.../PrimaryActionLink.tsx`): botão verde de criar padronizado
  (unifica o `rounded-full py-2.5` de Admissões e o `rounded-lg py-2` de Vagas).
- **KPIs achatados ~25%**: `DashboardCard` e os cards inline do dashboard — `p-4→p-3`,
  ícone `36→32px` (`h-9→h-8`, ícone interno `h-5→h-4`), valor `text-2xl→text-xl`, `mt-3→mt-2`;
  grids de KPI `mb-6→mb-4` e gaps unificados em `gap-3`.
- **Moldura global**: `InternalShell` `main p-6 → p-4 md:p-5`; barra sticky do `JobsExplorer`
  mais rasa (`mb-4→mb-3`, `pb-3→pb-2`, `mb-3→mb-2`). Header segue `h-14` (evita cascata no `top-14`).

### Épico 2 — Sidebar (FEITO, commit `3b0dddc`)
- **Remove "Nova Vaga"** do menu lateral (`InternalSidebar.tsx`): a ação vive só no header de
  Vagas e no atalho do Dashboard. `adminLinks` virou `systemLinks` (Usuários, Configurações).
- **Separador + rótulo "Sistema"** isolando a navegação operacional (Dashboard, Vagas, Avaliações,
  Admissões) do bloco de gestão + conta. Rótulo só aparece p/ ADMIN_RH; divider sempre.

### Épico 3 — Cards do Kanban e listas (PENDENTE)
Nome da entidade em `font-semibold`; agrupar metadados inline (admissão: cargo+empresa numa linha,
responsável+data noutra); **alça de arraste sempre visível esmaecida** (`kanban-dnd.tsx`, handle já
existe — só subir `text-gray-300→400`); fonte secundária maior nas listas (`JobsExplorer`,
`AdmissionsExplorer`). Interfaces `KanbanJob/Application/Admission` reaproveitam dados existentes
(sem props novas; **sem `any`**).

### Épico 4 — Acessibilidade e micro-interações (PENDENTE)
Rebalancear paleta de tags em `src/lib/utils.ts` para padrão `bg-{cor}-100 text-{cor}-800`
(≥4.5:1); novo `StatusBadge.tsx`; corrigir `StageBadge` dinâmico (texto neutro escuro sobre
`cor@12%` + bolinha na cor); **empty state educativo** nas colunas do Kanban (`KanbanBoardShell`
ganha prop `emptyHint`; ex.: "Arraste candidatos para esta etapa").

---

## Sessão de 2026-07-24

Foco: **estabilidade do formulário de admissão digital no celular**, **ajuste do filtro de Vagas** e
**correções de UX do Kanban/checklist** (ordenação, drag-and-drop de tarefas, contraste).
Tudo commitado em `master` e em produção. Sem migrações.

### 1. Estabilidade do formulário de admissão no mobile — commit `e1cb9f0`
Candidato relatou instabilidade ao abrir/enviar documentos pelo celular. **Causa raiz:** o upload vai
`navegador → rota serverless /api/admissao/[token]/upload → Supabase Storage`, e a **Vercel rejeita
corpos de requisição acima de ~4,5 MB** — mas o form anunciava 10 MB. Fotos de documento no celular têm
3–8 MB → **413 intermitente** (aparecia como "erro de conexão"). Só no mobile, porque no desktop anexam PDFs menores.
- **Compressão de imagem no cliente** (novo `src/lib/admissao/image-compress.ts`): canvas, máx 1600px, JPEG q80,
  antes do upload. Resolve o limite de 4,5 MB **e converte HEIC do iPhone para JPEG** de brinde (o iOS decodifica
  HEIC ao desenhar no canvas). PDFs/DOC passam sem alteração. Guarda de segurança `MAX_UPLOAD_BYTES = 4 MB` no cliente.
- **Fim do zoom automático do iOS:** inputs do form em `text-base` (16px) — abaixo de 16px o Safari dá zoom ao focar,
  deixando a tela "pulando". Também adicionado `export const viewport` no root `layout.tsx`.
- `accept="image/*,.pdf,.doc,.docx,.heic,.heif"` (amigável a câmera/galeria) e textos de tamanho realistas.
- **Extras (mesmo commit):** validação de **CPF com dígitos verificadores** (`isValidCpf`); data de nascimento
  formatada `dd/mm/aaaa` na confirmação; **rótulo da etapa no StepBar** ("Passo X de N · Nome"); **timeout de rede**
  (`fetchWithTimeout`, 60s upload / 30s submit) evitando spinner infinito no 4G; **limpeza de anexos órfãos** no
  submit — o cliente manda `abandonedAttachmentIds` (docs que deixaram de ser exigidos após mudar uma resposta) e a
  rota `submit` apaga do Storage + banco, restrito à própria admissão.
- **Regra geral (importante):** todo upload que passa por rota serverless da Vercel tem teto de ~4,5 MB. Para
  arquivos maiores, comprimir no cliente **ou** subir direto ao Storage via signed URL.

### 2. Filtro de Vagas: oculta encerradas na Lista + conceito de "vagas ativas" — commit `df6b9ef`
No **modo Lista**, o filtro padrão passa a **ocultar Finalizadas (FILLED) e Canceladas (CLOSED)**. Pausadas e
Rascunhos **seguem visíveis** (decisão do usuário: ocultar só concluídas/canceladas). Status específico
(inclui Finalizada/Cancelada) continua acessível ao escolher no filtro. Kanban, Dashboard e portal público **inalterados**.
- Novas constantes em `src/lib/utils.ts` (régua única): `ACTIVE_JOB_STATUSES` = `DRAFT, ACTIVE, SCREENING, INTERVIEW,
  ADMISSION` (**inclui Rascunho** — distinto de `PUBLIC_JOB_STATUSES`, que é visibilidade no portal e exclui Rascunho);
  `TERMINAL_JOB_STATUSES` = `CLOSED, FILLED`; helpers `isActiveJobStatus` / `isTerminalJobStatus`; sentinela de filtro
  `ACTIVE_STATUS_FILTER = "ATIVAS"`.
- **Nova opção no filtro de status:** "Ativas (em andamento)" (`FilterBar.tsx`) = as 5 etapas ativas (sem Pausada).
- Lógica em `JobsExplorer.tsx`: status vazio → oculta terminais; `ATIVAS` → só as ativas; status específico → exato.
- **Decisão registrada:** o Dashboard **não** foi alterado — o card "Vagas Ativas" de lá conta `PUBLIC_JOB_STATUSES`
  (sem Rascunho, que tem card próprio); manter a semântica existente.

### 3. Ordenação do Kanban, DnD de tarefas no checklist e contraste — commit `576533c`
Três ajustes de UX, sem migração. Todos em `master`/produção.
- **"Ordenar" não funcionava na visão Kanban de Vagas.** Causa raiz: `KanbanBoardShell` fazia
  `useState(initialItems)` — snapshot na 1ª renderização que **nunca ressincronizava**. Ao trocar a ordenação
  (que reordena o array do pai), o quadro seguia com a ordem antiga. Agora o quadro **deriva** os cards de
  `initialItems` (já ordenado/filtrado pelo pai) e aplica **por cima** os movimentos/exclusões otimistas via
  `overrides`/`deletedIds` (`useMemo`). Efeito: ordenar atualiza na hora **e** um card recém-arrastado não volta ao
  reordenar. Beneficia os 3 quadros (vagas, candidatos, admissões).
- **Arrastar tarefas no checklist de admissões** (`AdmissionChecklist.tsx`), no lugar das setas ↑↓ de 1 em 1.
  Drag-and-drop **nativo HTML5** (mesma convenção do `TemplateEditor`): alça (grip) que aparece no hover, só quando
  há mais de 1 irmão; alvo do drop realça em verde. Vale para itens de topo (dentro do grupo) e subtarefas (dentro
  da mãe) — o reordenamento é **restrito a irmãos do mesmo escopo**. Grupos continuam com setas (fora do pedido).
  Nova server action `reorderChecklistItems(admissionId, orderedIds)` em `src/lib/admissao/actions.ts`: grava
  `sortOrder = posição` e valida que todos os ids são irmãos (mesmo `groupId` e `parentId`). A antiga
  `moveChecklistItem` (up/down) permanece exportada, mas não é mais usada pela UI de admissões.
- **Contraste do Kanban muito claro/"quase ilegível".** No casco compartilhado (`KanbanBoardShell` + `kanban-dnd`):
  colunas `bg-gray-100 → bg-gray-200`, bordas `gray-200 → gray-300`, badge de contagem e texto de estado-vazio mais
  escuros, e os **dots de etapa** um pouco maiores com `ring-1 ring-black/10` (para cores pálidas ficarem visíveis).
  Dot de "Sem etapa" `#cbd5e1 → #94a3b8`. Como o casco é compartilhado, o ajuste vale para os 3 quadros.

---

## Sessão de 2026-07-22

Foco: melhorias nos **modelos de checklist** e no **checklist das admissões**, mais um ajuste de UI.
Todas as features abaixo foram commitadas em `master` e já estão em produção.

### 1. Duplicar e reordenar modelos + subtarefas nas admissões — commit `3b5b266`
Migração **`20260722000003_template_sort_order.sql`** (aplicada): coluna `sortOrder` em
`admission_checklist_templates` (backfill pela ordem alfabética).
- **Duplicar modelo** inteiro (cabeçalho + grupos + itens): action `duplicateTemplate`.
- **Reordenar modelos** por drag-and-drop nativo na lista lateral: action `reorderTemplates`,
  componente `TemplateList.tsx`.
- **Recolher subtarefas** de uma tarefa-mãe por uma seta (estado local `collapsedItems`).
- **Check da mãe cascateia** "concluído" para todas as subtarefas; ao mudar uma subtarefa, a mãe
  ressincroniza. Actions `setChecklistItemDone` + helper `syncParentStatus` em `src/lib/admissao/actions.ts`.
  O "check"/tachado da mãe é derivado das subtarefas (robusto a condições de corrida).

### 2. Duplicar seção e mover seção entre modelos — commit `b1b29ca`
Sem migração.
- **Duplicar seção** (grupo + itens) dentro do modelo: action `duplicateTemplateGroup`.
- **Mover seção para outro modelo** arrastando a "grip" da seção até uma linha da lista lateral:
  action `moveTemplateGroupToTemplate` (só reaponta o `templateId` do grupo — os itens seguem).
  Drag-and-drop nativo via `dataTransfer` com MIME dedicado (`src/lib/admissao/template-dnd.ts`).
  O modelo de origem (selecionado) é bloqueado como destino.

### 3. Editar/mover itens, modelos multi-cargo e subtarefas nos modelos — commit `a755999`
Migrações **`20260722000004_template_positions.sql`** e **`20260722000005_template_subtasks.sql`** (aplicadas).
- **Editar (renomear) e mover (↑↓) itens** do checklist, em **modelos e admissões**.
  `updateChecklistItem` passou a aceitar `{ name }`; novas `renameTemplateItem` / `moveTemplateItem`.
- **Modelos aplicáveis a VÁRIOS cargos (N:N):** tabela de junção `admission_template_positions`
  (`templateId`, `positionId`). Multi-select de cargos no criar/editar (`PositionMultiSelect.tsx`);
  a lista mostra os cargos (ou "Todos os cargos" quando vazio). A coluna antiga
  `admission_checklist_templates.positionId` foi **mantida como legado** (migração aditiva, segura no deploy),
  mas o app passou a usar a junção como fonte de verdade.
- **Subtarefas nos modelos** (1 nível, igual às admissões): coluna `parentId` em
  `admission_template_items`. Adicionar/renomear/mover/excluir subtarefa no editor.
  Duplicar seção, duplicar modelo e **aplicar modelo na admissão** (`instantiateChecklistFromTemplate`)
  preservam a hierarquia mãe→subtarefas (padrão "idMap": cria os pais, depois as filhas).

### 4. Quebra de linha nos nomes de item — commit `df35592`
Sem migração (só UI).
- **Admissões:** nome do item passou de `truncate` (cortava com "…") para `break-words` (quebra linha).
- **Modelos:** nome do item deixou de ser `<input>` de linha única e virou um **textarea que cresce**
  em altura (`ItemNameTextarea` em `TemplateEditor.tsx`); Enter salva, Shift+Enter quebra, Esc cancela.

### 5. Marcador "pizza" de progresso das subtarefas — commit `7035c37`
Sem migração (só UI). Componente compartilhado `src/components/internal/admissao/SubtaskProgress.tsx`:
uma fatia de pizza (SVG) que se preenche conforme as subtarefas concluem, ao lado do contador
`concluídas/total` (ex.: 1/4). Aparece apenas em itens-mãe (que têm subtarefas).
- **Admissões:** preenche com base nas subtarefas com status `DONE` (progresso real).
- **Modelos:** templates não têm execução, então mostra `0/N` (indica só quantas subtarefas o item tem).

---

## Modelo de dados — checklists (referência rápida)

**Modelos (templates), aplicados a novas admissões:**
- `admission_checklist_templates` — `id, name, description, positionId (LEGADO), isDefault, active, sortOrder, createdById, ...`
- `admission_template_positions` — junção N:N: `templateId, positionId` (PK composta). Cargos do modelo.
- `admission_template_groups` — seções: `id, templateId, name, sortOrder`
- `admission_template_items` — itens: `id, groupId, parentId (subtarefa), name, description, sortOrder, defaultDaysFromStart`

**Checklist dentro de uma admissão** (instanciado a partir de um modelo, ou manual):
- `admission_checklist_groups` — `id, admissionId, name, sortOrder`
- `admission_checklist_items` — `id, admissionId, groupId, parentId (subtarefa), name, status, dueDate, completedAt, completedById, sortOrder`
  - `status`: `PENDING | IN_PROGRESS | DONE | NOT_APPLICABLE`. Progresso conta só as folhas (itens sem subtarefa).

Arquivos-chave: `src/app/(internal)/admissoes/configuracoes/modelos/page.tsx`,
`src/components/internal/admissao/{TemplateEditor,TemplateList,NewTemplateForm,PositionMultiSelect,AdmissionChecklist}.tsx`,
`src/lib/admissao/{template-actions,actions,checklist}.ts`.

---

## Módulo de Avaliações / Testes

### Fase 1 — Banco de Testes (FEITO)
Tabela `assessment_templates` (migração `20260722000001_assessment_templates.sql`):
- `kind`: `SCREENING | TECHNICAL | PERSONALITY_BIG5`; `subtype` (PORTUGUESE/EXCEL/CUSTOM); `questions` (jsonb);
  `passingScore`, `instructions` (mostrada ao candidato na Fase 2), `estimatedMin`, `isActive`.
- Tipos de questão: `MULTIPLE_CHOICE | TRUE_FALSE | SHORT_TEXT | SCALE_LIKERT`. Big Five por dimensão (O,C,E,A,N).
- Repositório pronto (`src/lib/avaliacoes/repository.ts`): IPIP-50 (Big Five), Português básico/intermediário,
  Excel básico/intermediário.
- UI: `src/app/(internal)/avaliacoes/banco/**`, componentes `src/components/internal/avaliacoes/**`
  (inclui geração de questões por IA via `@anthropic-ai/sdk`).
- Ponte com o funil: uma etapa de tipo **TEST** no Kanban de candidatos vincula-se a um template (commit `75e6f72`).

### Fase 2 — Fluxo de sessão/candidato (PENDENTE — próximo passo)
Definida em comentário na própria migração da Fase 1: *"O fluxo de sessão/candidato vem na Fase 2."*
Escopo previsto (a implementar):
1. Tabela(s) de **sessão de avaliação** por candidato/vaga + **respostas**.
2. Página do candidato para **responder o teste**, provavelmente por **token** (espelhar
   `src/app/admissao/[token]` + `src/app/api/admissao/[token]/**`, que já fazem isso na admissão digital).
3. **Pontuação automática**: gabarito/`passingScore` para SCREENING/TECHNICAL; escore por dimensão no Big Five.
4. Exibir resultado na ficha do candidato / no card do funil.

⚠️ Ponto de decisão: já existe `application_assessments` (migração `20260721000002`, "Fase 3" das vagas —
registro **manual** de entrevistas/testes na ficha do candidato, com `source` HUMAN/AI). Definir se a Fase 2
reaproveita essa tabela ou cria uma trilha própria de sessões automatizadas.

---

## Segurança
- A `SUPABASE_DB_URL` (acesso total ao Postgres de produção) foi compartilhada em texto puro durante o
  desenvolvimento e usada para aplicar migrações. **Recomendado rotacionar a senha do Postgres no Supabase.**
- Nunca commitar segredos: variáveis de ambiente ficam na Vercel; localmente use `.env.local` (git-ignored).
