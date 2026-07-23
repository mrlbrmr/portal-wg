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
