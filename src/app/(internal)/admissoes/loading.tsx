import { Skeleton, SkeletonListItem, SkeletonPageTop } from "@/components/ui/Skeleton";

/**
 * Fallback de carregamento do módulo de Admissões. Cobre a lista e — por
 * herança de Suspense — as sub-rotas sem loading próprio (relatórios,
 * histórico, configurações, nova/editar). Rotas de layout distinto (ficha,
 * kanban, calendário) têm o seu.
 */
export default function LoadingAdmissoes() {
  return (
    <div>
      <SkeletonPageTop />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 min-w-[220px] flex-1" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    </div>
  );
}
