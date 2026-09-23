# Histórico de Desenvolvimento

Registro das mudanças e decisões, para retomar o contexto em qualquer notebook (o projeto é
desenvolvido em dois computadores, sincronizados via GitHub). Complementa o [`CLAUDE.md`](../CLAUDE.md).

> Ordem cronológica inversa dentro de cada data. "Aplicada" = migração já rodada no banco de produção.

---

## Sessão de 2026-09-23 (madrugada) — Calendário, Relatórios, Atividades e Usuários reformulados

Sem migração. Reformulação de UX/UI das quatro páginas + registro de eventos que faltavam.

- **Padrão de página:** `PageContainer` (1480px, gap 20px) + `PageHeader` com `icon`. Peças novas em
  `src/components/ui/`: `FilterControls` (busca, select com prefixo, `FilterBar` que recolhe em telas
  pequenas — promovidos de `avaliacoes/ui.tsx`, que reexporta), `table.ts`, `SideDrawer` + `DetailList`,
  `MetricCard` (comparação só com base válida), `UserAvatar`, `charts.tsx` (`ColumnChart`, `BarList`).
- **Calendário** (`/admissoes/calendario`): Mês | Semana | Lista, filtros (empresa, filial, tipo, responsável)
  e estado na URL, resumo de hoje (ou "próximo evento"), drawer com ações compatíveis (abrir, reagendar ASO).
  Regras puras em `src/lib/admissao/calendar.ts` (testado). Tipo "Prazo do formulário" = vencimento do link
  digital não preenchido. **Vencimento de experiência está estruturado mas DESLIGADO**
  (`EXPERIENCE_CHECKPOINT_DAYS = null`) até o RH definir os marcos (ex.: `[45, 90]`). Sem horário: o banco
  só guarda datas.
- **Relatórios** (`/admissoes/relatorios`): filtros globais na URL (período = data de abertura, empresa,
  filial, cargo, responsável, situação), aplicados também no **Exportar Excel** (`/api/admissoes/export`
  aceita os mesmos parâmetros; sem parâmetros exporta tudo). 6 indicadores reais, gráfico de colunas,
  distribuições e "Atenção necessária" com links para os filtros da lista. Regras em
  `src/lib/admissao/reports.ts` (testado). Comparação com período anterior só aparece quando o sistema
  tinha dados em toda a janela anterior. **Não exibidos:** tempo médio e "dentro do prazo" (dependem do
  histórico de etapas, que começou a ser gravado agora, e de `ADMISSION_TARGET_DAYS`).
- **Atividades** (rota mantida `/admissoes/historico`; menu renomeado): feed unificado de
  `admissions` (criação), `admission_activity_log`, `job_request_history`, `job_events` (sem
  POSITIONS_MIGRATED), `job_status_history`, `application_stage_history` e `config_change_log`. Busca, filtros
  no banco e paginação por cursor (timestamp em µs + ids do mesmo instante; validado em produção: 436
  eventos, páginas de 7 = consulta única, sem duplicata). Catálogo de tipos em `src/lib/activity/catalog.ts`
  (para um evento novo aparecer: gravar `action` e mapear em `ADMISSION_LOG_ACTIONS`).
- **Eventos que passaram a ser gravados** (`src/lib/activity/log.ts`, nunca bloqueiam a operação):
  etapa alterada / admissão concluída (Kanban e edição, com de→para), ASO atualizado, admissão editada
  (campos de→para), excluída, link do formulário gerado, formulário enviado pelo candidato, usuário
  criado/editado/perfil alterado/desativado/reativado/excluído (`entity = USER`).
- **Usuários:** tabela com perfil, permissões adicionais, status, último acesso (`auth.users.last_sign_in_at`)
  e menu "…" (editar, alterar perfil, desativar/reativar). Troca de perfil em 2 passos com o que a pessoa
  ganha/perde. Catálogo de perfis/permissões em `src/lib/access/roles.ts` (ROLE + permissões adicionais;
  Analista RH e Aprovador descritos mas **não atribuíveis** — exigem enum + funções nas policies RLS).
- **Correções de backend:** `PATCH /api/users/[id]` agora grava `isApprover` (era validado e descartado) e
  **desativar passa a bloquear o login** (`ban_duration` no Supabase Auth; antes `users.active` era só
  visual). Nenhum usuário estava desativado, então não houve correção retroativa.

---

## Sessão de 2026-09-23 (noite) — Página da vaga reformulada + Posições da vaga

Migração **aplicada** (aditiva): `20260923200000_job_positions.sql`.

- **Conceito:** vaga = processo seletivo; **posição** = cada contratação dentro dele
  (`Solicitação → aprovação → Vaga → Posições #01..#N → contratados`). Nunca uma vaga por posição, nunca
  pipeline por posição: descrição, candidatos e funil são da vaga.
- **Banco:** `job_positions` (OPEN | FILLED | CANCELLED, candidatura/admissão que ocupa, snapshot do nome) e
  `job_events` (linha do tempo: criação, posições, alterações de campos, migração). Status continua em
  `job_status_history`. `jobs.openings` (total ativo) e `jobs.openPositions` (em aberto) são **derivados por
  trigger** — feeds/export/portal seguem lendo `openings`. Toda mutação por função com `for update`:
  `job_position_add | _cancel | _fill | _release` (regras: posição ocupada não recebe outro; candidato não ocupa
  duas; vaga específica mantém ≥1 posição; cancelar/liberar nunca apaga). Trigger cria #01..#N em QUALQUER
  criação de vaga (solicitação, "Nova vaga", duplicar); banco de talentos não tem posições.
- **Solicitação → vaga:** `create_job_from_request()` agora grava `openings` = quantidade aprovada (mín. 1) e
  `jobs.approvedScope` (snapshot do escopo aprovado — a solicitação pode ser reeditada depois; o snapshot não) +
  evento JOB_CREATED com a REQ. Comparação aprovado × atual em `src/lib/jobs/approved-scope.ts`.
- **Backfill:** 28 vagas → 28 posições; 14 preenchidas por inferência (candidaturas em etapa WON/ADMISSION, na
  ordem em que entraram na etapa, até o limite de posições; admissão ligada por `sourceApplicationId`). Onde não
  dava para inferir (ex.: VAG-0019 encerrada sem contratado, VAG-0009 com 2 posições e 1 contratado) a posição
  ficou em aberto — nada foi inventado. `updatedAt` das vagas não foi tocado.
- **Contratação:** o modal do pipeline ("Contratar …", antigo "Iniciar admissão") pede a posição; `POST
  /api/admissoes` com `jobPositionId` preenche via `job_position_fill` e desfaz a admissão (soft delete) se a
  posição foi ocupada no meio do caminho. Posições sem modal (contratados antigos, etapa sem automação):
  "Vincular contratado" no card. Desistência: "Liberar posição" (motivo obrigatório; admissão não é apagada).
  Todas preenchidas + vaga publicada → oferece "Encerrar vaga" / "Manter publicada" (nunca encerra sozinho).
- **Página `/vagas/[id]/editar`:** cabeçalho fixo (compacta ao rolar) + abas com deep-link `?tab=`
  (`visao | descricao | processo | divulgacao | historico`, em `src/lib/jobs/tabs.ts`), 2 colunas (main + resumo).
  Rascunho controlado único (trocar de aba não perde nada), aviso de saída, Ctrl+S, confirmação ao alterar campo
  do escopo aprovado (motivo vai para o histórico). Componentes em `src/components/internal/job/`; "Nova vaga"
  usa os mesmos campos (`JobFields.tsx`).
- **Salário:** valor interno × divulgação separados (`jobs.salaryPublic`); `salaryRange` (o que portal/feeds
  leem) passou a ser DERIVADO em `src/lib/jobs/salary.ts`. Corrige bug antigo: o salário numérico nunca aparecia
  no portal.
- **Privacidade:** portal e GETs públicos não usam mais `select("*")` — `PUBLIC_JOB_COLUMNS` em
  `src/lib/jobs-query.ts` (antes o salário interno, recrutador e gestor iam no payload público).
- **Inscrições:** a API de candidatura também recusa depois de `closingDate` (antes só a página escondia).
- **Testes:** `src/lib/jobs/*.test.ts` (regras puras) e `npm run test:db` (cenários 1–10 contra o banco, em
  transação com ROLLBACK; com o arquivo da migração como 2º argumento valida também o backfill).
- **Rótulos:** "Quantidade de vagas" → "Número de posições" (solicitação, detalhe, e-mail, regras críticas).

---

## Sessão de 2026-09-23 (tarde) — Banco de Talentos vira CRM de talentos

Migrações **aplicadas** (todas aditivas): `20260923180000_talent_crm.sql`, `20260923180001_talent_crm_facets.sql`,
`20260923180002_talent_crm_location_keys.sql`.

- **Modelo:** o perfil (`talentos`) continua sendo 1 → N candidaturas (`applications.talentoId`). Adicionar à vaga
  cria só a candidatura (origem `BANCO_TALENTOS`), nunca outro talento; duplicidade na vaga é checada por talento,
  e-mail e CPF. Regra em `src/lib/talentos/service.ts#addTalentsToJob` (também usada pela rota `from-talento`).
- **Situação do talento ≠ etapa da candidatura.** View `talentos_crm` calcula: Arquivado (manual) › Em processo
  (candidatura em etapa OPEN/TEST/ADMISSION de vaga não encerrada) › Contratado (etapa WON) › Indisponível (manual)
  › Disponível. O RH só edita Disponível/Indisponível e Arquivar/Restaurar; `statusBanco` deixou de receber
  EM_PROCESSO/CONTRATADO (valores antigos seguem aceitos pelo CHECK).
- **Listagem no servidor:** busca (sem acento; nome, e-mail, telefone, cargo, tags, vagas, habilidades do CV),
  filtros (situação, tags com todas, UF, cidade normalizada, cargo, área, origem, vaga anterior, etapa alcançada,
  datas, avaliação), ordenação e paginação pela view; opções e indicadores pela RPC `talentos_crm_facets()`.
  Estado na URL. Regras puras em `src/lib/talentos/crm.ts` (testadas).
- **Tags:** o banco passou a usar o cadastro central (`admission_tags`) via `talento_tag_links`; índice único
  em `lower(btrim(name))` (Excel = excel). `talento_tags`/`talento_tag_assignments` ficaram sem uso (vazias) —
  remover numa limpeza futura. Cadastros › Tags conta o uso em talentos.
- **CRM:** favorito do perfil (compartilhado pela equipe), segmentos salvos (`talento_segments` guarda FILTROS),
  anotações com autor/edição pelo autor (RLS), histórico de ações em `talento_audit_log` (equipe vê as ações de
  CRM; acessos seguem só para admin). "Última atividade" mantida por triggers (candidatura, etapa, anotação,
  avaliação concluída) + edição/status no app; abrir o perfil não conta.
- **Drawer + perfil completo:** `TalentWorkspace` (Resumo · Histórico · Avaliações · Anotações · Arquivos, só as
  abas com conteúdo) usado nos dois. Linha do tempo só com eventos reais (`timeline.ts`, testado).
  "Abrir candidatura" usa `/vagas/[id]/candidatos?candidato=<id>` (abre o Quick View).
- **Bugs corrigidos:** notas do perfil consultavam coluna inexistente (`autorNome`); "Baixar CV" usava o caminho
  interno do storage (agora `/api/talentos/[id]/resume`, URL assinada); log de acesso nunca era gravado (faltava
  await); `ultimaAtividadeEm` não mudava com novas candidaturas; link de reaplicar teste apontava para `/teste/`
  (a página é `/avaliacao/`); invalidar teste falhava para sessões ligadas só pela candidatura; aba de testes
  mostrava "Score" no Big Five.
- **Pendente:** validação visual logada (o navegador de preview não tem sessão).

## Sessão de 2026-09-23 — Reformulação da área de Configurações

Migração `20260923120000_settings_audit_and_stage_automations.sql` **aplicada** (aditiva: tabela
`config_change_log` + coluna `application_stages.automations jsonb default '{}'`).

- **Padrão único:** `SettingsPage` (breadcrumb "Configurações › …", container 1180px, "Última alteração"),
  `SettingsSaveBar` + `useSettingsDraft` (botão desabilitado sem alterações, "Descartar", Ctrl+S, toast,
  rascunho mantido em erro, confirmação ao sair com alterações), `SortableList` (dnd-kit com teclado e
  anúncios em PT), `Dialog` acessível, `Toggle` com `role="switch"`. Mapa das páginas em `src/lib/settings/registry.ts`.
- **Home** reorganizada: Portal de carreiras · Recrutamento · Admissão · Cadastros · Integrações (até 3 cards por linha).
- **Portal:** Homepage dividida em "Aparência da homepage" e "Exibição das vagas" (`/configuracoes/homepage/vagas`),
  com preview ao vivo usando o próprio `JobCard` público (prop `preview`, vaga de exemplo só no cliente).
- **Funil:** arrastar e soltar (substitui as setas; "Mover para cima/baixo" ficou no menu ⋯), badge de tipo,
  configuração expansível (tipo, teste vinculado, cor, "mostrar como coluna" = `hideFromBoard`), menu Renomear/
  Duplicar/Mover/Excluir. Remover etapa com candidatos exige escolher a etapa de destino (registrado no histórico
  de cada candidato); etapa já usada é desativada, nunca excluída. **Automações** (só as reais): abrir cadastro da
  admissão (Admissão/Contratado, padrão ligado = comportamento anterior) e gerar link do teste vinculado (Teste,
  padrão desligado; o envio ao candidato continua manual — não há e-mail de teste).
- **Solicitação de vaga:** "Campos padrão" (estruturais, recolhível) × "Campos adicionais" com estado vazio, novos
  tipos (múltipla escolha, sim/não), texto de ajuda, arrastar e soltar e regra SE/ENTÃO. "Visualizar como gestor"
  reaproveita `JobRequestIntro` + `JobRequestFormFields`. **Bug corrigido:** campo condicional oculto e obrigatório
  bloqueava o envio público; e a criação interna não validava obrigatórias. Regras em `extra-fields.ts` (testado).
- **Categorias → Cadastros:** uma URL por cadastro, tabela com busca/filtro/paginação e edição em diálogo.
  Exclusão checa o uso (FKs eram SET NULL: excluir um cargo em uso deixava admissões sem cargo em silêncio).
  Etapas da admissão com arrastar e soltar e **etapa de conclusão única** (antes: checkbox em todas as linhas).
  Seletores do ATS passaram a ignorar cadastros inativos.
- **Admissão Digital:** abas Conteúdo · Perguntas · Documentos · Regras · Visualização (`DigitalForm` com
  `preview`). Aviso quando o nome do documento não bate com um tipo de documento (a classificação é pelo nome).
  "Restaurar padrão" com confirmação. `revalidatePath` corrigido (apontava para a rota antiga).
- **LinkedIn:** texto sem jargão técnico e confirmação ao desconectar.

---

## Sessão de 2026-09-22 (noite) — Avaliações: Banco de testes · Aplicações · Resultados

Reestruturação do módulo de Avaliações. Migração `20260922180000_assessment_types.sql` **aplicada**.

- **Tipo da avaliação explícito** (`assessment_templates."assessmentType"` = `TECHNICAL_OBJECTIVE |
  TECHNICAL_MIXED | BEHAVIORAL` + `"gradingMode"` = `AUTO | HYBRID | MANUAL | NONE`). DERIVADOS por trigger
  a partir de `kind` + `questions` (nunca enviados pela app) — não divergem quando alguém acrescenta uma
  dissertativa. Espelho em TS: `classifyTemplate()` / `resolveAssessmentType()` em `src/lib/avaliacoes/schema.ts`.
  A UI decide pelo tipo, nunca pelo nome do teste.
- **Comportamental (Big Five) não tem outcome:** sem nota, aprovação, reprovação ou correção. Trigger em
  `assessment_sessions` zera `outcome` de sessão comportamental (vale até para código antigo). Backfill limpou
  o `PENDING_REVIEW` das 13 sessões Big Five — era isso que fazia o Dashboard mostrar "13 avaliações aguardando
  revisão" (falso alarme).
- **Valor do Big Five NÃO é percentil:** é média das respostas (1–5) ÷ 5 × 100 (faixa 20–100; 60 = neutro), sem
  norma populacional. A UI mostra o número sem "%" e explica a escala. Faixas (`big-five.ts`): < 50 baixa,
  50–69 moderada, ≥ 70 elevada. Textos de interpretação e "pontos para explorar na entrevista" em linguagem
  probabilística, sem score geral/ranking/recomendação.
- **Correção manual de dissertativas** (novo): `POST /api/assessment-sessions/[id]/grade` recalcula a nota final
  com o mesmo `scoreSession()` do envio; grava `gradedAt/gradedBy` e espelha em `application_assessments`.
  Enquanto houver dissertativa sem pontos: `outcome = PENDING_REVIEW` ("Aguardando correção") + resultado parcial.
- **Início do preenchimento:** `POST /api/avaliacao/[token]/start` no 1º item respondido → status "Em andamento"
  e "Tempo de preenchimento". Antes o submit gravava `startedAt = submittedAt` (sessões antigas não têm duração).
- **Telas:** sidebar Avaliações → Banco de testes · **Aplicações** (nova, `/avaliacoes/aplicacoes`) · Resultados.
  Banco: colunas Critério ("≥ 70%" × "Perfil dimensional") e Aplicações, menu ••• (Visualizar, Editar, Duplicar,
  Ver aplicações, Arquivar/Ativar com confirmação). Resultado individual em `/avaliacoes/resultados/[id]`.
- **Vocabulário único** (`src/lib/avaliacoes/presentation.ts`): Kanban, Quick View, Dashboard e as três telas usam
  os mesmos rótulos ("Resultado disponível", "Aguardando correção", "Aprovado no critério", "Abaixo do critério").
- **Bug corrigido:** o PATCH do template descartava `isActive` (o zod removia a chave) — "Desativar" parecia
  funcionar mas não gravava. Agora aceita `isActive`.
- Testes: `src/lib/avaliacoes/avaliacoes.test.ts` (classificação, pontuação/correção, status, faixas Big Five).

## Sessão de 2026-09-22 (tarde) — Polimento do Quick View

Refinamento sem mudar a estrutura (split view, abas, J/K e rodapé mantidos). Sem migração, sem API nova.

- **Rodapé:** removido "Manter" (ficar na etapa já é manter). Esquerda em linhas: etapa · próxima ·
  "Entrou nesta etapa …"; botões truncam nomes longos de etapa (`!shrink`: o `Button` tem `shrink-0`).
- **Bug corrigido — toast sobre o rodapé:** os avisos (`fixed bottom-4`, z acima do painel) cobriam
  "Avançar" por alguns segundos após cada ação. Agora a altura REAL do rodapé é medida
  (ResizeObserver → `--quickview-footer-height`) e `html[data-quickview-open] [data-toast-stack]` sobe
  a pilha. A área rolável é irmã do rodapé (não há sobreposição) e ganhou `pb-8` + `scroll-pb`.
- **Kanban/lista:** card do candidato aberto com faixa verde + fundo + `aria-current`; nome em até 2
  linhas (`line-clamp-2`, nome completo no `title`).
- **Visão geral:** aderência compacta antes/depois da análise (frase descritiva por faixa, chips só
  com critérios ATENDIDOS da análise, "Ver análise completa →"); fatos-chave só com cards preenchidos
  + linha "Não informado: …"; tudo vazio vira uma linha com "Editar dados". Currículo: "Currículo" +
  "PDF · nome.pdf". Contato: "Copiado" no próprio botão (só se a cópia der certo) + WhatsApp via
  `whatsappUrl`.
- **Densidade:** seções sem linhas entre si (`Section` sem borda), listas sem `divide-y`, header sem
  borda própria; J/K discreto (aparece no hover/foco da navegação). Microcopy padronizado.
- **Performance:** `useCandidateWorkspace` guarda cache por candidato (reaparece na hora, revalida em
  segundo plano) e faz prefetch da ficha + avaliações dos vizinhos da fila → J/K sem skeleton.
  Bug evitado no cache: anotações são gravadas por um setter com o id do candidato, não por efeito.

## Sessão de 2026-09-22 — Quick View do candidato (estação de triagem)

Evolução do drawer do candidato (seção abaixo) para um **Quick View** focado em "avançar, manter
ou reprovar?". Continua abrindo sem sair da vaga.

- **Migração `20260922150000_application_notes.sql` — APLICADA.** Tabela `application_notes`
  (autor, data, texto) com RLS: staff lê; ADMIN_RH cria em nome próprio; só o autor edita/exclui.
  Aditiva. `applications.notes` (campo único antigo) continua em uso: aparece como "Anotações
  anteriores" e segue recebendo o motivo de reprovação (regra inalterada).
- **Split view no desktop** (≥ lg, com ≥ 1040px de área de conteúdo): painel com ~60% da área à
  direita, **sem fundo escurecido**; o conteúdo ganha `padding-right` (`html[data-quickview]` +
  `--quickview-width` em `globals.css`, `main[data-internal-main]` no `InternalShell`) e o
  Kanban continua visível e clicável. Abaixo disso, overlay (tela cheia no celular). "Abrir
  perfil completo" expande o painel para toda a área de conteúdo — **não existe rota de perfil
  dedicada ainda**; `FullProfileAction` já aceita `href` para quando existir.
- **Triagem sequencial:** ‹ 1 de 5 › no cabeçalho + atalhos **J/K** (ignorados em campos de texto,
  menus, diálogos e durante arraste por teclado). A fila é congelada ao abrir (`queuePosition` em
  `src/lib/recruitment/candidate-navigation.ts`): avançar/reprovar alguém não embaralha a sequência.
- **Barra de decisão fixa no rodapé:** etapa atual, próxima etapa, "Entrou …" + **Reprovar**
  (diálogo com motivo) · **Manter** (deixa na etapa e abre o próximo — sem estado novo) ·
  **Avançar para X**. Cabeçalho: avatar, nome, vaga · cidade, selos (aderência, Novo, origem),
  "Candidatou-se …", responsável, Contatar ▾, •••.
- **Abas Visão geral · Avaliações · Anotações · Histórico.** Visão geral: aderência (com (i)
  explicando a base), resumo profissional, fatos-chave, competências, pontos fortes/atenção,
  currículo (tipo em destaque, nome físico secundário), contato e detalhes. Avaliações: análise de
  IA estruturada (score, faixa descritiva, critérios da vaga um a um, pontos fortes, lacunas,
  "Ver análise completa"), testes online e avaliações registradas (exclusão agora com confirmação).
- **IA estruturada sem migração:** a rota `/analyze` passa os requisitos obrigatórios da vaga ao
  Gemini e grava `profileSummary` + `criteria` (MEETS/PARTIAL/NOT_FOUND) em
  `application_assessments.metadata` (coluna que já existia). Análises antigas (só texto) são
  lidas por `parseLegacySummary` — critérios aparecem como "Não avaliado" até reanalisar.
  Rótulos descritivos ("Recomendado para análise", "Aderência parcial", "Baixa aderência").
- **Histórico** (`src/lib/recruitment/candidate-timeline.ts`, puro/testado): etapa (origem → destino),
  reprovação, análise de IA, avaliação, entrevista registrada, teste enviado/concluído, anotação.
  Tipos "contato realizado" e "troca de responsável" existem no vocabulário mas não têm fonte de dado.
- Componentes (`src/components/internal/candidate/`): `CandidateQuickView` (orquestra), hook
  `useCandidateWorkspace`, `CandidateHeader`/`FullProfileAction`, `CandidateNavigation`,
  `CandidateStageBar`, `CandidateOverview`, `AiAnalysisPanel`, `CandidateTests`,
  `ManualAssessments`, `CandidateNotes`, `CandidateTimeline`; `ui/InfoHint` (tooltip acessível).
  Removidos: `CandidateDrawer`, `AssessmentsSection`, `TestSessionsSection`, `TeamNotes`,
  `CandidateHistory`, `ScreeningCriteria`. `DialogShell` agora renderiza no `<body>`.
- Validação visual feita em página temporária com fetch simulado (desktop split/expandido, tablet,
  celular). **Validação logada com dados reais ainda pendente.**

## Sessão de 2026-09-21 (tarde) — Drawer do candidato vira workspace de triagem

Redesenho do drawer lateral aberto pelo Kanban da vaga (continua drawer, não virou página).
**Sem migração.** API: só leitura de colunas já existentes + `?download=1` no currículo.

- **Estrutura:** cabeçalho fixo (nome, cargo · cidade/UF, origem, "Candidatou-se há…", "Na etapa
  há…", responsável da VAGA) + bloco "Etapa atual" com CTA explícito ("Avançar para Triagem →"),
  "Contatar ▾" e "•••"; abas **Resumo / Avaliações / Histórico** com UMA área rolável.
- **Regra de etapa** em `src/lib/recruitment/candidate-stage-flow.ts` (puro, testado): progressão
  só pelas etapas visíveis e não-LOST — corrige bug antigo em que "Avançar" a partir da última
  etapa levava a "Pausada" (oculta). Reprovado/pausado ganham "Reabrir/Retomar em <última etapa>".
  Avançar para Admissão pelo drawer passa pelo mesmo `AdmissionLinkModal` do arrastar (antes: beco
  sem saída "Mova pelo Kanban").
- **Reprovação:** saiu do lado do CTA; fica no "•••" com diálogo (motivo obrigatório + observação).
  ⚠️ Não há coluna de motivo: o motivo vai como TEXTO anexado a `applications.notes`
  ("Reprovação em dd/mm/aaaa — Motivo: …"). Relatório por motivo exige coluna própria.
- **Triagem:** lista os requisitos obrigatórios REAIS da vaga (`src/lib/recruitment/screening.ts`
  extrai do HTML da descrição/`requiredRequirements`). Registro "Atende / Não atende" por critério
  **pendente de backend** — `ScreeningCriteria` já aceita `verdicts`/`onEvaluate`.
- **Anotações:** continua 1 campo (`notes`); salvar explícito colado ao campo (Ctrl+Enter), salva
  sozinho ao fechar o drawer se houver rascunho. Histórico de notas por autor = tabela futura.
- **Histórico:** `ActivityTimeline` com criação + `application_stage_history` (eventos reais).
- Componentes novos: `src/components/ui/DropdownMenu.tsx` (menu acessível genérico) e
  `src/components/internal/candidate/*` (Header, ContactMenu, ResumeCard, Summary, EditForm,
  ScreeningCriteria, TeamNotes, History, RejectionDialog, MoveStageDialog, DialogShell, Section).

## Sessão de 2026-09-21 — Profissionalização de Recrutamento e Admissões (Design System + trabalho por exceção)

Evolução da UI existente (sem redesign, sem migração, sem mudança de API). Identidade mantida:
sidebar escura, fundo claro, cards brancos, verde WG.

### Design System (tokens e componentes)
- **Tokens semânticos** no Tailwind: `success / info / warning / danger / neutral` com `bg/fg/border`
  (pares AA). Significado fixo: success=concluído, info=em processamento, warning=aguardando/atenção,
  danger=atrasado/erro, neutral=inativo. **Nenhum status comunica só por cor** (sempre texto).
- **Radius:** `rounded-control` (8px) e `rounded-card` (12px). Corrigido bug antigo: `--radius` nunca
  era definida, então `rounded-lg/md/sm` renderizavam com canto **reto** — agora `--radius: .5rem`.
- **Tipografia:** `text-page-title` (28/semibold), `text-section-title` (18), `text-record-title` (15),
  `text-body` (14), `text-meta` (13), `text-label` (12/medium).
- **Componentes** (`src/components/ui`): `Button`/`ButtonLink`/`buttonVariants` (primary · secondary ·
  tertiary · danger; tamanhos fixos), `StatusBadge` (status = pílula preenchida) × `StageBadge`
  (etapa = chip contornado), `ProgressBar`, `CompactMetrics`, `Panel`, `ActionListItem`,
  `ActivityTimeline` (reutilizável: vaga/candidato/admissão), `FilterPopover` + `ActiveFilterChips` +
  `QuickFilterChips`. Refeitos nos tokens, mesma API: `EmptyState` (+`compact`), `PageHeader`,
  `PrimaryActionLink`, `DashboardCard`, `ConfirmModal` (agora `alertdialog`, Esc, foco seguro),
  `SearchBar`, `SortDropdown`, `Skeleton` (+`SkeletonListItem`, `SkeletonPageTop`).
- Removido o órfão `FilterBar.tsx`. Hook `useSyncQueryString` persiste filtros na URL.

### Status × etapa (sem migração)
`src/lib/recruitment/job-presentation.ts` projeta o enum `JobStatus` (que mistura as duas coisas) em
**status** (Rascunho · Aberta · Pausada · Encerrada · Cancelada) e **etapa** (Triagem · Entrevistas ·
Admissão). `FILLED` passou a se chamar **Encerrada** em todo o sistema (antes "Finalizada").
Links antigos `?status=SCREENING` continuam funcionando (`parseLegacyStatusParam`).

### Atenção e SLA
- `src/lib/recruitment/attention.ts` (puro, testado): motivos explícitos — candidatos aguardando
  triagem, inscrições encerrando/vencidas, nenhum candidato após N dias, sem movimentação há N dias.
  Limiares em `ATTENTION_RULES` (`staleDays` = `STALE_JOB_DAYS` existente; `closingSoonDays` = 7 já
  usado no Dashboard; **`noCandidatesDays = 7` é provisório**). Situação operacional: Normal/Atenção/Atrasada.
- `src/lib/recruitment/sla.ts`: arquitetura pronta, **`RECRUITMENT_SLA_POLICY = null`** (o RH ainda
  não definiu SLA de vaga) — a UI mostra a idade da vaga e só classifica No prazo/Atenção/SLA excedido
  quando a política existir.

### Telas
- **Navegação:** "Visão geral", "Solicitações de vaga", "Vagas", "Banco de talentos", "Avaliações" ·
  Admissões: "Admissões", "Calendário", "Relatórios", "Histórico" · "Administração". Paths inalterados.
- **Visão geral (`/dashboard`):** métricas compactas + **Sua fila de trabalho** (Recrutamento /
  Admissões / Aguardando outras pessoas), **Vagas que precisam de atenção** com o motivo, candidaturas
  recentes e próximas admissões. Cada item leva à tela já filtrada.
- **Vagas:** loader compartilhado `src/lib/recruitment/job-rows.ts` (abertura real via
  `job_status_history`, candidatos novos, última movimentação). Linha com status + etapa, local/área/
  contrato, responsável, "Aberta há X dias", "Atualizada há", candidatos/novos e motivos de atenção.
  Filtros: status, etapa, responsável, área, cidade, com/sem candidatos, período; chips removíveis;
  estado na URL (`?status=OPEN&etapa=…&pendencia=atencao`).
- **Admissões:** loader `src/lib/admissao/overview.ts` (etapa i/N, docs obrigatórios, formulário
  digital). Linha com progresso, pendências, início e última movimentação; filtros rápidos
  `?filtro=atrasadas|proximas|documentos|formulario`.
- **Ficha da admissão:** cabeçalho com progresso + **jornada** (etapas reais configuradas), resumo
  lateral, abas Visão geral · Documentos · Dados cadastrais · Histórico (`?aba=`). Documentos com
  estado por item (`src/lib/admissao/document-status.ts`, usa `aiStatus/aiReason` existentes),
  arrastar-e-soltar, "Fazer upload" por categoria, remoção com confirmação. Admissão digital mostra
  estado, validade real do link, "Copiar link" e "Gerar novo link" (com confirmação — invalida o anterior).

### Depende de backend (não implementado — não inventar dados)
- Aprovação/recusa **manual** de documento pelo RH com motivo e "solicitar novamente" (colunas novas).
- Data de envio do link, histórico de envios e cancelamento de link da admissão digital.
- Agenda de entrevistas ("entrevistas hoje"), SLA configurável, log de mudança de etapa da admissão.
- Tela global de **Candidatos** (hoje candidatos vivem dentro de cada vaga).

---

## Sessão de 2026-09-18 — Fluxo de aprovação da abertura de vaga (Requisição de Pessoal)

Problema: o formulário público `/solicitar-vaga` criava **direto** uma vaga `DRAFT`. Pedido e vaga
eram o mesmo objeto (sem aprovação), a vaga nascia com dados falsos (`isTalentPool=true`,
`modality=PRESENTIAL`, `department` recebendo o *motivo* da abertura) e `jobs.responsible` —
documentado como *recrutador* — guardava o nome do **gestor**.

Agora a **Requisição de Pessoal (RP)** é um objeto próprio com ciclo de aprovação; a vaga só nasce
quando o RH aprova e completa os dados. Aprovação em **um nível** (ADMIN_RH).

### 1. Migração — `20260918000000_job_requests_workflow.sql` (APLICADA)

- `enum JobRequestStatus`: `SUBMITTED → IN_REVIEW → APPROVED | RETURNED | REJECTED | CANCELLED`.
- `job_requests` ganha colunas derivadas (`status`, `title`, `requester_name`, `requester_email`,
  `reason`, `location`, `openings`, `priority`, `desired_start_date`) + decisão (`decision_note`,
  `decided_by`, `decided_at`) + `updated_at` com trigger `moddatetime`. `form_data` segue sendo a
  fonte do que o gestor digitou.
- `jobs` ganha **`hiringManager`** (gestor solicitante) e **`requestId`** (FK → `job_requests`).
- Backfill: as 7 requisições antigas viraram `APPROVED` (já tinham vaga); 7 vagas foram religadas à
  sua RP e, nas 3 em que `responsible` guardava o nome do gestor, o valor migrou para `hiringManager`.
- O singleton `job_request_form_config` recebeu os campos novos sem perder customizações
  (`emailGestor` logo após `gestor`; `quantidade`, `tipoContratacao`, `dataInicio`,
  `salarioPretendido`, `dataDesligamento` no fim — reordenáveis pelo editor).

### 2. Fluxo

1. Gestor envia em `/solicitar-vaga` → `POST /api/job-requests` grava a RP como `SUBMITTED`
   (**não cria mais vaga**) e notifica o RH por e-mail.
2. RH vê a fila em **`/vagas/solicitacoes`** (badge no menu + KPI no dashboard quando há pendências).
3. Ações: *Assumir análise* · *Devolver para ajustes* · *Reprovar* · *Cancelar* — motivo obrigatório
   em devolução/reprovação, enviado ao gestor por e-mail e gravado em `decision_note`.
4. *Aprovar e abrir vaga* marca a RP como `APPROVED` e leva a `/vagas/nova?request=<id>` com o
   `JobForm` **pré-preenchido** (título, unidade, posições, tipo de contratação, jornada, gestor,
   prazo) e status default `DRAFT`. Ao salvar, `POST /api/jobs` grava `requestId` e fecha o ciclo
   setando `job_requests.job_id`.
- SLA de primeira resposta: 2 dias (`JOB_REQUEST_SLA_DAYS`); RP parada além disso ganha destaque.

### 3. E-mail (Resend) — camada nova

Antes o envio estava inline no route de solicitação e **nunca rodava** (faltavam `RESEND_API_KEY` e
`RESEND_FROM_EMAIL` no ambiente). Agora: `src/lib/email.ts` (client + guarda de env — sem chave, só
loga e devolve `{sent:false}`, nada quebra) e `src/lib/email-templates.ts` (aviso ao RH + um
template por decisão). Configuração e verificação de domínio: ver `INSTALACAO.md`.

### 4. Arquivos-chave

`src/lib/job-requests/{actions,mapping}.ts` · `src/types/job-requests.ts` ·
`src/app/(internal)/vagas/solicitacoes/page.tsx` · `src/components/internal/JobRequestsExplorer.tsx` ·
`src/lib/{email,email-templates}.ts` · `src/app/api/job-requests/route.ts` ·
`src/components/internal/JobForm.tsx` (campos *Responsável pelo processo (recrutador)* — default =
usuário logado — e *Gestor solicitante*).

### 5. Pendências

- Configurar `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `RH_EMAIL` (local + Vercel) e verificar o
  domínio no Resend — sem isso nenhum e-mail sai.
- Segundo nível de aprovação (diretoria) e link público de acompanhamento por token ficaram fora
  desta fase (decisão do usuário).

---

## Sessão de 2026-08-07 — Banco de Talentos (perfil consolidado + validade de teste)

Foco: implementação completa do **Banco de Talentos** — área interna para gerenciar candidatos
desvinculados de vagas específicas, com deduplicação por CPF/e-mail, histórico de testes com
validade configurável e perfil unificado por abas. Commit `08406cf`.

### 1. Schema SQL — migrações aplicadas

**`supabase/migrations/20260807000000_talentos.sql`**

- `ALTER TABLE assessment_templates ADD COLUMN validityMonths int NOT NULL DEFAULT 12` — validade
  configurável por template (gate da Fase 3).
- `CREATE TABLE talentos` com **colunas geradas** (`GENERATED ALWAYS AS STORED`):
  - `emailNormalizado` = `lower(trim(email))` — chave de dedup por e-mail.
  - `cpfDigits` = `regexp_replace(cpf, '[^0-9]', '', 'g')` — chave de dedup por CPF.
  - Índice único condicional `WHERE cpfDigits <> ''` (ignora nulos/vazios sem violar unicidade).
- `CREATE TABLE talento_tags`, `talento_tag_assignments`, `talento_notes`, `talento_audit_log`.
- `ALTER TABLE applications ADD COLUMN talentoId text REFERENCES talentos(id) ON DELETE SET NULL`.
- `ALTER TABLE assessment_sessions`:
  - `applicationId` torna-se `NULL`-ável (permite convite direto do perfil, sem candidatura).
  - FK recriada como `ON DELETE SET NULL` (era CASCADE — preserva histórico de testes).
  - Novas colunas: `talentoId`, `validoAte`, `invalidadoEm`, `invalidadoPorId`, `motivoInvalidacao`.
- RLS: notas lidas/inseridas por ambos os papéis; exclusão só ADMIN_RH; audit_log somente
  via service_role (sem policy de insert para autenticados).

**`supabase/migrations/20260807000001_talentos_datamig.sql`** (idempotente)

Migração de dados em 6 passos:
1. INSERT talentos por CPF (`ROW_NUMBER PARTITION BY cpf_digits`, mais recente vence) → `ON CONFLICT (cpfDigits) WHERE cpfDigits <> '' DO NOTHING`.
2. UPDATE applications SET talentoId (por CPF).
3. INSERT talentos restantes por e-mail → `ON CONFLICT (emailNormalizado) DO NOTHING`.
4. UPDATE applications restantes SET talentoId (por e-mail).
5. UPDATE assessment_sessions SET talentoId (propagado da candidatura vinculada).
6. UPDATE assessment_sessions SET validoAte = submittedAt + validityMonths meses.

> **Bug corrigido antes do push:** Passo 6 tinha `at."id"::text` ao comparar com `s."templateId"` (uuid).
> PostgreSQL não aceita `uuid = text`. Removido o cast — ambas as colunas já são `uuid`.

### 2. Lib — `src/lib/talentos/`

- **`types.ts`**: `TalentoStatus`, `TalentoOrigem`, `Talento`, `TalentoListItem`, `TesteCard`,
  `TesteValidezResult` (union type discriminada), `TalentoNote`, `CandidaturaHistorico`, `TalentoProfile`.
- **`permissions.ts`**: funções puras `canReadTalentos`, `canWriteTalentos`, `canWriteNotes`,
  `canDeleteNotes`, `canInvalidateSession`, `canManageTags` + helpers assíncronos
  `requireTalentoRead` / `requireTalentoWrite` (retornam `TalentoAccess` discriminado).
- **`validity.ts`**: `computeValidez(session, dataReferencia?)` → `TesteValidezResult` —
  **fonte única de verdade** para validade; chamada no Server Component, nunca recalculada no cliente.
  `computeValidoAte(submittedAt, validityMonths)` — chamada uma única vez na submissão e persistida em
  `validoAte`. Constante `AVISO_VENCIMENTO_DIAS = 30`.

### 3. API Routes — `src/app/api/talentos/`

| Rota | Método | Função |
|---|---|---|
| `/api/talentos` | POST | Cria talento (ADMIN_RH) |
| `/api/talentos/[id]` | PATCH | Edita campos + atualiza `ultimaAtividadeEm` |
| `/api/talentos/[id]/notes` | POST | Adiciona nota (ambos os papéis) |
| `/api/talentos/[id]/notes/[noteId]` | DELETE | Remove nota (ADMIN_RH) |
| `/api/talentos/[id]/tags` | PUT | Substitui todas as tags (delete + insert) |
| `/api/talentos/[id]/sessions/[sessionId]/invalidate` | POST | Invalida sessão (ADMIN_RH); grava audit_log via service_role |
| `/api/talentos/[id]/test-invite` | POST | Gera `assessment_session` com `talentoId`; checa validade existente (409 se válida, salvo `forceReinvite: true`); retorna `testeUrl` |

### 4. UI — páginas e componentes

**Server Components (`src/app/(internal)/talentos/`)**

- **`page.tsx`**: lista paginada (25/página); 2 queries paralelas (talentos + tags disponíveis);
  filtros via URL search params (`q`, `status`, `estado`, `page`); guard `canReadTalentos`.
- **`[id]/page.tsx`**: perfil; **5 queries em `Promise.all`** — talento, sessões+templates,
  candidaturas+vagas+stages, notas, tags; computa `TesteCard[]` agrupando sessões por template e
  chamando `computeValidez`; grava audit_log de acesso (fire-and-forget, service_role).
- `loading.tsx` e `[id]/loading.tsx` — skeletons.

**Client Components (`src/components/internal/talentos/`)**

- **`TalentosList.tsx`**: tabela responsiva; busca com `useDebouncedValue(400ms)` sincronizada à URL;
  selects de status e UF; paginação por URL params (server-rendered, compartilhável/bookmarkável).
- **`TalentoProfile.tsx`**: abas Dados / Testes / Candidaturas / Notas com contadores; sub-componente
  `TagEditor` (toggle + `PUT /api/talentos/[id]/tags`; só ADMIN_RH).
- **`TalentoTestsTab.tsx`**: card por template com `ValidezBadge` (verde / amarelo 30d / laranja expirado / cinza não realizado / vermelho invalidado); `InvalidateModal` (motivo ≥5 chars); `InviteModal` (validade 1–30 dias, `forceReinvite`); `router.refresh()` após ação.
- **`TalentoNotesTab.tsx`**: timeline cronológica inversa; formulário inline; exclusão otimista.
- **`TalentoHistoryTab.tsx`**: lista de candidaturas com link para `/vagas/[id]/candidatos`.

### 5. Sidebar

`InternalSidebar.tsx`: ícone `Star` + item `{ href: "/talentos", label: "Talentos" }` inserido
na seção Recrutamento, após Vagas.

### Decisões de design

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Dedup CPF primeiro, e-mail como fallback | Só e-mail | CPF é a chave mais confiável; e-mail pode mudar |
| `validoAte` armazenado na submissão | Computado na leitura | Single source of truth; sem divergência de timezone ou lógica duplicada |
| Sessões reaplicadas criam nova linha | Sobrescrevem a existente | Preserva histórico completo de aplicações |
| Convite independe de candidatura (`applicationId` nullable) | Sempre exige candidatura | ADMIN_RH pode convidar talento do banco sem vaga aberta |
| Audit_log via service_role | Policy de insert para autenticados | Log é infraestrutura, não dado do usuário; RLS de insert seria sobreposição |

### Pendente (próximas sessões)

- Página pública `/teste/[token]` para candidatos realizarem testes por link (hoje o link existe mas a página não).
- Após a página pública: ativar envio de e-mail via Resend no `test-invite` route (TODO já marcado).
- Tags: tela de gerenciamento de tags disponíveis (`/talentos/tags` ou em `/configuracoes`).

---

## Sessão de 2026-08-06 — Big Five, Kanban IA, dashboard e CPF+IA na candidatura

### 1. Avaliações: gráfico radar Big Five — commits `871333f` / `2e87bb2`

Página `/avaliacoes/resultados` com visualização dos resultados de sessões de avaliação.

- **`src/components/internal/BigFiveChart.tsx`**: gráfico radar SVG puro (sem dependência externa),
  cinco eixos Big Five (Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo),
  polígono preenchido + pontos com tooltip de score. Reutilizável inline ou em modal.
- **`src/app/(internal)/avaliacoes/resultados/page.tsx`**: lista sessões submetidas com expansão inline
  (accordion) que carrega o radar + breakdown de score por dimensão.
- Nenhuma migração — lê dados de `assessment_sessions` e `assessment_answers` já existentes.

### 2. Kanban de candidatos: score IA, botão de teste por tipo e modal de entrevista — commit `eaeed0b`

Três melhorias no card e na ficha de candidatos do Kanban:

- **Score de compatibilidade IA**: barra percentual (`bg-wg-green`) no card, mostra `aiScore` (0-100)
  quando disponível. Carregado em paralelo de `application_assessments WHERE kind='AI_FIT'`.
- **Botão de teste por template kind**: ícone diferenciado — `Brain` para PERSONALITY, `Code2` para
  TECHNICAL, `FlaskConical` para demais. Copia link de teste ou dispara sessão conforme `templateKind`.
- **`InterviewModal.tsx`**: modal de registro de entrevista com campo de notas + score manual;
  salva em `application_assessments` com `kind='INTERVIEW'`.

### 3. Dashboard: correção de conclusão de tarefas e animação — commit `b79736b`

- **`AdmissaoAtividadesWidget`**: ao concluir tarefa, `revalidateTag('admissoes-widget')` em
  `actions.ts` invalida o cache do widget sem recarregar a página inteira.
- Fade-out animado no item concluído (`completing` state → `opacity-0 scale-95` via Tailwind) antes
  de remover da lista, evitando "salto" visual.

### 4. Configurações: layout 2 colunas — commit `c63bc44`

Cards de `/configuracoes` migrados para grid 2 colunas, alinhado com o padrão visual de Admissões.
Sem migração de banco.

### 5. Candidatura: CPF único + extração de CV por IA + consulta pública de status — commit `80efc21`

Feature completa em três partes.

#### Migração SQL aplicada — `supabase/migrations/20260806120000_cpf_profile_status.sql`

```sql
-- Colunas novas em applications:
cpf TEXT
cpf_digits TEXT GENERATED ALWAYS AS (regexp_replace(cpf, '[^0-9]', '', 'g')) STORED
cv_profile JSONB
cv_extraction_status TEXT DEFAULT 'PENDING'
  CHECK (cv_extraction_status IN ('PENDING','SUCCESS','FAILED','MANUAL_REVIEW'))
"candidateState" TEXT
-- Índice parcial: applications_cpf_digits_idx ON applications(cpf_digits) WHERE cpf_digits <> ''

-- Coluna nova em application_stages:
"externalLabel" TEXT
-- Seeds: NEW→'Candidatura recebida', SCREENING→'Em análise', INTERVIEW→'Entrevista agendada',
--        OFFER→'Proposta enviada', HIRED→'Selecionado(a)', REJECTED→'Processo encerrado'
```

#### Feature 1 — Unificação por CPF

- `cpf_digits` é coluna **GENERATED ALWAYS AS STORED** — sem trigger, nunca dessincroniza.
- `POST /api/applications`: valida CPF (dígitos verificadores via `isValidCpf`), checa
  `cpf_digits + jobId` para duplicata (409 "Você já se candidatou a esta vaga"), insere com CPF.
- **`GET /api/candidatura/lookup`** (novo, rate-limit 10/min): recebe CPF, devolve dados da candidatura
  mais recente para pré-preencher o formulário (`{ exists, name, email, phone, city, state }`).
- **`ApplicationForm.tsx`**: `onBlur` no CPF chama lookup e pré-preenche campos vazios.
  Campo UF só aparece quando `country === 'Brasil'`. Campo `availablePresential` removido.

#### Feature 2 — Formulário enxuto + extração de perfil por IA

- **`src/lib/ai/cv-analyzer.ts`**: nova função `extractCvProfile(pdfBuffer)` — versão sem
  `jobTitle` do `analyzeCv()` existente; usa Groq `llama-3.3-70b-versatile`, `max_tokens: 512`.
  Retorna `{ experienceYears, education, lastPosition, skills[:8], extractedAt, modelUsed }`.
- Candidato recebe **201 imediatamente**. Extração roda em background via `after()` do Next.js 15.
  - PDF bem-formado → `cv_extraction_status = 'SUCCESS'`, `cv_profile = {...}`
  - Não-PDF → `'MANUAL_REVIEW'`; erro de extração → `'FAILED'`
- **Badge no Kanban**: `KanbanBoard.tsx` exibe badge âmbar "⚠ CV não lido" quando
  `cvExtractionStatus === 'FAILED' || 'MANUAL_REVIEW'`. Novo campo opcional `cvExtractionStatus?`
  na interface `KanbanApplication`; passado via `candidatos/page.tsx` no mapeamento dos cards.

#### Feature 3 — Consulta pública de status

- **`/vagas/status`** (`src/app/(public)/vagas/status/page.tsx`): formulário CPF + e-mail;
  chips de etapa coloridos por `stageKind` (verde WON, cinza LOST, azul OPEN) com `externalLabel`.
- **`POST /api/candidatura/status`** (novo): rate-limit 5 req / 10 min por IP; requer CPF + e-mail
  (segundo fator LGPD — CPF sozinho não autentica); resposta genérica `{ found: false }` para
  qualquer não-match, sem revelar se o CPF existe.
- Link "Consultar minha candidatura" adicionado ao hero da home pública.

#### Decisões de design registradas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| CPF em `applications` (sem tabela `candidates`) | Criar tabela `candidates` | Mantém arquitetura existente; histórico fica em `applications` |
| Dado mais recente prevalece no pré-preenchimento | Mescla campos | Simples e intuitivo |
| CPF + e-mail como segundo fator | CPF sozinho | LGPD: CPF é previsível; e-mail evita enumeração |
| `after()` do Next.js 15 para extração assíncrona | Fila/worker separado | Zero infra extra; candidato não espera |
| `GENERATED ALWAYS AS STORED` para `cpf_digits` | Trigger ou app code | Integridade garantida pelo banco |

---

## Sessão de 2026-07-31 (continuação) — Análise AI-native de Currículos (Groq)

Implementação do botão **"Analisar com IA"** na ficha do candidato: extrai texto do PDF,
envia ao modelo de linguagem e grava score de aderência em `application_assessments`.

### Arquitetura

- **`src/lib/ai/cv-analyzer.ts`** — função `analyzeCv(pdfBuffer, jobTitle, jobDescription)`:
  usa `require('pdf-parse')` (dinâmico, Node.js puro, sem worker) para extrair texto do PDF;
  envia texto + descrição da vaga ao LLM; retorna `CvAnalysisResult`
  (`profile`, `fitScore 0-100`, `fitReason`, `strengths[]`, `gaps[]`).
- **`POST /api/applications/[id]/analyze`** (`src/app/api/applications/[id]/analyze/route.ts`):
  autenticado (staff); busca candidatura+vaga; cria signed URL temporária (120 s) para baixar
  o PDF do bucket `resumes`; chama `analyzeCv`; determina `outcome` (RECOMMEND ≥70 / PENDING
  ≥50 / REJECT <50); apaga AI_FIT anterior e insere novo em `application_assessments`
  (`source='AI'`, `kind='AI_FIT'`).
- **`src/components/internal/AssessmentsSection.tsx`** — botão roxo (Sparkles) aparece quando
  `canManage && hasResume` (PDF); dispara fetch + recarrega lista de avaliações.
- **`next.config.ts`** — `serverExternalPackages: ["pdf-parse"]` evita que o webpack bundle o módulo.

### Histórico de commits e bugs encontrados

| Commit | Descrição |
|---|---|
| `77e784e` | Implementação inicial — provider Anthropic (`claude-haiku-4-5`), document blocks PDF |
| `fda71f9` | Troca Blob por signed URL + `fetch().arrayBuffer()` (ByteString error persistiu) |
| `c0dfdc5` | Troca para pdf-parse v2 + extração de texto (pdf-parse v2 falhou, worker do pdfjs-dist) |
| `7af74d1` | pdf-parse@1.1.1 + `require()` dinâmico + `serverExternalPackages` |
| `e4eed67` | **Fix BOM:** strip `U+FEFF` do `GROQ_API_KEY` antes de criar o cliente |
| `cf93434` | **Migração para Groq:** troca Anthropic por `groq-sdk` (LLaMA 3.3 70B) |

**Bug raiz (ByteString error):** `"Cannot convert argument to a ByteString because the character
at index 0 has a value of 65279 which is greater than 255"` — o Node.js rejeita valores de header
HTTP com caracteres > 255. O `ANTHROPIC_API_KEY` na Vercel tinha BOM (`U+FEFF` = 65279) no byte 0.
O SDK da Anthropic passa a API key diretamente como `x-api-key` e o `Headers` constructor do Node
explodia. Fix: `.replace(/^<U+FEFF>/, '').trim()` na variável antes de criar o cliente.

### Migração para Groq (commit `cf93434`)

Provider trocado de Anthropic para **Groq** (gratuito, limite alto de tokens).

- **Pacote:** `groq-sdk@1.5.0` (instalado via `npm install groq-sdk`).
- **Modelo:** `llama-3.3-70b-versatile` (alta qualidade, mais rápido que o Haiku).
- **Variável de ambiente:** `GROQ_API_KEY` (adicionar na Vercel: Settings → Environment Variables).
- **API:** `client.chat.completions.create()` com `messages` system + user (compatível OpenAI).
- `evaluator` no `application_assessments` atualizado para `"IA · Groq LLaMA"`.
- `ANTHROPIC_API_KEY` não é mais necessária para o analisador de currículos (ainda pode existir
  para a geração de questões de avaliação em `avaliacoes/banco`, que usa `@anthropic-ai/sdk`
  diretamente).

**Ação necessária no Vercel:** adicionar `GROQ_API_KEY` em Production e fazer Redeploy.

---

## Sessão de 2026-07-31 — Design Sync completo (4 telas do painel RH)

Sincronização visual das 4 telas principais do painel interno com o handoff do **Claude Design
(WG Baterias UI)**. Referências em `.tsx` exportadas do Vercel Design (não commitadas). Abordagem:
substituir apenas a camada visual — toda a busca de dados Supabase, Server Actions e lógica de
filtro foram preservadas.

**Tokens globais (tailwind.config.ts):**  
`wg-bg`, `wg-sidebar`, `wg-border-light`, `wg-border-lighter`, `wg-ink`, `wg-ink-muted`,
`wg-ink-secondary`, `wg-hover-light` — todos com valores da paleta WG aprovada.

**Fase 1 — Dashboard (`dashboard/page.tsx`):**  
KPIs em cards emoji-icon (w-8 h-8 rounded-[9px], `text-2xl font-extrabold`), sparkline SVG inline
(polyline verde `#90CB46`), remoção de `DashboardCard`. Sidebar e shell ajustados para tokens WG.

**Fase 2 — Vagas (`vagas/gerenciar/page.tsx` + `JobsExplorer.tsx`):**  
- 6 KPI cards + 1 sparkline ("Publicadas este mês").
- `JobsExplorer` reescrito: toolbar com search + "Filtros ▾" dropdown com checkboxes (OR intragrupo,
  AND intergrupos) + "Ordenar ▾" dropdown + toggle Lista/Kanban `bg-[#EEF4E3]`.
- Quick-chips: Todas · Minhas Vagas · Urgentes · Com Candidatos.
- Cards: `rounded-2xl shadow-[0_1px_3px…]`, stripe 5px com `PRIORITY_STRIPE` por prioridade, badge
  de status, contagem de candidatos com ícone `Users`, hover "Ver candidatos".
- `selectedFilters: string[]` (flat, prefixed `STATUS:`, `PRIORITY:`, `CITY:`, `DEPT:`) substitui
  o antigo objeto `JobFilters`.

**Fase 3 — Admissões (`admissoes/page.tsx` + `AdmissionsExplorer.tsx`):**  
- 4 KPI cards emoji-icon (👤 Em andamento, ✓ Concluídas, ⚠ Atrasadas, 📅 Próximos 7 dias).
- `AdmissionsExplorer` reescrito: toolbar search + "Filtros ▾" (etapa/empresa) + "Ordenar ▾" +
  toggle Lista/Kanban (Kanban = Link para `/admissoes/kanban`).
- Quick-chips: Todas · Atrasadas · Próximos 7 dias (cada um filtra via `quickFilter` state).
- Cards com stripe colorida por `stageColor`, badge de etapa (`stageColor + '1f'` bg), meta
  (cargo · empresa/filial · responsável), badge 📅 Início DD/MM/YYYY · Em Xd / Atrasado Xd com
  cor dinâmica (verde → âmbar → vermelho), hover "Ver checklist".
- `selectedFilters: string[]` com chaves `STAGE:id` e `CO:id`.

**Fase 4 — Candidatos (`candidatos/page.tsx` + `KanbanBoard.tsx` + `KanbanBoardShell.tsx`):**  
- Header: "← Voltar às vagas" em `text-[#55614A]`; título `text-[26px] font-extrabold
  text-[#1A2213]`; badge candidaturas em `bg-[#EEF4E3] border-[#DCE8CC]`.
- `KanbanBoardShell`: coluna sem `border-b`; dot `w-2 h-2`; label `font-bold text-[#1A2213]`;
  contador → pill `bg-[#1A2213] text-white` (era `bg-gray-300 text-gray-700`).
- `KanbanBoard` renderCard: nome `font-bold text-[#1A2213]`; badge canal `bg-[#E4F3DA]
  text-[#2F5D1E]`; email/fone `text-[#55614A]`; "Currículo" `font-bold text-[#4F6930]`.

**Notas:** nenhuma migração de banco. Type-check `tsc --noEmit` passou clean. Validado em browser
(localhost:3000). Sem mudança de comportamento funcional — só visual.  
**Commit:** `feat(ui): design sync completo — 4 telas do painel RH`.

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

> **Atualização 2026-09-22:** as Fases 2 e 3 já foram feitas (sessões por token, badge no Kanban) e o módulo
> foi reestruturado em Banco de testes · Aplicações · Resultados — ver a sessão de 2026-09-22 (noite) no topo.
> O texto abaixo é o planejamento original, mantido como histórico.

### Fase 2 — Fluxo de sessão/candidato (FEITA — ver atualização acima)
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
