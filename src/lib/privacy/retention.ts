// Regras PURAS de retenção LGPD do Banco de Talentos (sem I/O; testadas).
// Ideia adaptada do módulo de retenção do Harly (MIT): só é elegível quem está parado
// há mais que o prazo, sem processo aberto, não contratado e sem bloqueio jurídico.

export const DEFAULT_RETENTION_MONTHS = 24
export const MIN_RETENTION_MONTHS = 6
export const MAX_RETENTION_MONTHS = 120

export const ANON_NAME = 'Candidato anonimizado'

export function anonymizedEmail(id: string): string {
  return `anonimizado+${id}@anonimizado.invalid`
}

export function normalizeRetentionMonths(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_MONTHS
  return Math.min(MAX_RETENTION_MONTHS, Math.max(MIN_RETENTION_MONTHS, Math.round(n)))
}

/** Soma meses (UTC) com ajuste de fim de mês: 31/jan + 1 mês = 28 ou 29/fev. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

export function retentionCutoff(now: Date, months: number): Date {
  return addMonths(now, -months)
}

export interface RetentionSubject {
  anonimizadoEm: string | null
  retencaoBloqueadaEm: string | null
  processosAbertos: number
  contratado: boolean
  /** Existe admissão ligada a uma candidatura da pessoa (vínculo trabalhista). */
  temAdmissao: boolean
  ultimaAtividadeEm: string | null
  ultimaCandidaturaEm: string | null
  createdAt: string
}

export type RetentionBlockReason =
  | 'ANONIMIZADO'
  | 'BLOQUEIO_JURIDICO'
  | 'PROCESSO_ABERTO'
  | 'CONTRATADO'
  | 'DENTRO_DO_PRAZO'

export const RETENTION_REASON_LABEL: Record<RetentionBlockReason, string> = {
  ANONIMIZADO: 'Já anonimizado',
  BLOQUEIO_JURIDICO: 'Bloqueado por motivo jurídico',
  PROCESSO_ABERTO: 'Tem processo seletivo aberto',
  CONTRATADO: 'Foi contratado (vínculo de trabalho)',
  DENTRO_DO_PRAZO: 'Ainda dentro do prazo de retenção',
}

export interface RetentionStatus {
  eligible: boolean
  reason: RetentionBlockReason | null
  lastActivityAt: Date
  /** Quando passa a ser elegível (sem considerar bloqueios). */
  dueAt: Date
}

export function lastActivityAt(s: Pick<RetentionSubject, 'ultimaAtividadeEm' | 'ultimaCandidaturaEm' | 'createdAt'>): Date {
  const times = [s.ultimaAtividadeEm, s.ultimaCandidaturaEm, s.createdAt]
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime())
    .filter((t) => Number.isFinite(t))
  return new Date(Math.max(...times))
}

export function retentionStatus(s: RetentionSubject, now: Date, months: number): RetentionStatus {
  const last = lastActivityAt(s)
  const dueAt = addMonths(last, months)
  const base = { lastActivityAt: last, dueAt }
  if (s.anonimizadoEm) return { ...base, eligible: false, reason: 'ANONIMIZADO' }
  if (s.retencaoBloqueadaEm) return { ...base, eligible: false, reason: 'BLOQUEIO_JURIDICO' }
  if (s.processosAbertos > 0) return { ...base, eligible: false, reason: 'PROCESSO_ABERTO' }
  if (s.contratado || s.temAdmissao) return { ...base, eligible: false, reason: 'CONTRATADO' }
  if (dueAt.getTime() > now.getTime()) return { ...base, eligible: false, reason: 'DENTRO_DO_PRAZO' }
  return { ...base, eligible: true, reason: null }
}
