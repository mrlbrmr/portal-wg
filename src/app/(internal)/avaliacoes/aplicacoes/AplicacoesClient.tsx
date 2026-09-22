"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Briefcase, Check, Copy, MoreHorizontal, PenLine, Send } from 'lucide-react'
import { ButtonLink, Button, buttonVariants } from '@/components/ui/Button'
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuickFilterChips } from '@/components/ui/FilterPopover'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { CellSub, FilterSelect, SearchField, rowClass, tableShell, tdClass, thClass } from '@/components/internal/avaliacoes/ui'
import {
  APPLICATION_STATUS,
  ASSESSMENT_TYPE_SHORT,
  applicationStatus,
  isBehavioral,
  type ApplicationStatusKey,
} from '@/lib/avaliacoes/presentation'
import type { AssessmentSessionRow } from '@/lib/avaliacoes/sessions'
import { cn, formatDate, normalizeText } from '@/lib/utils'

type StatusFilter = 'ALL' | ApplicationStatusKey
type TypeFilter = 'ALL' | 'TECHNICAL' | 'BEHAVIORAL'

const STATUS_ORDER: ApplicationStatusKey[] = ['NOT_STARTED', 'IN_PROGRESS', 'AWAITING_GRADING', 'COMPLETED', 'EXPIRED', 'INVALIDATED']

interface Props {
  sessions: AssessmentSessionRow[]
  canManage: boolean
  initialTemplateId?: string
  initialStatus?: string
}

export function AplicacoesClient({ sessions, canManage, initialTemplateId, initialStatus }: Props) {
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>(
    STATUS_ORDER.includes(initialStatus as ApplicationStatusKey) ? (initialStatus as ApplicationStatusKey) : 'ALL'
  )
  const [type, setType] = useState<TypeFilter>('ALL')
  const [templateId, setTemplateId] = useState(initialTemplateId ?? 'ALL')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // O status é calculado uma vez por renderização do servidor (expiração depende de "agora").
  const rows = useMemo(() => {
    const now = new Date()
    return sessions.map((s) => ({ ...s, status: applicationStatus(s, s.assessmentType, now) }))
  }, [sessions])

  const templates = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sessions) map.set(s.templateId, s.templateName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [sessions])

  // Base para as contagens dos chips: todos os filtros, exceto o próprio status.
  const base = useMemo(() => {
    const q = normalizeText(search)
    return rows.filter((s) => {
      if (templateId !== 'ALL' && s.templateId !== templateId) return false
      if (type === 'BEHAVIORAL' && !isBehavioral(s.assessmentType)) return false
      if (type === 'TECHNICAL' && isBehavioral(s.assessmentType)) return false
      if (q && !normalizeText(`${s.candidateName} ${s.candidateEmail} ${s.jobTitle ?? ''} ${s.templateName}`).includes(q)) return false
      return true
    })
  }, [rows, search, type, templateId])

  const visible = status === 'ALL' ? base : base.filter((s) => s.status === status)

  const chipOptions: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: 'ALL', label: 'Todas', count: base.length },
    ...STATUS_ORDER.map((k) => ({ value: k as StatusFilter, label: APPLICATION_STATUS[k].label, count: base.filter((s) => s.status === k).length }))
      // "Aguardando correção" e "Invalidado" só aparecem quando existem.
      .filter((o) => o.count > 0 || (o.value !== 'AWAITING_GRADING' && o.value !== 'INVALIDATED') || o.value === status),
  ]

  const copyLink = (s: AssessmentSessionRow) => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}/avaliacao/${s.token}`)
      .then(() => {
        setCopiedId(s.id)
        notify('success', 'Link da avaliação copiado.')
        setTimeout(() => setCopiedId((id) => (id === s.id ? null : id)), 2000)
      })
      .catch(() => notify('error', 'Não foi possível copiar o link.'))
  }

  function menuItems(s: (typeof rows)[number]): DropdownMenuItem[] {
    const items: DropdownMenuItem[] = []
    if (s.submittedAt) {
      items.push({ label: 'Abrir resultado', icon: BarChart3, href: `/avaliacoes/resultados/${s.id}` })
      if (s.status === 'AWAITING_GRADING' && canManage) {
        items.push({ label: 'Corrigir dissertativas', icon: PenLine, href: `/avaliacoes/resultados/${s.id}#correcao` })
      }
    } else if (s.status === 'NOT_STARTED' || s.status === 'IN_PROGRESS') {
      items.push({ label: copiedId === s.id ? 'Link copiado' : 'Copiar link', icon: copiedId === s.id ? Check : Copy, onSelect: () => copyLink(s) })
    }
    if (s.jobId) items.push({ label: 'Ver candidatos da vaga', icon: Briefcase, href: `/vagas/${s.jobId}/candidatos` })
    return items
  }

  const hasFilter = search !== '' || type !== 'ALL' || templateId !== 'ALL' || status !== 'ALL'
  const clearFilters = () => { setSearch(''); setType('ALL'); setTemplateId('ALL'); setStatus('ALL') }

  if (sessions.length === 0) {
    return (
      <div className={tableShell}>
        <EmptyState
          icon={Send}
          title="Nenhuma avaliação enviada ainda."
          description="Envie um teste pelo Quick View do candidato, no pipeline da vaga. Cada envio aparece aqui com o andamento."
          action={<ButtonLink href="/vagas/gerenciar" variant="secondary">Ir para as vagas</ButtonLink>}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar candidato, vaga ou avaliação..." className="max-w-md" />
        <FilterSelect<TypeFilter>
          label="Tipo"
          value={type}
          onChange={setType}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'TECHNICAL', label: 'Técnico' },
            { value: 'BEHAVIORAL', label: 'Comportamental' },
          ]}
        />
        {templates.length > 1 && (
          <FilterSelect
            label="Avaliação"
            value={templateId}
            onChange={setTemplateId}
            options={[{ value: 'ALL', label: 'Todas' }, ...templates.map(([id, name]) => ({ value: id, label: name }))]}
          />
        )}
      </div>

      <div className="mb-4">
        <QuickFilterChips<StatusFilter> label="Filtrar por status" options={chipOptions} value={status} onChange={setStatus} />
      </div>

      {visible.length === 0 ? (
        <div className={tableShell}>
          <EmptyState
            compact
            title="Nenhuma aplicação encontrada."
            description="Nenhum envio corresponde à busca ou aos filtros aplicados."
            action={hasFilter ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : undefined}
          />
        </div>
      ) : (
        <div className={tableShell}>
          <table className="w-full text-body">
            <thead className="border-b border-wg-border-lighter bg-[#FAFCF6]">
              <tr>
                <th scope="col" className={thClass}>Candidato</th>
                <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Vaga</th>
                <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Avaliação</th>
                <th scope="col" className={cn(thClass, 'hidden xl:table-cell')}>Tipo</th>
                <th scope="col" className={cn(thClass, 'hidden sm:table-cell')}>Enviado em</th>
                <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Prazo</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={cn(thClass, 'w-12')}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wg-border-lighter">
              {visible.map((s) => {
                const st = APPLICATION_STATUS[s.status]
                const resultHref = s.submittedAt ? `/avaliacoes/resultados/${s.id}` : null
                return (
                  <tr key={s.id} className={rowClass}>
                    <td className={cn(tdClass, 'min-w-[180px]')}>
                      {resultHref ? (
                        <Link href={resultHref} className="font-semibold text-wg-ink hover:underline">{s.candidateName}</Link>
                      ) : (
                        <span className="font-semibold text-wg-ink">{s.candidateName}</span>
                      )}
                      {/* Em telas menores, avaliação e vaga descem para a linha de apoio. */}
                      <CellSub className="md:hidden">{s.templateName}{s.jobTitle ? ` · ${s.jobTitle}` : ''}</CellSub>
                      <CellSub className="hidden md:block lg:hidden">{s.jobTitle ?? s.candidateEmail}</CellSub>
                      <CellSub className="hidden lg:block">{s.candidateEmail}</CellSub>
                    </td>
                    <td className={cn(tdClass, 'hidden lg:table-cell text-wg-ink-secondary')}>
                      {s.jobTitle ?? <span className="text-wg-ink-muted">—</span>}
                    </td>
                    <td className={cn(tdClass, 'hidden md:table-cell text-wg-ink-secondary')}>
                      {s.templateName}
                      <CellSub className="xl:hidden">{ASSESSMENT_TYPE_SHORT[s.assessmentType]}</CellSub>
                    </td>
                    <td className={cn(tdClass, 'hidden xl:table-cell whitespace-nowrap text-wg-ink-secondary')}>
                      {ASSESSMENT_TYPE_SHORT[s.assessmentType]}
                    </td>
                    <td className={cn(tdClass, 'hidden sm:table-cell whitespace-nowrap tabular-nums text-wg-ink-secondary')}>
                      {formatDate(s.createdAt)}
                    </td>
                    <td className={cn(tdClass, 'hidden lg:table-cell whitespace-nowrap tabular-nums text-wg-ink-secondary')}>
                      {s.expiresAt ? formatDate(s.expiresAt) : <span className="text-wg-ink-muted">Sem prazo</span>}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge tone={st.tone} hint={st.hint}>{st.label}</StatusBadge>
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <DropdownMenu
                        portal
                        ariaLabel={`Ações da avaliação de ${s.candidateName}`}
                        title="Ações"
                        trigger={<MoreHorizontal aria-hidden />}
                        triggerClassName={buttonVariants({ variant: 'tertiary', size: 'icon-sm' })}
                        items={menuItems(s)}
                        disabled={menuItems(s).length === 0}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
