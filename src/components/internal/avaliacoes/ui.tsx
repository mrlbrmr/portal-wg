import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Peças visuais compartilhadas pelas três telas de Avaliações (Banco de testes,
 * Aplicações, Resultados) — mesma tabela, busca e filtros, no padrão do painel.
 */

export const tableShell = 'overflow-hidden rounded-card border border-wg-border-lighter bg-white'
export const thClass = 'px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#8A9480]'
export const tdClass = 'px-4 py-3 align-middle'
export const rowClass = 'transition-colors hover:bg-[#FAFCF6]'

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-[220px] flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted/70" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-3 text-body text-wg-ink placeholder:text-wg-ink-muted/70 outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
      />
    </div>
  )
}

/** Select com prefixo fixo: "Categoria: Todas". */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  const active = value !== options[0]?.value
  return (
    <label
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-control border bg-white pl-2.5 pr-1 text-body transition-colors focus-within:border-wg-green focus-within:ring-2 focus-within:ring-wg-green/30',
        active ? 'border-wg-green-dark/40' : 'border-wg-border-light'
      )}
    >
      <span className="whitespace-nowrap text-wg-ink-muted">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="max-w-[220px] cursor-pointer truncate bg-transparent py-1 pr-1 font-medium text-wg-ink outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Linha de apoio abaixo do texto principal de uma célula. */
export function CellSub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-0.5 text-[12px] text-wg-ink-muted', className)}>{children}</div>
}
