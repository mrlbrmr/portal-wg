# Filial, área e cargo vindos dos cadastros

**Data:** 2026-11-13 · **Origem:** auditoria dos formulários (`docs/ux-discovery/2026-11-13-auditoria-formularios.md`),
achados S2, A6, A7 e X2.

## Intenção

Padronizar três informações que hoje são digitadas ou respondidas de forma livre e já geram dado errado:

- **Unidade:** as vagas têm 18 grafias para 6 filiais ("WG Baterias SJP", "Matriz (SJP)", "SJP"…), e a cidade do
  "Rio de Janeiro" aparece ora vazia, ora como Nova Iguaçu.
- **Área:** texto livre ("logistica" × "Logística"), sem cadastro.
- **Cargo:** o candidato responde se usa calça e bota e se é motorista/operador, e responde diferente para o mesmo
  cargo (dois "Assistente de Cobrança" com respostas opostas sobre uniforme; um "Técnico Entregador" motorista e
  outro não). "Motorista ou operador" é uma pergunta só e pede MOPP **e** empilhadeira a quem responde sim.

**Sucesso:** solicitações e vagas novas só com filial e área do cadastro; a vaga nasce com cidade/UF certas; o
formulário de admissão não pergunta ao candidato o que o cargo já define, e motorista e operador recebem cada um os
seus documentos.

## Objetivos

1. Cadastro **Áreas** em Configurações › Cadastros (criar, renomear, reordenar, desativar; item em uso não é excluído).
2. Cadastro **Filiais** ganha **cidade** e **UF**.
3. Cadastro **Cargos** ganha três marcações: **Usa uniforme operacional (calça e bota)**, **Motorista** e
   **Operador de empilhadeira**.
4. **Solicitação de vaga** (público e interno): "Empresa / Unidade" vira seleção de Filial ativa e "Área / Departamento"
   vira seleção de Área ativa.
5. **Vaga** (editor e Nova vaga): mesmos dois campos como seleção; escolher a filial preenche cidade/UF.
6. **Vaga criada da solicitação** herda filial, área, cidade e UF.
7. **Contratar pelo pipeline:** o modal da admissão já vem com a filial da vaga marcada.
8. **Formulário de admissão:** com cargo na admissão, não pergunta "motorista/operador" nem "calça e bota" — usa o
   cargo. Documentos de motorista e de operador passam a ter condições próprias.

## Fora do escopo

- Empresa (CNPJ) na solicitação ou na vaga: continua sendo escolhida pelo RH na admissão (o gestor não sabe o CNPJ).
- Ligar o título da vaga ao cadastro de Cargos (X1). A vaga continua com título livre; a sugestão de cargo na
  solicitação (já no ar) segue como está.
- Corrigir/migrar o texto das solicitações e vagas antigas. Elas continuam mostrando o texto que têm; o vínculo vale
  daqui para frente (ver "Dados existentes").

## Anti-objetivos (o que tornaria isto um fracasso mesmo funcionando)

- Portal, sitemap, feeds Google/Indeed, Intranet WG Conecta ou WG Jornada deixarem de mostrar a unidade ou a área.
  Eles leem as colunas de texto `jobs.company`, `jobs.department`, `jobs.city`, `jobs.state` — essas colunas
  **continuam preenchidas** (com o nome do cadastro).
- Um formulário de admissão travar porque o cargo não está marcado ou a admissão não tem cargo.
- Excluir uma filial/área/cargo em uso.

## Restrições

- Migração **aditiva**, aplicada à mão **antes** do push (CLAUDE.md). Nada de drop/rename de coluna.
- RLS: as tabelas de cadastro seguem o padrão `is_staff()` lê / `is_admin()` escreve. O formulário público
  `/solicitar-vaga` lê filiais/áreas pelo client admin no servidor (como já faz com as sugestões).
- `create_job_from_request()` é plpgsql transacional — a mudança entra por `create or replace function` na migração.
- Server actions de cadastro registram em `config_change_log` (`logConfigChange`).

## Abordagens consideradas

**Como guardar filial e área (escolhida: A).**
- **A — Referência + nome copiado.** `job_requests.branch_id/area_id` e `jobs."branchId"/"areaId"` (FK, nullable);
  as colunas de texto continuam recebendo o nome. Consumidores externos não mudam; renomear no cadastro não quebra o
  vínculo. *Escolhida pelo usuário.*
- B — Só o nome escolhido da lista. Mais simples, mas renomear deixa vagas sem vínculo e com nome velho.

**Como o cargo define uniforme e documentos (escolhida: A).**
- **A — Três marcações no cargo** + condições novas no formulário ("Se o cargo é motorista", "Se o cargo é operador
  de empilhadeira"). *Escolhida pelo usuário.*
- B — Lista de documentos por cargo. Mais flexível, mas duplica as regras de condição do editor do formulário.

## O desenho

### Banco (migração `AAAAMMDDHHMMSS_cadastros_filial_area_cargo.sql`, aditiva)

- `admission_areas` (`id text pk default gen_random_uuid()::text`, `name text not null`, `active bool default true`,
  `sortOrder int`, `createdAt`, `updatedAt`), mesmo formato de `admission_branches`. RLS staff lê / admin escreve.
  **Semente:** Logística, Comercial, Financeiro, Administrativo, Serviços Gerais, Varejo, Trade (os valores em uso).
- `admission_branches` + `city text null`, `state text null` (UF, 2 letras).
  **Semente** (o usuário confere depois na tela): Matriz (SJP) → São José dos Pinhais/PR; Rio de Janeiro → Nova
  Iguaçu/RJ; Maringá/PR; Londrina/PR; Sumaré/SP; São Paulo/SP.
- `admission_positions` + `usesOperationalUniform bool not null default false`, `isDriver bool not null default false`,
  `isForkliftOperator bool not null default false`. **Semente** = tabela de "Dados existentes" (pelo nome do cargo).
- `job_requests` + `branch_id text null references admission_branches`, `area_id text null references admission_areas`.
- `jobs` + `"branchId" text null references admission_branches`, `"areaId" text null references admission_areas`.
- `create_job_from_request()`: passa `branchId`, `areaId` e preenche `city`/`state` da filial (hoje vai `null, null`).
  `company` = `r.location` (que agora é o nome da filial), `department` = `r.department` (nome da área).
- Uso para "não excluir item em uso" (`registry-usage.ts`): branch também conta `jobs."branchId"` e
  `job_requests.branch_id`; area conta `jobs."areaId"` e `job_requests.area_id`.

### Cadastros (Configurações › Cadastros)

- Nova entidade `area` no registro (`registry.ts`, `registry-usage.ts`, `registry-data.ts`, `config-actions.ts`):
  slug `/configuracoes/cadastros/areas`, título "Áreas", "Áreas usadas na solicitação de vaga e nas vagas.".
  Desativável, reordenável, item em uso não é excluído.
- `RegistryItemDialog`: filial ganha campos **Cidade** e **UF** (select das UFs); cargo ganha três caixas de marcar
  com dica ("Pede calça e bota no formulário de admissão", "Pede MOPP e CNH", "Pede o certificado de operador de
  empilhadeira"). `RegistryTable` mostra cidade/UF da filial e as marcações do cargo em texto curto.

### Solicitação de vaga (`JobRequestFormFields`, público e interno)

- "Empresa / Unidade" → **Filial** (select das filiais ativas, rótulo "Filial"); "Área / Departamento" → **Área**
  (select das áreas ativas). O payload passa a ter `branchId`/`areaId` (obrigatórios no envio novo); o servidor
  resolve o nome no cadastro e grava texto + id (`location`/`department` = nome).
- Solicitação antiga (sem id) aberta no detalhe/edição: o select mostra o texto atual como opção "— (valor antigo)"
  até o RH escolher uma filial/área; não força a troca para quem só está lendo.
- `extra_data` e workflow não mudam. `location` já é campo crítico (`workflow.ts`): trocar a filial depois de aprovada
  continua devolvendo para aprovação, porque o texto gravado muda junto. Só os rótulos de `CRITICAL_FIELD_LABELS`
  são atualizados ("Empresa / Unidade" → "Filial"; "Título da vaga" → "Cargo solicitado"). Área não é crítica (não muda).
- Tipos: os ids dos cadastros são `text`; `job_requests.id` é `uuid` e `jobs.id` é `text` — as FKs novas são `text`.

### Vaga (`JobFields`, Nova vaga e editor)

- "Empresa / unidade" → **Filial** (select). Ao escolher, preenche cidade/UF da filial; o RH ainda pode ajustar a
  cidade (ex.: vaga num CD de outra cidade). "Área" → select. Vaga do banco de talentos continua sem filial.
- O POST/PATCH de vaga grava `branchId`/`areaId` e o nome em `company`/`department`.

### Contratar pelo pipeline (`AdmissionLinkModal`)

- Pré-seleciona a filial com `jobs."branchId"` da vaga (o RH pode trocar). Empresa e cargo continuam como hoje.

### Formulário de admissão (`DigitalForm`, `submit`, `form-config.ts`, editor do formulário)

- A página `/admissao/[token]` carrega o cargo da admissão (`positionId` → marcações) e passa ao formulário um
  `positionProfile = { usesOperationalUniform, isDriver, isForkliftOperator } | null`.
- **Com cargo:** não mostra "É motorista/operador?" nem "Não utilizarei calça e bota"; os tamanhos de calça e bota
  aparecem só se `usesOperationalUniform`. A camiseta continua para todos.
- **Sem cargo (null):** comportamento atual (pergunta ao candidato), para nada travar.
- Condições novas em `DocCondition`: `{ type: 'positionDriver' }` e `{ type: 'positionForkliftOperator' }`, com
  rótulos "Se o cargo é motorista" e "Se o cargo é operador de empilhadeira". Avaliação: com cargo, usa a marcação;
  sem cargo, cai na resposta "motorista/operador" do candidato (mantém o comportamento de hoje).
- Configuração padrão: "Certificado MOPP + CNH com observação" → `positionDriver`; "Certificado Operador de
  Empilhadeira" → `positionForkliftOperator`. Como não há configuração salva no banco, o padrão vale para todos.
  A condição antiga `isDriverOperator` continua aceita (configurações salvas no futuro não quebram).
- **Servidor (`submit`)**: com cargo, ignora `isDriverOperator`/`noOperationalUniform` do corpo e grava os valores
  derivados do cargo (`isDriverOperator = isDriver || isForkliftOperator`, `noOperationalUniform =
  !usesOperationalUniform`), e `missingRequiredItems()` usa o perfil do cargo nas condições novas.
- Regra pura nova (testada): `resolvePositionAnswers(profile, candidateAnswers)` → respostas efetivas usadas pela tela
  e pelo servidor.

### Dados existentes

- Solicitações e vagas antigas ficam com o texto que têm e `branch_id/area_id = null`. Nada é reescrito.
- **Marcações iniciais dos cargos (confirmadas pelo usuário em 2026-11-13)**, gravadas por migração de dados junto do
  deploy — sem elas, quem tem cargo deixaria de ver calça/bota e os documentos de motorista/operador:

  | Cargo | Calça e bota | Motorista (pede MOPP) | Operador de empilhadeira |
  |---|:-:|:-:|:-:|
  | Motorista de Caminhão Junior / Pleno / Senior | ✓ | ✓ | |
  | Técnico Entregador (CNH já vem no RG/CNH; sem MOPP) | ✓ | | |
  | Operador Multifuncional | ✓ | | ✓ |
  | Encarregado de Logística | ✓ | | ✓ |
  | Auxiliar de Logística | ✓ | | |
  | Auxiliar de Serviços Gerais | ✓ | | |
  | Especialista de Logística, Analista de Logística Reversa Pleno, Consultor Comercial Externo e Interno, Assistentes, Auxiliar Administrativo, Analista de Contas a Pagar, Assistente Comercial, Assistente de Cobrança | | | |

  Cargo novo nasce com tudo desmarcado; a dica do diálogo de cadastro lembra o RH de marcar.

## O que fica para quem constrói

- Ordem exata dos arquivos e dos commits; nomes internos de funções além dos citados.
- Visual dos campos novos no diálogo de cadastro (seguir os componentes de `settings/`).
- Mensagens de validação ("Escolha a filial", "Escolha a área").

## Decisões tomadas por mim (para o usuário conferir)

- Gestor escolhe só a filial; empresa (CNPJ) fica na admissão.
- Admissão sem cargo continua perguntando ao candidato.
- Camiseta continua sendo perguntada a todos (só calça e bota dependem do cargo).
- Cidade da vaga é preenchida pela filial, mas editável.
- Marcações dos cargos: tabela acima. O usuário corrigiu Analista de Logística, Consultor Comercial, Técnico
  Entregador e Auxiliar de Logística; Encarregado (operador ✓) e Especialista (sem calça/bota) são decisões minhas
  pelas respostas dos candidatos.
- "Motorista" = pede MOPP; a renomeio na tela como "Motorista (pede MOPP)" para não confundir com quem só dirige.
