/**
 * Interpretação do perfil Big Five (IPIP) para o RH — textos e regras de faixa.
 *
 * Princípios (não negociáveis):
 * - É PERFIL, não nota: nada aqui produz score geral, compatibilidade, ranking ou
 *   recomendação de aprovar/reprovar.
 * - Linguagem probabilística ("o resultado sugere", "tende a", "pode apresentar"), nunca
 *   afirmações categóricas sobre a pessoa.
 * - Os "pontos para explorar" são insumos de entrevista, não julgamento de adequação.
 *
 * Escala: o valor de cada dimensão é a média das respostas (1–5) ÷ 5 × 100 — ver
 * `bigFiveProfile()` em scoring.ts. Vai de 20 a 100; 60 corresponde ao ponto neutro da
 * escala ("3 — Neutro"). NÃO é percentil: não há norma populacional de comparação.
 */

export type BigFiveKey = 'O' | 'C' | 'E' | 'A' | 'N'
export type BigFiveBand = 'LOW' | 'MODERATE' | 'HIGH'
export type BigFiveScores = Record<BigFiveKey, number | null>

/** Ponto neutro da escala (média 3,0 → 60). */
export const BIG_FIVE_NEUTRAL = 60

/** Faixas: média < 2,5 → baixa; 2,5–3,49 → moderada; ≥ 3,5 → elevada. */
export function bigFiveBand(value: number): BigFiveBand {
  if (value >= 70) return 'HIGH'
  if (value >= 50) return 'MODERATE'
  return 'LOW'
}

interface DimensionInfo {
  key: BigFiveKey
  label: string
  /** Gênero gramatical do nome da dimensão ("Abertura elevada" × "Neuroticismo elevado"). */
  gender: 'f' | 'm'
  measures: string
  interpretation: Record<BigFiveBand, string>
  interview: Record<BigFiveBand, string>
}

export const BIG_FIVE_INFO: DimensionInfo[] = [
  {
    key: 'O',
    label: 'Abertura',
    gender: 'f',
    measures: 'Curiosidade intelectual, imaginação e abertura a novas ideias.',
    interpretation: {
      HIGH: 'O resultado sugere uma tendência elevada à curiosidade, à busca por novas ideias e ao interesse por formas diferentes de fazer as coisas.',
      MODERATE: 'O resultado sugere equilíbrio entre abertura a novidades e preferência por métodos já conhecidos.',
      LOW: 'O resultado sugere preferência por abordagens práticas, conhecidas e já testadas, com menor busca por novidade.',
    },
    interview: {
      HIGH: 'Explore como a pessoa lida com rotinas repetitivas e processos padronizados que não podem ser alterados.',
      MODERATE: 'Explore uma ocasião em que a pessoa propôs uma melhoria e outra em que preferiu manter o método existente — e o que pesou em cada decisão.',
      LOW: 'Explore como a pessoa reage à chegada de ferramentas, sistemas ou processos novos.',
    },
  },
  {
    key: 'C',
    label: 'Conscienciosidade',
    gender: 'f',
    measures: 'Organização, disciplina e responsabilidade.',
    interpretation: {
      HIGH: 'O resultado sugere uma tendência elevada à organização, ao planejamento, à persistência e à orientação para o cumprimento de tarefas.',
      MODERATE: 'O resultado sugere um nível intermediário de estrutura: tende a se organizar quando a tarefa exige, com alguma flexibilidade.',
      LOW: 'O resultado sugere preferência por flexibilidade e espontaneidade, podendo apresentar menor apego a planejamento detalhado e a rotinas.',
    },
    interview: {
      HIGH: 'Explore situações em que a pessoa precisou lidar com mudanças inesperadas de prioridade ou com ambientes pouco estruturados.',
      MODERATE: 'Explore como a pessoa organiza prazos quando várias demandas chegam ao mesmo tempo.',
      LOW: 'Explore como a pessoa acompanha prazos, tarefas recorrentes e detalhes — quais métodos ou ferramentas usa.',
    },
  },
  {
    key: 'E',
    label: 'Extroversão',
    gender: 'f',
    measures: 'Sociabilidade, energia e assertividade.',
    interpretation: {
      HIGH: 'O resultado sugere tendência a buscar interação social, a se expressar com facilidade e a ganhar energia em ambientes dinâmicos.',
      MODERATE: 'O resultado sugere um perfil intermediário: pode transitar entre momentos de interação intensa e de trabalho mais reservado.',
      LOW: 'O resultado sugere preferência por ambientes mais reservados e por interação em grupos menores, com tendência a refletir antes de se expor.',
    },
    interview: {
      HIGH: 'Explore como a pessoa lida com tarefas longas e individuais, com pouca interação.',
      MODERATE: 'Explore como a pessoa se comporta em situações que exigem exposição, negociação ou interação frequente.',
      LOW: 'Explore situações em que a pessoa precisou se expor, negociar ou iniciar contato com desconhecidos.',
    },
  },
  {
    key: 'A',
    label: 'Amabilidade',
    gender: 'f',
    measures: 'Cooperação, empatia e confiança.',
    interpretation: {
      HIGH: 'O resultado sugere tendência à cooperação, à empatia e à busca por harmonia nas relações.',
      MODERATE: 'O resultado sugere equilíbrio entre cooperação e defesa dos próprios pontos de vista.',
      LOW: 'O resultado sugere tendência a uma postura mais direta e questionadora, priorizando a objetividade em relação à busca de consenso.',
    },
    interview: {
      HIGH: 'Explore situações em que a pessoa precisou dizer não, dar um retorno difícil ou defender uma posição contrária à do grupo.',
      MODERATE: 'Explore como a pessoa conduz divergências com colegas ou clientes.',
      LOW: 'Explore como a pessoa constrói colaboração e lida com situações que pedem acolhimento ou paciência com o outro.',
    },
  },
  {
    key: 'N',
    label: 'Neuroticismo',
    gender: 'm',
    measures: 'Reatividade emocional e sensibilidade ao estresse.',
    interpretation: {
      HIGH: 'O resultado sugere maior sensibilidade à pressão e a situações de incerteza, podendo apresentar reações emocionais mais intensas ao estresse.',
      MODERATE: 'O resultado sugere reatividade emocional intermediária: tende a manter a estabilidade na maior parte das situações, com oscilações sob pressão intensa.',
      LOW: 'O resultado sugere tendência à estabilidade emocional e à calma em situações de pressão.',
    },
    interview: {
      HIGH: 'Explore como a pessoa lida com cobranças, prazos apertados e conflitos — e que estratégias usa para se recuperar.',
      MODERATE: 'Explore uma situação recente de pressão no trabalho e como a pessoa reagiu a ela.',
      LOW: 'Explore como a pessoa percebe e comunica riscos ou problemas — se sinaliza preocupações com antecedência.',
    },
  },
]

const BAND_WORD: Record<BigFiveBand, { f: string; m: string }> = {
  HIGH: { f: 'elevada', m: 'elevado' },
  MODERATE: { f: 'moderada', m: 'moderado' },
  LOW: { f: 'baixa', m: 'baixo' },
}

/** Faixa concordando com o nome da dimensão: "elevada" (Abertura) × "elevado" (Neuroticismo). */
export function bandWord(info: Pick<DimensionInfo, 'gender'>, band: BigFiveBand): string {
  return BAND_WORD[band][info.gender]
}

/** "Conscienciosidade elevada", "Neuroticismo baixo". */
export function bandTitle(info: Pick<DimensionInfo, 'label' | 'gender'>, band: BigFiveBand): string {
  return `${info.label} ${BAND_WORD[band][info.gender]}`
}

/** Rótulo da faixa sozinho ("Tendência elevada"). */
export const BAND_LABEL: Record<BigFiveBand, string> = {
  HIGH: 'Tendência elevada',
  MODERATE: 'Tendência moderada',
  LOW: 'Tendência baixa',
}

export function parseBigFive(breakdown: unknown): BigFiveScores | null {
  const bf = (breakdown as { bigFive?: Record<string, number | null> } | null | undefined)?.bigFive
  if (!bf) return null
  const pick = (k: BigFiveKey) => (typeof bf[k] === 'number' ? (bf[k] as number) : null)
  return { O: pick('O'), C: pick('C'), E: pick('E'), A: pick('A'), N: pick('N') }
}

/**
 * Dimensões que mais se afastam do ponto neutro — as mais informativas do perfil.
 * Serve para resumir a listagem e escolher os pontos de entrevista. Não é ranking do
 * candidato: só ordena as dimensões DELE entre si.
 */
export function salientDimensions(scores: BigFiveScores, limit: number) {
  return BIG_FIVE_INFO.filter((d) => scores[d.key] !== null)
    .map((d) => {
      const value = scores[d.key] as number
      return { info: d, value, band: bigFiveBand(value), distance: Math.abs(value - BIG_FIVE_NEUTRAL) }
    })
    .sort((a, b) => b.distance - a.distance)
    .slice(0, limit)
}

/** Pontos para explorar na entrevista: um por dimensão, das mais salientes para as menos. */
export function interviewPrompts(scores: BigFiveScores, limit = 3) {
  return salientDimensions(scores, limit).map(({ info, band }) => ({
    key: info.key,
    title: bandTitle(info, band),
    text: info.interview[band],
  }))
}
