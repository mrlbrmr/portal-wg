import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Peças visuais compartilhadas pelas três telas de Avaliações (Banco de testes,
 * Aplicações, Resultados) — mesma tabela, busca e filtros, no padrão do painel.
 * Tabela, busca e select vivem em components/ui (também usados por Usuários,
 * Calendário, Relatórios e Atividades); ficam reexportados aqui por compatibilidade.
 */

export { tableShell, thClass, tdClass, rowClass } from '@/components/ui/table'
export { SearchField, FilterSelect } from '@/components/ui/FilterControls'

/** Linha de apoio abaixo do texto principal de uma célula. */
export function CellSub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-0.5 text-[12px] text-wg-ink-muted', className)}>{children}</div>
}
