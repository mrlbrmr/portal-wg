import type { Question, TemplateKind } from './schema'

const u = () => crypto.randomUUID()

export interface TemplateRepositoryItem {
  key: string
  name: string
  description: string
  kind: TemplateKind
  subtype: string | null
  estimatedMin: number
  instructions: string
  passingScore: number | null
  questions: Question[]
}

// ─── IPIP-50 Big Five (ordem intercalada por dimensão) ──────────────────────

const IPIP50_QUESTIONS: Question[] = [
  // Rodada 1
  { id: u(), type: 'SCALE_LIKERT', text: 'Sou a alma das festas.', bigFiveDimension: 'E', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Me preocupo pouco com os outros.', bigFiveDimension: 'A', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Estou sempre preparado(a).', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Me estresso facilmente.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho um vocabulário rico.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 2
  { id: u(), type: 'SCALE_LIKERT', text: 'Raramente falo muito.', bigFiveDimension: 'E', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Me interesso genuinamente pelas pessoas.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Espalho minhas coisas por todos os lados.', bigFiveDimension: 'C', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Estou relaxado(a) na maior parte do tempo.', bigFiveDimension: 'N', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho dificuldade para entender ideias abstratas.', bigFiveDimension: 'O', isReversed: true, weight: 1 },
  // Rodada 3
  { id: u(), type: 'SCALE_LIKERT', text: 'Me sinto à vontade perto de outras pessoas.', bigFiveDimension: 'E', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Insulto as pessoas.', bigFiveDimension: 'A', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Presto atenção aos detalhes.', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Fico preocupado(a) com as coisas.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho uma imaginação vívida.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 4
  { id: u(), type: 'SCALE_LIKERT', text: 'Prefiro ficar em segundo plano.', bigFiveDimension: 'E', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Simpatizo com os sentimentos dos outros.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Costumo bagunçar as coisas.', bigFiveDimension: 'C', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Raramente me sinto para baixo.', bigFiveDimension: 'N', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Não me interesso por ideias abstratas.', bigFiveDimension: 'O', isReversed: true, weight: 1 },
  // Rodada 5
  { id: u(), type: 'SCALE_LIKERT', text: 'Costumo iniciar conversas.', bigFiveDimension: 'E', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Não me interesso pelos problemas alheios.', bigFiveDimension: 'A', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Resolvo tarefas imediatamente.', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Me perturbo facilmente.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho excelentes ideias.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 6
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho pouco a dizer em conversas.', bigFiveDimension: 'E', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho um coração bondoso.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Com frequência esqueço de colocar as coisas no lugar certo.', bigFiveDimension: 'C', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Fico chateado(a) facilmente.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Não tenho uma boa imaginação.', bigFiveDimension: 'O', isReversed: true, weight: 1 },
  // Rodada 7
  { id: u(), type: 'SCALE_LIKERT', text: 'Converso com muitas pessoas diferentes em festas.', bigFiveDimension: 'E', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Na verdade, não tenho muito interesse pelas outras pessoas.', bigFiveDimension: 'A', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Gosto de ordem e organização.', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Meu humor muda com muita frequência.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Entendo as coisas rapidamente.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 8
  { id: u(), type: 'SCALE_LIKERT', text: 'Não gosto de chamar atenção para mim.', bigFiveDimension: 'E', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Reservo tempo para ajudar os outros.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Evito minhas responsabilidades.', bigFiveDimension: 'C', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Tenho oscilações de humor frequentes.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Uso palavras elaboradas e precisas.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 9
  { id: u(), type: 'SCALE_LIKERT', text: 'Não me importo de ser o centro das atenções.', bigFiveDimension: 'E', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Percebo as emoções das pessoas ao meu redor.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Sigo um cronograma.', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Me irrito facilmente.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Passo tempo refletindo sobre as coisas.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
  // Rodada 10
  { id: u(), type: 'SCALE_LIKERT', text: 'Sou quieto(a) perto de pessoas que não conheço.', bigFiveDimension: 'E', isReversed: true, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Faço as pessoas se sentirem à vontade.', bigFiveDimension: 'A', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Sou rigoroso(a) no que faço.', bigFiveDimension: 'C', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Com frequência me sinto para baixo.', bigFiveDimension: 'N', isReversed: false, weight: 1 },
  { id: u(), type: 'SCALE_LIKERT', text: 'Sou cheio(a) de ideias.', bigFiveDimension: 'O', isReversed: false, weight: 1 },
]

// ─── Português Básico ───────────────────────────────────────────────────────

const PORT_BASICO_QUESTIONS: Question[] = [
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual é o plural correto de "pão"?',
    options: ['Pões', 'Pãos', 'Pães', 'Pãoes'],
    correctAnswer: 'Pães', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Assinale a alternativa com a ortografia correta:',
    options: ['Excessão', 'Exceção', 'Ecceção', 'Exeção'],
    correctAnswer: 'Exceção', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Complete a frase: "Quando ele chegou, Maria _____ estudando."',
    options: ['estava', 'esteve', 'é', 'fosse'],
    correctAnswer: 'estava', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual é o antônimo (palavra de sentido oposto) de "benévolo"?',
    options: ['Bondoso', 'Caridoso', 'Malévolo', 'Altruísta'],
    correctAnswer: 'Malévolo', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Identifique o sujeito da frase: "Os alunos estudaram muito."',
    options: ['muito', 'Os alunos', 'estudaram', 'alunos'],
    correctAnswer: 'Os alunos', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual das frases abaixo está correta?',
    options: ['"Eu vou ir na praia."', '"Eu vou ir à praia."', '"Eu vou à praia."', '"Eu vou na praia."'],
    correctAnswer: '"Eu vou à praia."', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Na frase "A maçã que comprei estava estragada", o pronome relativo "que" refere-se a:',
    options: ['estragada', 'maçã', 'comprei', 'estava'],
    correctAnswer: 'maçã', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual é a forma correta?',
    options: ['meia-dia', 'meio-dia', 'meiodia', 'meia dia'],
    correctAnswer: 'meio-dia', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Complete corretamente: "Não sei se ele _____ amanhã."',
    options: ['vem', 'vêm', 'veem', 'véem'],
    correctAnswer: 'vem', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual das palavras abaixo é um adjetivo?',
    options: ['correr', 'rapidez', 'ágil', 'agilidade'],
    correctAnswer: 'ágil', weight: 1,
  },
]

// ─── Português Intermediário ────────────────────────────────────────────────

const PORT_INTERMEDIARIO_QUESTIONS: Question[] = [
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Assinale a frase em que a crase está empregada corretamente:',
    options: [
      'Fui à reunião às pressas.',
      'Refiro-me à aquele funcionário.',
      'Chegaremos à tempo.',
      'Pedimos à todos que colaborassem.',
    ],
    correctAnswer: 'Fui à reunião às pressas.', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Em "Os documentos foram analisados pela equipe.", a voz verbal é:',
    options: ['Ativa', 'Passiva analítica', 'Passiva sintética', 'Reflexiva'],
    correctAnswer: 'Passiva analítica', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual alternativa apresenta concordância verbal correta?',
    options: [
      'Faz dois anos que não o vejo.',
      'Fazem dois anos que não o vejo.',
      'Faz dois anos que não os vejo.',
      'Fazem dois anos que não os vejo.',
    ],
    correctAnswer: 'Faz dois anos que não o vejo.', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: '"Ele assistiu o jogo ontem." — Qual é o erro desta frase?',
    options: [
      'Concordância verbal',
      'Regência verbal: "assistir" exige preposição "a"',
      'Ortografia de "assistiu"',
      'Não há erro',
    ],
    correctAnswer: 'Regência verbal: "assistir" exige preposição "a"', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Identifique a oração subordinada adverbial causal em:',
    options: [
      '"Ele saiu porque estava cansado."',
      '"Ele saiu antes de terminar."',
      '"Ele saiu quando todos dormiram."',
      '"Ele saiu para descansar."',
    ],
    correctAnswer: '"Ele saiu porque estava cansado."', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual pronome substitui corretamente "os clientes" em "Atendemos os clientes ontem"?',
    options: ['os', 'lhes', 'se', 'nos'],
    correctAnswer: 'os', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual a função sintática de "rapidamente" em "Ela respondeu rapidamente"?',
    options: ['Adjunto adnominal', 'Predicativo do sujeito', 'Adjunto adverbial de modo', 'Complemento nominal'],
    correctAnswer: 'Adjunto adverbial de modo', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: '"Malgrado as dificuldades, ele persistiu." O termo destacado equivale a:',
    options: ['Apesar das', 'Por causa das', 'Em virtude das', 'Com base nas'],
    correctAnswer: 'Apesar das', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Em qual frase há emprego correto do "porquê"?',
    options: [
      'Não sei o porquê de sua ausência.',
      'Ele saiu porquê estava cansado.',
      'Por quê motivo você chegou tarde?',
      'Porque você não veio ontem?',
    ],
    correctAnswer: 'Não sei o porquê de sua ausência.', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual figura de linguagem está presente em "A vida é uma viagem sem destino certo"?',
    options: ['Metonímia', 'Metáfora', 'Hipérbole', 'Ironia'],
    correctAnswer: 'Metáfora', weight: 1,
  },
  {
    id: u(), type: 'TRUE_FALSE',
    text: 'A frase "Ele se feriu" está na voz passiva sintética.',
    correctAnswer: 'Verdadeiro', weight: 1,
    options: ['Verdadeiro', 'Falso'],
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Assinale a alternativa em que todas as palavras estão acentuadas corretamente:',
    options: ['pátio, órfão, bênção', 'patio, orfão, benção', 'pátio, orfão, bênção', 'patio, órfão, benção'],
    correctAnswer: 'pátio, órfão, bênção', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual é o grau superlativo absoluto sintético de "bom"?',
    options: ['Bom demais', 'Muito bom', 'Ótimo', 'O melhor'],
    correctAnswer: 'Ótimo', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Em "Comprei leite, pão e manteiga", a vírgula:',
    options: [
      'Separa orações subordinadas',
      'Marca uma aposto explicativo',
      'Separa termos de uma enumeração',
      'Isola um adjunto adverbial',
    ],
    correctAnswer: 'Separa termos de uma enumeração', weight: 1,
  },
  {
    id: u(), type: 'SHORT_TEXT',
    text: 'Reescreva a frase a seguir na voz passiva analítica: "O gerente assinou o contrato."',
    weight: 2,
  },
]

// ─── Excel Básico ────────────────────────────────────────────────────────────

const EXCEL_BASICO_QUESTIONS: Question[] = [
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual função do Excel calcula a média de um intervalo de células?',
    options: ['=SOMA()', '=MÉDIA()', '=CONT.VALORES()', '=MÁXIMO()'],
    correctAnswer: '=MÉDIA()', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para fixar o endereço de uma célula em uma fórmula (referência absoluta), usa-se o símbolo:',
    options: ['*', '#', '$', '@'],
    correctAnswer: '$', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual atalho de teclado copia a célula selecionada no Excel?',
    options: ['Ctrl+X', 'Ctrl+V', 'Ctrl+C', 'Ctrl+Z'],
    correctAnswer: 'Ctrl+C', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'A fórmula =SE(A1>10;"Aprovado";"Reprovado") retorna qual valor quando A1 = 15?',
    options: ['Reprovado', '10', 'Aprovado', '#ERRO!'],
    correctAnswer: 'Aprovado', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual função conta o número de células não vazias em um intervalo?',
    options: ['=CONT.SE()', '=CONTAR()', '=CONT.VALORES()', '=SOMA()'],
    correctAnswer: '=CONT.VALORES()', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para inserir um gráfico no Excel, qual guia da faixa de opções deve ser acessada?',
    options: ['Fórmulas', 'Inserir', 'Dados', 'Página Inicial'],
    correctAnswer: 'Inserir', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'O que a fórmula =SOMA(A1:A5) calcula?',
    options: [
      'Apenas A1 e A5',
      'A soma dos valores de A1 até A5',
      'A média de A1 a A5',
      'O maior valor entre A1 e A5',
    ],
    correctAnswer: 'A soma dos valores de A1 até A5', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para confirmar uma entrada e permanecer na mesma célula, usa-se:',
    options: ['Enter', 'Tab', 'Ctrl+Enter', 'Esc'],
    correctAnswer: 'Ctrl+Enter', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para ordenar dados de A a Z no Excel, o caminho correto é:',
    options: [
      'Inserir > Classificar',
      'Dados > Classificar e Filtrar',
      'Página Inicial > Células',
      'Fórmulas > Mais Funções',
    ],
    correctAnswer: 'Dados > Classificar e Filtrar', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual formato de célula exibe números como porcentagem?',
    options: ['Moeda', 'Número', 'Porcentagem', 'Contábil'],
    correctAnswer: 'Porcentagem', weight: 1,
  },
]

// ─── Excel Intermediário ─────────────────────────────────────────────────────

const EXCEL_INTERMEDIARIO_QUESTIONS: Question[] = [
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'A função =PROCV(valor;tabela;col;0) retorna #N/D quando:',
    options: [
      'O valor buscado não existe na primeira coluna da tabela',
      'A tabela está em outra planilha',
      'O número de coluna é maior que 255',
      'O último argumento é 0',
    ],
    correctAnswer: 'O valor buscado não existe na primeira coluna da tabela', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual combinação de funções substitui PROCV e permite busca em qualquer direção?',
    options: ['=SOMA()+MÉDIA()', '=ÍNDICE()+CORRESP()', '=SE()+CONT.SE()', '=DESLOC()+ESCOLHER()'],
    correctAnswer: '=ÍNDICE()+CORRESP()', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Em uma Tabela Dinâmica, qual área deve receber um campo numérico para ser somado?',
    options: ['Filtros', 'Colunas', 'Linhas', 'Valores'],
    correctAnswer: 'Valores', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'A fórmula =CONT.SE(A1:A100;">=500") conta:',
    options: [
      'Células com texto ">=500"',
      'Células com valores maiores ou iguais a 500',
      'Células com o número exato 500',
      'Células vazias no intervalo',
    ],
    correctAnswer: 'Células com valores maiores ou iguais a 500', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual função retorna a posição relativa de um valor em um intervalo?',
    options: ['=ÍNDICE()', '=CORRESP()', '=PROCV()', '=DESLOC()'],
    correctAnswer: '=CORRESP()', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para proteger células específicas de uma planilha contra edição, o passo final é:',
    options: [
      'Formatar > Células > Proteção > marcar "Bloqueada"',
      'Revisão > Proteger Planilha (após desmarcar "Bloqueada" nas células livres)',
      'Dados > Validação de Dados > bloquear intervalo',
      'Página Inicial > Formatar > Bloquear Célula',
    ],
    correctAnswer: 'Revisão > Proteger Planilha (após desmarcar "Bloqueada" nas células livres)', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'O que faz a função =SEERRO(PROCV(A1;B:C;2;0);"Não encontrado")?',
    options: [
      'Soma o resultado do PROCV com "Não encontrado"',
      'Retorna "Não encontrado" se o PROCV gerar qualquer erro',
      'Apenas oculta o erro sem substituir',
      'Converte o resultado para texto',
    ],
    correctAnswer: 'Retorna "Não encontrado" se o PROCV gerar qualquer erro', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Qual atalho cria um gráfico em uma nova aba a partir de dados selecionados?',
    options: ['F1', 'F11', 'Alt+F1', 'Ctrl+G'],
    correctAnswer: 'F11', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'Para consolidar dados de várias planilhas na mesma pasta de trabalho, usa-se:',
    options: [
      'Inserir > Tabela Dinâmica com múltiplos intervalos de consolidação',
      'Dados > Consolidar',
      'Fórmulas > Gerenciador de Nomes',
      'Revisão > Comparar e Mesclar Pastas de Trabalho',
    ],
    correctAnswer: 'Dados > Consolidar', weight: 1,
  },
  {
    id: u(), type: 'MULTIPLE_CHOICE',
    text: 'O que o símbolo "@" representa em fórmulas de Tabela Estruturada do Excel?',
    options: [
      'Referência a célula absoluta',
      'Linha atual da tabela (referência implícita)',
      'Nome de intervalo dinâmico',
      'Função de concatenação',
    ],
    correctAnswer: 'Linha atual da tabela (referência implícita)', weight: 1,
  },
  {
    id: u(), type: 'SHORT_TEXT',
    text: 'Explique com suas palavras a diferença entre =PROCV() e =ÍNDICE()+CORRESP() e cite uma vantagem da segunda abordagem.',
    weight: 2,
  },
  {
    id: u(), type: 'SHORT_TEXT',
    text: 'Descreva os passos para criar uma Tabela Dinâmica a partir de um intervalo de dados e adicionar um campo de soma de valores.',
    weight: 2,
  },
]

// ─── Exportação do repositório ───────────────────────────────────────────────

export const REPOSITORY_TEMPLATES: TemplateRepositoryItem[] = [
  {
    key: 'BIG5_IPIP50',
    name: 'Personalidade Big Five — IPIP-50',
    description: 'Instrumento validado internacionalmente (Goldberg, 1992) com 50 afirmações que medem os cinco grandes fatores de personalidade: Abertura, Conscienciosidade, Extroversão, Amabilidade e Neuroticismo. Adaptado para o português brasileiro.',
    kind: 'PERSONALITY_BIG5',
    subtype: null,
    estimatedMin: 12,
    instructions: 'Para cada afirmação abaixo, indique o quanto ela descreve você habitualmente, em uma escala de 1 (Discordo totalmente) a 5 (Concordo totalmente). Não há respostas certas ou erradas — responda com sinceridade.',
    passingScore: null,
    questions: IPIP50_QUESTIONS,
  },
  {
    key: 'PORT_BASICO',
    name: 'Português — Nível Básico',
    description: '10 questões de múltipla escolha cobrindo ortografia, plural, concordância, crase e classes gramaticais. Adequado para vagas operacionais e administrativas iniciais.',
    kind: 'TECHNICAL',
    subtype: 'PORTUGUESE',
    estimatedMin: 10,
    instructions: 'Leia cada questão com atenção e marque a alternativa correta. Você tem 10 minutos para concluir o teste.',
    passingScore: 60,
    questions: PORT_BASICO_QUESTIONS,
  },
  {
    key: 'PORT_INTERMEDIARIO',
    name: 'Português — Nível Intermediário',
    description: '14 questões de múltipla escolha e 1 questão dissertativa sobre crase, voz passiva, concordância, regência e figuras de linguagem. Adequado para vagas administrativas e analistas.',
    kind: 'TECHNICAL',
    subtype: 'PORTUGUESE',
    estimatedMin: 20,
    instructions: 'Responda todas as questões. As questões de múltipla escolha valem 1 ponto cada; a questão dissertativa vale 2 pontos. Total: 16 pontos. Você tem 20 minutos.',
    passingScore: 70,
    questions: PORT_INTERMEDIARIO_QUESTIONS,
  },
  {
    key: 'EXCEL_BASICO',
    name: 'Excel — Nível Básico',
    description: '10 questões de múltipla escolha sobre funções básicas (SOMA, MÉDIA, SE), atalhos, gráficos e formatação. Adequado para qualquer vaga que exija uso do pacote Office.',
    kind: 'TECHNICAL',
    subtype: 'EXCEL',
    estimatedMin: 10,
    instructions: 'Leia cada questão com atenção e marque a alternativa correta. Você tem 10 minutos para concluir o teste.',
    passingScore: 60,
    questions: EXCEL_BASICO_QUESTIONS,
  },
  {
    key: 'EXCEL_INTERMEDIARIO',
    name: 'Excel — Nível Intermediário',
    description: '10 questões de múltipla escolha e 2 questões dissertativas cobrindo PROCV, ÍNDICE+CORRESP, CONT.SE, Tabela Dinâmica e proteção de planilhas. Adequado para analistas e funções com tratamento de dados.',
    kind: 'TECHNICAL',
    subtype: 'EXCEL',
    estimatedMin: 25,
    instructions: 'Responda todas as questões. As questões de múltipla escolha valem 1 ponto cada; as questões dissertativas valem 2 pontos cada. Total: 14 pontos. Você tem 25 minutos.',
    passingScore: 70,
    questions: EXCEL_INTERMEDIARIO_QUESTIONS,
  },
]
