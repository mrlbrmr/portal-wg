"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive, ArchiveRestore, Copy, Database, Eye, FlaskConical, MoreHorizontal, Pencil, Plus, Send,
} from 'lucide-react'
import { resolveAssessmentType, type AssessmentType } from '@/lib/avaliacoes/schema'
import { criterionLabel, isBehavioral, itemsLabel, templateCategory } from '@/lib/avaliacoes/presentation'
import { PageHeader } from '@/components/internal/PageHeader'
import { Button, ButtonLink, buttonVariants } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/ToastProvider'
import { cn, normalizeText } from '@/lib/utils'
import { RepositoryModal } from './RepositoryModal'
import { CellSub, FilterSelect, SearchField, rowClass, tableShell, tdClass, thClass } from './ui'

export interface TemplateRow {
  id: string
  name: string
  description: string | null
  kind: string
  subtype: string | null
  assessmentType: string | null
  estimatedMin: number | null
  passingScore: number | null
  isActive: boolean
  createdAt: string
  questions: Array<{ type: string }>
  /** Quantas vezes o teste foi enviado a candidatos. */
  applications: number
}

interface Props {
  templates: TemplateRow[]
  canManage: boolean
}

type CategoryFilter = 'ALL' | 'TECHNICAL' | 'BEHAVIORAL'

export function TemplateBancoList({ templates: initial, canManage }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [templates, setTemplates] = useState(initial)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('ALL')
  const [showArchived, setShowArchived] = useState(false)
  const [showRepo, setShowRepo] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<TemplateRow | null>(null)

  const rows = useMemo(
    () => templates.map((t) => ({ ...t, type: resolveAssessmentType(t) as AssessmentType })),
    [templates],
  )
  const archivedCount = rows.filter((t) => !t.isActive).length

  const filtered = useMemo(() => {
    const q = normalizeText(search)
    return rows.filter((t) => {
      if (!showArchived && !t.isActive) return false
      if (category === 'BEHAVIORAL' && !isBehavioral(t.type)) return false
      if (category === 'TECHNICAL' && isBehavioral(t.type)) return false
      if (q && !normalizeText(`${t.name} ${t.description ?? ''}`).includes(q)) return false
      return true
    })
  }, [rows, search, category, showArchived])

  async function setActive(t: TemplateRow, isActive: boolean) {
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/assessment-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error()
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, isActive } : x)))
      notify('success', isActive ? `"${t.name}" foi reativado.` : `"${t.name}" foi arquivado.`)
    } catch {
      notify('error', 'Não foi possível atualizar o teste. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  async function duplicate(t: TemplateRow) {
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/assessment-templates/${t.id}/duplicate`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok || !data.id) throw new Error(data.error)
      notify('success', 'Cópia criada. Ajuste o que precisar e salve.')
      router.push(`/avaliacoes/banco/${data.id}`)
    } catch (e) {
      notify('error', (e as Error).message || 'Não foi possível duplicar o teste.')
      setBusyId(null)
    }
  }

  function menuItems(t: TemplateRow): DropdownMenuItem[] {
    const items: DropdownMenuItem[] = [
      { label: 'Visualizar', icon: Eye, href: `/avaliacoes/banco/${t.id}?modo=visualizar` },
    ]
    if (canManage) {
      items.push(
        { label: 'Editar', icon: Pencil, href: `/avaliacoes/banco/${t.id}` },
        { label: 'Duplicar', icon: Copy, onSelect: () => duplicate(t) },
      )
    }
    items.push({ label: 'Ver aplicações', icon: Send, href: `/avaliacoes/aplicacoes?teste=${t.id}` })
    if (canManage) {
      items.push(
        { type: 'separator' },
        t.isActive
          ? { label: 'Arquivar', icon: Archive, danger: true, onSelect: () => setConfirmArchive(t) }
          : { label: 'Ativar', icon: ArchiveRestore, onSelect: () => setActive(t, true) },
      )
    }
    return items
  }

  const hasFilter = search !== '' || category !== 'ALL'

  return (
    <div>
      <PageHeader
        title="Banco de testes"
        subtitle="Testes técnicos e avaliações comportamentais reutilizáveis entre vagas."
        action={
          canManage ? (
            <>
              <Button variant="secondary" icon={Database} onClick={() => setShowRepo(true)}>
                Importar do repositório
              </Button>
              <ButtonLink href="/avaliacoes/banco/novo" variant="primary" icon={Plus}>
                Novo teste
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar teste..." className="max-w-sm" />
        <FilterSelect<CategoryFilter>
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'ALL', label: 'Todas' },
            { value: 'TECHNICAL', label: 'Técnico' },
            { value: 'BEHAVIORAL', label: 'Comportamental' },
          ]}
        />
        {archivedCount > 0 && (
          <label className="ml-auto flex cursor-pointer select-none items-center gap-2 text-meta text-wg-ink-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded accent-wg-green-dark"
            />
            Mostrar arquivados ({archivedCount})
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={tableShell}>
          <EmptyState
            icon={FlaskConical}
            title="Nenhum teste encontrado."
            description={
              templates.length === 0
                ? 'Crie o primeiro teste ou importe um modelo pronto do repositório.'
                : 'Ajuste a busca ou os filtros para ver outros testes.'
            }
            action={
              templates.length === 0 && canManage ? (
                <ButtonLink href="/avaliacoes/banco/novo" variant="primary" icon={Plus}>
                  Novo teste
                </ButtonLink>
              ) : hasFilter ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setCategory('ALL') }}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className={tableShell}>
          <table className="w-full text-body">
            <thead className="border-b border-wg-border-lighter bg-[#FAFCF6]">
              <tr>
                <th scope="col" className={thClass}>Teste</th>
                <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Categoria</th>
                <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Questões</th>
                <th scope="col" className={cn(thClass, 'hidden lg:table-cell')}>Duração</th>
                <th scope="col" className={cn(thClass, 'hidden md:table-cell')}>Critério</th>
                <th scope="col" className={cn(thClass, 'hidden sm:table-cell text-right')}>Aplicações</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={cn(thClass, 'w-12')}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wg-border-lighter">
              {filtered.map((t) => {
                const cat = templateCategory(t.kind, t.subtype)
                const items = itemsLabel(t.type, t.questions ?? [])
                return (
                  <tr key={t.id} className={cn(rowClass, !t.isActive && 'text-wg-ink-muted')}>
                    <td className={cn(tdClass, 'min-w-[200px]')}>
                      <Link
                        href={`/avaliacoes/banco/${t.id}?modo=visualizar`}
                        className={cn('font-semibold hover:underline', t.isActive ? 'text-wg-ink' : 'text-wg-ink-muted')}
                      >
                        {t.name}
                      </Link>
                      <CellSub>
                        {/* Em telas pequenas as colunas ocultas viram uma linha de apoio. */}
                        <span className="md:hidden">
                          {cat.primary}
                          {cat.secondary && ` · ${cat.secondary}`} · {items.count} · {criterionLabel(t.type, t.passingScore)}
                        </span>
                        <span className="hidden md:line-clamp-1 md:max-w-md" title={t.description ?? undefined}>{t.description ?? items.count}</span>
                      </CellSub>
                    </td>
                    <td className={cn(tdClass, 'hidden md:table-cell whitespace-nowrap')}>
                      <div className="text-wg-ink-secondary">{cat.primary}</div>
                      {cat.secondary && <CellSub>{cat.secondary}</CellSub>}
                    </td>
                    <td className={cn(tdClass, 'hidden lg:table-cell whitespace-nowrap')}>
                      <div className="tabular-nums text-wg-ink-secondary">{items.count}</div>
                      {items.detail && <CellSub>{items.detail}</CellSub>}
                    </td>
                    <td className={cn(tdClass, 'hidden lg:table-cell whitespace-nowrap tabular-nums text-wg-ink-secondary')}>
                      {t.estimatedMin ? `${t.estimatedMin} min` : <span className="text-wg-ink-muted">—</span>}
                    </td>
                    <td className={cn(tdClass, 'hidden md:table-cell whitespace-nowrap text-wg-ink-secondary')}>
                      {criterionLabel(t.type, t.passingScore)}
                    </td>
                    <td className={cn(tdClass, 'hidden sm:table-cell text-right tabular-nums')}>
                      {t.applications > 0 ? (
                        <Link href={`/avaliacoes/aplicacoes?teste=${t.id}`} className="font-medium text-wg-ink-secondary hover:underline">
                          {t.applications}
                        </Link>
                      ) : (
                        <span className="text-wg-ink-muted">0</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      {t.isActive ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="neutral">Arquivado</StatusBadge>}
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <DropdownMenu
                        portal
                        ariaLabel={`Ações do teste ${t.name}`}
                        title="Ações"
                        disabled={busyId === t.id}
                        trigger={<MoreHorizontal aria-hidden />}
                        triggerClassName={buttonVariants({ variant: 'tertiary', size: 'icon-sm' })}
                        items={menuItems(t)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmArchive !== null}
        title="Arquivar teste?"
        message={
          confirmArchive
            ? `"${confirmArchive.name}" deixa de aparecer para envio. Aplicações e resultados já existentes continuam disponíveis, e você pode reativá-lo quando quiser.`
            : ''
        }
        confirmLabel="Arquivar"
        variant="warning"
        onCancel={() => setConfirmArchive(null)}
        onConfirm={() => {
          const t = confirmArchive
          setConfirmArchive(null)
          if (t) void setActive(t, false)
        }}
      />

      {showRepo && (
        <RepositoryModal
          onClose={() => setShowRepo(false)}
          onImported={(id) => {
            router.push(`/avaliacoes/banco/${id}`)
            setShowRepo(false)
          }}
        />
      )}
    </div>
  )
}
