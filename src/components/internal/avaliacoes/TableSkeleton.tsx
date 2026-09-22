import { Skeleton, SkeletonPageTop } from '@/components/ui/Skeleton'

/** Carregamento das listas de Avaliações: cabeçalho, filtros e linhas da tabela. */
export function AvaliacoesTableSkeleton({ filters = 3, chips = false }: { filters?: number; chips?: boolean }) {
  return (
    <div>
      <SkeletonPageTop metrics={false} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-72" />
        {Array.from({ length: filters - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-40" />
        ))}
      </div>
      {chips && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-wg-border-lighter px-4 py-3.5">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="hidden h-4 w-20 lg:block" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
