# Auditoria dos formulários: admissão digital e abertura de vaga

**Data:** 2026-11-13 · **Escopo:** `/admissao/[token]` (candidato aprovado) e `/solicitar-vaga` (gestor)
**Foco:** UX/consistência e regras entre módulos · **Método:** formulário público em produção, código-fonte e
dados de produção (só leitura). A prévia logada do formulário de admissão não foi vista, porque a sessão
expirou durante a auditoria; o formulário foi auditado pelo código.

---

## 1. Resumo executivo

Os dois formulários funcionam e têm bons cuidados: validação por etapa, retomada de anexos, compressão de foto
no celular, aviso de erro que rola até o campo e números humanos (REQ-AAAA-NNNN). Os problemas se concentram
em três pontos:

1. **A regra mora só no navegador.** O servidor da admissão não confere os documentos obrigatórios: **2 formulários
   foram enviados sem nenhum documento do candidato**. O envio também não tem trava contra clique duplo.
2. **O candidato perde o que digitou.** As respostas só são gravadas no envio final. Quem fecha a aba volta com
   os arquivos guardados, mas digita tudo de novo. **2 links venceram com documentos anexados e sem envio.**
3. **Os campos não usam os cadastros.** "Empresa / Unidade" e "Área" da solicitação são texto livre, e já há
   variações ("WG Baterias Maringá" × "Maringá", "logistica" × "Logística"). Na admissão, o candidato
   responde sobre o próprio cargo (motorista/operador, calça e bota), algo que o RH já sabe.

---

## 2. Quem usa cada formulário

| Formulário | Persona | O que precisa |
|---|---|---|
| Admissão digital | **Candidato aprovado**, quase sempre no celular, com documentos em foto | Terminar em uma sessão ou continuar de onde parou, entender exatamente o que falta e ter certeza de que enviou |
| Admissão digital | **Analista de G&G** (recebe) | Dados completos e corretos sem precisar pedir de novo pelo WhatsApp |
| Abertura de vaga | **Gestor de unidade**, sem login no portal | Pedir a contratação em poucos minutos e acompanhar o pedido por e-mail |
| Abertura de vaga | **Analista de G&G** (valida) | Pedido padronizado, que vire vaga e depois admissão sem redigitar |

**Job principal (admissão):** *quando sou aprovado, quero mandar meus documentos pelo celular sem ter que
recomeçar, para garantir minha data de início.*
**Job principal (abertura):** *quando alguém sai da equipe, quero pedir a reposição rápido e saber quando a
vaga foi aberta.*

---

## 3. Achados: formulário de admissão digital

Severidade: **Alta** (dado errado ou fluxo quebrado) · **Média** (confunde ou gera retrabalho) · **Baixa** (polimento).

| # | Sev. | Achado | Evidência | Recomendação |
|---|------|--------|-----------|--------------|
| A1 | **Alta** | **O servidor não confere documentos obrigatórios.** A obrigatoriedade (e quais documentos aparecem por gênero, estado civil, filhos etc.) é checada só no navegador | `submit/route.ts` valida os dados pessoais, mas não os anexos; **2 envios sem nenhum anexo do candidato** em produção | No `submit`, recalcular `getVisibleDocuments()` com as respostas recebidas e recusar (422, com a lista do que falta) se faltar documento obrigatório |
| A2 | **Alta** | **As respostas não são salvas até o envio final.** A retomada guarda só os arquivos ("Preencha seus dados de novo") | 2 links vencidos com anexos e sem envio; o formulário tem 3 etapas antes da confirmação | Salvar rascunho das etapas 1 e 2 (no `localStorage` do aparelho, ou em coluna própria no servidor) e restaurar ao reabrir |
| A3 | **Alta** | **Link de 7 dias sem renovação automática.** Quem anexou documentos e não terminou fica travado depois do prazo | `DIGITAL_FORM_EXPIRY_DAYS = 7`; 2 casos travados | Estender o prazo automaticamente a cada upload (ex.: +7 dias a partir da última atividade) e incluir "link vence em X dias" no resumo diário de formulários parados |
| A4 | Média | **Envio duplo possível.** O UPDATE não tem `digitalFormSubmittedAt is null` no WHERE | Dois cliques rápidos ou dois aparelhos geram 2 e-mails ao RH e 2 registros de atividade | Compare-and-swap no UPDATE (o padrão já usado no resto do projeto) |
| A5 | Média | **Erro de validação do servidor é genérico.** O 422 devolve só "Dados inválidos." | Ex.: telefone aceito no navegador com 10 dígitos e regras diferentes no servidor (mínimo 8) | Devolver o campo com problema e mostrar a mensagem nele, como no formulário de abertura de vaga |
| A6 | Média | **O candidato responde sobre o próprio cargo.** "É motorista ou operador?" e "Não utilizarei calça e bota (cargo administrativo)" são decisões do RH | A admissão já tem o cargo (`positionId`) | Derivar do cargo (ex.: marcar no cadastro de Cargos se exige MOPP/empilhadeira e uniforme operacional) e não perguntar |
| A7 | Média | **"Motorista ou operador" junta dois documentos diferentes.** Quem responde "sim" vê MOPP **e** empilhadeira | Configuração padrão: os dois documentos com a mesma condição | Separar as condições (motorista → MOPP + CNH; operador → empilhadeira), idealmente pelo cargo (A6) |
| A8 | Média | **Documentos condicionais nunca são obrigatórios.** Reservista (homens), certidão de casamento, documentos dos filhos | Todos os condicionais estão sem `*` | Rever com o DP quais são obrigatórios quando a condição vale (ex.: reservista para homens de 18 a 45 anos) |
| A9 | Média | **Regra de cônjuge inconsistente.** "RG/CNH do cônjuge" aparece só para Casado(a); a certidão aparece para Casado(a) e União estável | Configuração padrão | Pedir o documento do cônjuge também em União estável (ou explicar a diferença) |
| A10 | Média | **Validação por IA vira ruído.** 77% dos documentos ficam "precisa de revisão" | `aiStatus`: 237 needs_review × 70 approved | Medir o motivo (foto, tipo, leitura); se não cair, mostrar ao RH só os casos com problema claro, em vez de marcar quase tudo |
| A11 | Baixa | **Telefone de contato fixo no código** nas telas de link inválido/expirado, separado do "Telefone de contato" configurável | `page.tsx` tem "(41) 99817-0054" escrito à mão | Ler de `config.success.contactPhone` |
| A12 | Baixa | **Acessibilidade e preenchimento automático.** Os rótulos não estão ligados aos campos e não há `autocomplete` (nome, e-mail, telefone, nascimento) | Labels sem `htmlFor` | Ligar `label`↔`input` e usar `autocomplete="name|email|tel|bday"`; rolar até o primeiro erro, como na solicitação |
| A13 | Baixa | **Data de nascimento sem checagem.** Aceita data futura ou idade impossível | Só verifica se está preenchida | Recusar data futura e idade abaixo de 14 anos (aprendiz) |
| A14 | Baixa | **Vínculo do documento pelo nome exato** do tipo de documento. Renomear um tipo em Cadastros quebra o vínculo sem aviso | Hoje todos os 14 documentos batem com o cadastro | Guardar o id do tipo na configuração ou avisar no editor quando um nome não existir no cadastro |
| A15 | Baixa | **Título "Admissão Digital"** em caixa de título | Configuração padrão | "Admissão digital" |

## 4. Achados: formulário de abertura de vaga

| # | Sev. | Achado | Evidência | Recomendação |
|---|------|--------|-----------|--------------|
| S1 | **Alta** | **Formulário público sem proteção contra robô.** Qualquer pessoa cria solicitações e dispara e-mails ao RH; só há limite em memória de 5 por minuto por IP | `/api/job-requests` sem reCAPTCHA; os gestores não têm login | Usar o mesmo reCAPTCHA da candidatura (modo de aviso) ou um campo-isca; o limite em memória não vale entre instâncias |
| S2 | **Alta** | **"Empresa / Unidade" e "Área" são texto livre**, enquanto existem os cadastros de Empresas e Filiais | Variações já gravadas: "WG Baterias Maringá" × "Maringá", "logistica" × "Logística" | Trocar por seleção das Filiais ativas (e áreas padronizadas); o valor segue para a vaga e depois para a admissão |
| S3 | Média | **Motivo "Temporária" e tipo "Temporário"** se sobrepõem | Duas perguntas para a mesma informação | Tirar "Temporária" dos motivos (o tipo de contratação já diz) ou exigir coerência entre os dois |
| S4 | Média | **Data desejada aceita o passado** | Só verifica o formato | Recusar data anterior a hoje e avisar quando faltarem menos de 15 dias (prazo realista de recrutamento) |
| S5 | Média | **O gestor não recebe confirmação no envio.** A tela promete "Você receberá um e-mail a cada etapa", mas o primeiro e-mail ao gestor só sai quando o RH valida | `notifyRequester` só nas decisões; no POST só o RH é avisado | Enviar ao gestor um "Recebemos sua solicitação REQ-…" no envio, com o resumo |
| S6 | Média | **Mensagem de erro com nome antigo:** "Informe o título da vaga", no campo "Cargo solicitado" | `schema.ts` | "Informe o cargo solicitado" |
| S7 | Baixa | **Data crua no e-mail ao RH** ("2026-11-20") | `route.ts` usa `desiredStartDate` direto | Formatar como 20/11/2026 |
| S8 | Baixa | **"Número de posições (profissionais)"**: rótulo redundante | Tela | "Quantas pessoas" ou "Número de vagas" |
| S9 | Baixa | **Placeholder de e-mail sugere domínio único** (`nome@wgbaterias.com.br`), mas há empresas do grupo com outros domínios | Express, AT Astori | "seu e-mail de trabalho" |
| S10 | Baixa | **Nenhuma pergunta complementar configurada.** A página Configurações › Solicitação de vaga existe, mas está vazia | `fields = []` | Avaliar com o RH se falta algo (ex.: requisitos mínimos, se precisa de CNH); se não, tudo bem |

## 5. Incongruências entre os dois formulários e o resto do portal

| # | O que não bate | Onde |
|---|---|---|
| X1 | O **cargo** passa por três textos diferentes: o da solicitação (agora com sugestão do cadastro), o título da vaga (livre) e o cargo da admissão (cadastro). Nada garante que sejam o mesmo | Solicitação → vaga → admissão |
| X2 | A **unidade** é texto na solicitação, `company` na vaga e empresa + filial (cadastro) na admissão | Idem |
| X3 | O formulário de admissão pede de novo **nome, e-mail e telefone** que já vêm da candidatura quando a admissão nasceu do pipeline (só o nome vem preenchido) | `DigitalForm` |
| X4 | A **validação de e-mail e telefone** muda entre portal, cadastro manual, admissão e solicitação (regex próprio, mínimo 8, 10 ou 11 dígitos) | `application-schema.ts`, `DigitalForm`, `submit/route.ts`, `schema.ts` |

## 6. Princípios para corrigir

1. **O servidor decide.** Toda regra que o formulário mostra (obrigatório, condicional, prazo) é reconferida no servidor por uma função pura, como já é feito no workflow da solicitação.
2. **Nada se perde.** Formulário longo salva rascunho; prazo de link se renova com atividade.
3. **Cadastro, não texto.** Cargo, unidade e área vêm dos cadastros; o texto livre fica só para o que é realmente livre.
4. **Não pergunte o que o sistema já sabe.** Cargo, uniforme e dados que vieram da candidatura chegam preenchidos.

## 7. Como medir

- **Envios com documento obrigatório faltando:** alvo 0 (hoje 2).
- **Links vencidos com anexos e sem envio:** alvo 0 (hoje 2).
- **Variações de unidade e área** nas solicitações novas: alvo 0.
- **Documentos marcados "precisa de revisão" pela IA:** acompanhar a queda depois de ajustar (hoje 77%).

## 8. Próximos passos recomendados (ordem)

1. **Servidor confere documentos obrigatórios + trava de envio duplo** (A1, A4, A5): pequeno e de alto impacto.
2. **Rascunho e renovação do link** (A2, A3).
3. **Proteção do formulário de abertura e confirmação ao gestor** (S1, S5).
4. **Unidade e área pelos cadastros** (S2, X2) e **cargo derivando uniforme/documentos** (A6, A7), juntos, porque mexem no cadastro de Cargos.
5. **Pacote de polimento** (A9, A11–A15, S3, S4, S6–S9).
6. **Revisão com o DP** dos documentos condicionais obrigatórios (A8) e da validação por IA (A10).
