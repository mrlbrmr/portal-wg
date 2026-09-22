import type { ReactNode } from 'react'

/** Seção da página de resultado: título discreto + divisor sutil, sem caixa ao redor. */
export function ResultSection({
  title,
  description,
  children,
  id,
}: {
  title: string
  description?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-wg-border-lighter py-7 first:border-t-0 first:pt-0">
      <h2 className="text-section-title text-wg-ink">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-meta text-wg-ink-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Lista de "rótulo → valor" (detalhes da aplicação). Itens sem valor não são exibidos. */
export function DetailList({ items }: { items: Array<[string, ReactNode | null | undefined]> }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '')
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[12px] text-wg-ink-muted">{label}</dt>
          <dd className="mt-0.5 text-body text-wg-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
