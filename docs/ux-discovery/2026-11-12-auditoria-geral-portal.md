# Auditoria geral do portal — incongruências e pontos de melhoria

**Data:** 2026-11-12 · **Escopo:** portal público, painel do RH e fluxos por token
**Foco:** UX/consistência e regras entre módulos · **Método:** navegação logada em produção (somente leitura) + leitura do código
**Feedback de usuários:** nenhum disponível; esta é uma auditoria heurística.

---

## 1. Resumo executivo

O painel tem uma base sólida: regras puras e testadas, um design system e um vocabulário documentado. Os problemas encontrados
**não são bugs isolados, e sim definições divergentes do mesmo conceito em telas diferentes**. O RH vê números
que não batem (vagas abertas, candidatos em processo, contratados) e não consegue dizer qual deles está certo.

Os três pontos mais urgentes:

1. **O commit de LGPD (`c8da845`) não está em produção.** O master local está 1 commit à frente do `origin/master`, e
   `/configuracoes/privacidade` responde 404 no ar.
2. **As solicitações de vaga nunca terminam.** Há 17 em "Em recrutamento" para apenas 3 vagas abertas, e a aba padrão
   ("Em andamento") mostra a fila vazia.
3. **Cada tela conta "vaga aberta", "em processo" e "contratado" de um jeito.** A vaga "Banco de Talentos" entra em
   algumas contagens e fica de fora em outras.

---

## 2. Problem brief

- **Problema:** o painel cresceu por módulos (ATS, solicitações, talentos, admissões, avaliações), e cada um define
  à sua maneira estados e contagens que, na cabeça do RH, são a mesma coisa.
- **Quem sente:** o RH (ADMIN_RH, que hoje é uma pessoa só); gestores, que pedem vagas; candidatos, no portal público.
- **Como resolvem hoje:** conferindo tela a tela e confiando na memória, porque não há uma fonte única de indicador.
- **Escopo:** melhoria do que já existe; nenhum módulo novo.

## 3. Personas (prioridade)

| # | Persona | O que precisa do portal |
|---|---------|-------------------------|
| 1 | **Analista de G&G (RH)**: opera tudo sozinho, do pedido à admissão | Números confiáveis, uma fila de trabalho que reflita a realidade e o mesmo vocabulário em todo lugar |
| 2 | **Gestor solicitante**: acessa só `/solicitar-vaga` | Entender que está pedindo autorização (e não abrindo a vaga) e saber em que pé o pedido está |
| 3 | **Candidato**: acessa pelo celular, vindo de anúncio ou WhatsApp | Ver a vaga rápido, se inscrever sem atrito e consultar o status |

## 4. Jobs to be done (resumo)

- **RH (funcional):** *Quando abro o painel de manhã, quero ver só o que depende de mim, para não perder prazo de
  admissão nem deixar candidato parado.* **(emocional):** confiar que o número está certo sem precisar conferir.
- **Gestor:** *Quando preciso repor alguém, quero pedir a vaga em poucos minutos e saber quando ela foi aberta.*
- **Candidato:** *Quando vejo uma vaga, quero saber se vale a pena (salário, local, horário) e me candidatar do celular.*

---

## 5. Achados

Severidade: **Alta** (dado errado ou fluxo quebrado) · **Média** (confunde ou gera retrabalho) · **Baixa** (polimento).

### 5.1 Regras entre módulos (incongruências de dados)

| # | Sev. | Achado | Evidência | Recomendação |
|---|------|--------|-----------|--------------|
| R1 | **Alta** | **LGPD fora do ar.** O commit `c8da845` não foi enviado ao GitHub | `git status`: `ahead 1`; `/configuracoes/privacidade` → 404; o card "Privacidade" não aparece em Configurações | Confirmar que a migração `20261111120000` está aplicada e fazer o push |
| R2 | **Alta** | **A solicitação não tem estado final.** `RECRUITING` é terminal em `workflow.ts`: a vaga encerra e a solicitação continua "Em recrutamento" para sempre | Solicitações: **17 em recrutamento** para 3 vagas abertas (REQ-0001 a 0007 são legadas, sem posições) | Criar o estado derivado **"Atendida"** (todas as posições preenchidas ou vaga encerrada) e **"Encerrada sem contratação"** (vaga cancelada). Pode ser calculado pela vaga ligada, sem migração de status |
| R3 | **Alta** | **"Vagas abertas" tem três valores** | Visão geral: **2** · Lista de vagas: **3** · Home pública: **"3 vagas abertas"** | Uma única função `countOpenJobs()` com a regra explícita sobre o Banco de Talentos (ver R5), usada pelos três |
| R4 | **Alta** | **"Em processo" tem dois valores** | Visão geral: **7 candidatos em processo** · Banco de Talentos: **28 em processo** (21 da vaga "Banco de Talentos" + 5 + 2) | Definir se quem está na vaga contínua conta como "em processo". Sugestão: não conta. Ajustar a situação calculada em `talentos_crm` |
| R5 | **Alta** | **"Banco de talentos" nomeia três coisas diferentes:** o módulo CRM (`/talentos`), uma *vaga* contínua chamada "Banco de Talentos" e uma *origem* (`BANCO_TALENTOS`), além da origem "Banco de Currículos" | Lista de vagas, menu e painel "De onde vêm os candidatos" | Renomear a vaga para algo como **"Cadastro reserva / Candidatura espontânea"** e marcá-la com um tipo (`isEvergreen`) para que as contagens a tratem de forma explícita |
| R6 | **Alta** | **18 candidatos novos sem triagem e "0 precisam de atenção"** | Lista de vagas: Banco de Talentos com "18 novos"; o atalho "Com candidatos para triar: 1" e o card "0 precisam de atenção" aparecem lado a lado; a Visão geral mostra "Aguardando triagem: 0" | Ou a vaga contínua entra na regra de atenção com SLA próprio, ou "Com candidatos para triar" também a exclui. Hoje as duas telas se contradizem |
| R7 | Média | **"Contratado" tem duas definições** | Visão geral: "chegou a uma etapa de contratação" (19) · Talentos: "etapa de contratado **ou** admissão vinculada" · Visão geral mostra "Aprovado(a)" para quem o Talentos chama de "Contratado" | Uma regra só (sugestão: admissão vinculada, ou etapa `HIRED`) em `src/lib/recruitment` |
| R8 | Média | **A contagem de candidatos da vaga muda entre telas** | Lista: Assistente de Faturamento "**5** candidatos" · Pipeline: "**8** candidatos · 5 em processo · 3 fora do funil" | Na lista, escrever "5 em processo" (ou mostrar 8 e detalhar) |
| R9 | Média | **Links de teste nunca expiram e duplicam** | Aplicações: "Expirado **0**"; link enviado em 19/10 ainda "Não iniciado"; uma candidata da vaga Assistente Administrativo tem um envio "Não iniciado" e outro "Concluído". A fila da Visão geral conta esses casos em "6 testes aguardando" | Expirar o link por prazo (ex.: 7 dias) e invalidar o envio antigo quando a mesma pessoa conclui o mesmo teste |
| R10 | Média | **O cargo da admissão não se liga à vaga** | Vaga "Motorista de Caminhão (Entregador)" × cargo da admissão "Motorista de Caminhão Pleno/Junior"; solicitação "auxiliar logistica" (minúsculo, sem acento) | Sugerir o cargo do cadastro ao criar a solicitação ou a vaga e herdá-lo na admissão |
| R11 | Média | **E-mails fictícios em perfis de talento** (`email@email.com`, `editar@email.com`) | Banco de Talentos | Bloquear placeholders na validação e **excluí-los da sugestão de vínculo por e-mail** em `candidate-link.ts` (risco de sugerir a pessoa errada) |
| R12 | Baixa | **Dados de teste em produção** | REQ-2026-0010 "Teste", REQ-2026-0008 "[TESTE] Envio de e-mail - ignorar"; um candidato com o cargo digitado no campo de nome ("… **Motorista**") | Limpar e esconder de "Todas" o que foi cancelado ou reprovado como teste |
| R13 | Baixa | **"Pendências" com números diferentes no mesmo relatório** | Relatórios: "2 com pendência para o RH" × "Atenção necessária: 3 itens" (2 da mesma admissão) | Dizer "2 admissões · 3 pendências" |

### 5.2 UX e consistência (painel)

| # | Sev. | Achado | Recomendação |
|---|------|--------|--------------|
| U1 | **Alta** | **A aba padrão de Solicitações mostra a fila vazia** ("Nenhuma solicitação por aqui") com 19 registros existentes | Junto com R2: depois que as solicitações tiverem estado final, a aba padrão passa a mostrar só o que está aberto |
| U2 | Média | **Emojis como ícones** nos KPIs de Solicitações (📥 ⏳ ✅ 🎯 ⏰), contrariando a regra do design system ("sem emoji como ícone") | Trocar por `lucide` + `CompactMetrics` |
| U3 | Média | **Vocabulário de avaliações divergente:** etapa "**Teste** comportamental" × padrão "**Avaliação** comportamental"; no mesmo Kanban aparecem "Big Five concluído" e "Resultado disponível" para o mesmo estado; o filtro diz "Técnico/Comportamental" e o status "Concluído" | Renomear a etapa no cadastro do funil; tirar o sinal "Big Five concluído" (`candidate-presentation.ts:279`) ou usar "Resultado disponível" |
| U4 | Média | **"Aplicações"** (submenu de Avaliações) lembra "applications" (candidaturas) | Trocar por **"Envios"** ou **"Testes enviados"** |
| U5 | Média | **"Registrar entrevista"** no card não distingue *agendar* de *registrar parecer*, agora que a agenda existe | "Agendar entrevista" quando não há agenda e "Registrar parecer" quando há entrevista realizada |
| U6 | Média | **O 404 do painel usa o texto do candidato** ("Talvez a vaga que buscava tenha sido encerrada", "Ver vagas abertas") | Criar um `not-found.tsx` em `(internal)` que volte para a Visão geral |
| U7 | Média | **A Visão geral diz "4 itens pedindo a sua ação"**, mas 2 deles estão em "Aguardando outras pessoas" | Contar só a seção de ação ou dizer "2 pedem sua ação · 2 aguardam outras pessoas" |
| U8 | Baixa | **Etapa "Onboarding"** em inglês, numa interface toda em português | "Integração" |
| U9 | Baixa | **"Fluxo de admissão: etapas do *quadro* de admissões"** cita o Kanban que foi removido | "Etapas da admissão e a etapa de conclusão" |
| U10 | Baixa | **Caixa inconsistente:** "Banco de **T**alentos" (título da página e Configurações) × "Banco de **t**alentos" (menu); "Formulário de **A**dmissão **D**igital" | Sentence case em todos os títulos |
| U11 | Baixa | **Rótulos "Aguardando candidato" e "aguardando formulário"** para o mesmo estado na lista de admissões | Um rótulo só |
| U12 | Baixa | **Relatórios só cobrem admissões.** O recrutamento (funil, tempo até contratar, conversão por origem) só tem o painel de origens da Visão geral | Dá para fazer depois: um relatório de recrutamento a partir dos dados do WG Jornada/`stageVisits` |
| U13 | Baixa | **Página órfã** `/admissoes/digitais` ("módulo temporariamente desativado") | Redirecionar ou remover |
| U14 | Baixa | **Item "Avaliações" do menu** usa `aria-expanded` num link, e o leitor de tela anuncia "1 avaliações" (`CandidateCard.tsx:114`) | Mover o `aria-expanded` para um botão; pluralizar |

### 5.3 Portal público e fluxos por token

| # | Sev. | Achado | Recomendação |
|---|------|--------|--------------|
| P1 | Média | **A vaga contínua aparece como vaga comum** ("Banco de Talentos · Diversas localidades · CLT") e entra em "3 vagas abertas" | Mostrá-la num bloco separado: "Não achou sua vaga? Cadastre seu currículo" |
| P2 | Média | **A marca oscila:** "Grupo WG" (hero, rodapé), "WG Baterias" (títulos, termos) e "Carreiras WG Baterias" | Escolher uma (sugestão: **Grupo WG** no conteúdo e "Carreiras Grupo WG" no `<title>`) |
| P3 | Média | **Contradição institucional:** "atuamos nas regiões **Sul e Sudeste**" × card "Presença nacional: atuação em **todo o território brasileiro**" | Ajustar o card |
| P4 | Média | **`/solicitar-vaga` contradiz a própria mensagem:** `<title>` "**Abertura de Vaga** \| WG Baterias \| Carreiras WG Baterias" (marca duplicada), H1 com "\|" e campo "**Título da vaga**", logo depois de avisar que "isto não é a vaga". O aviso aparece duas vezes. A dica "Preenchido com o usuário conectado" não vale para gestores sem login | Título "Solicitar contratação", campo "Cargo", um aviso só, dica condicional |
| P5 | Baixa | **Horário duplicado e com grafia diferente** na página da vaga: "Segunda **à** sexta, das 08h00 às 18h00" (cabeçalho) × "segunda **a** sexta, das 08h às 18h" (texto). "Remuneração" aparece listada em **Benefícios** | Usar o horário estruturado e tirá-lo do Markdown; mostrar o salário fora da lista de benefícios |
| P6 | Baixa | **Navegação:** o link "Vagas" do cabeçalho leva a `/` (não a `/#vagas`); "Consultar minha candidatura" só existe no hero; Termos de Uso não está no rodapé; `/vagas/status` tem título genérico ("Carreiras \| WG Baterias") | Ajustar links e títulos |
| P7 | Baixa | **"Nossa IA lerá seu currículo e preencherá automaticamente seu perfil"** promete algo que o candidato não vê acontecer, porque o formulário continua pedindo tudo | "Usamos seu currículo para agilizar a análise" ou remover |

---

## 6. Princípios de design que saem da auditoria

1. **Uma definição, uma função.** Todo indicador que aparece em mais de uma tela vem de um helper puro e testado
   (`open jobs`, `in process`, `hired`), como já é feito com `publication.ts`.
2. **A vaga contínua é um tipo, não um nome.** As regras perguntam `isEvergreen`, nunca o título.
3. **Todo fluxo tem fim.** Solicitação, link de teste e formulário precisam de estado terminal, para que as filas não acumulem.
4. **O vocabulário vem do catálogo.** Os rótulos de estado saem de `presentation.ts`/`job-presentation.ts`; o nome
   de etapa configurável segue o mesmo glossário.

## 7. Métricas de sucesso

- **Números iguais entre telas:** um teste que compare as contagens da Visão geral, da lista de vagas, de Talentos e da home (alvo: 0 divergências).
- **Solicitações abertas ≈ vagas abertas** (hoje 17 × 3).
- **Testes "aguardando":** só os enviados dentro do prazo de validade.

## 8. Premissas e riscos

- Premissa: a vaga "Banco de Talentos" deve continuar existindo como porta de entrada do portal (não foi confirmado).
- Premissa: "contratado" deve significar **admissão vinculada** (decisão do RH).
- Risco: mudar a regra de "em processo" altera os números que o WG Jornada lê; revisar `jornada-feed.ts` junto.
- Não foi auditado com dados: o fluxo por token da admissão digital e do teste (exige link ativo de candidato).
  Calendário e Atividades foram vistos só pelo código.

## 9. Próximos passos recomendados (ordem)

1. **Push do LGPD** (R1), depois de confirmar a migração.
2. **Pacote "números que batem":** R3, R4, R5, R6, R7, R8 e P1, com a definição de `isEvergreen` e os helpers de contagem.
3. **Estado final da solicitação:** R2 + U1.
4. **Validade dos links de teste:** R9.
5. **Pacote de vocabulário e polimento:** U2 a U14, P2 a P7 (baixo risco, pode ir num commit só).
6. **Higiene de dados:** R10 a R12.
