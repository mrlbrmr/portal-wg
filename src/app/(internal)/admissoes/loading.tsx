import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Fallback de carregamento do módulo de Admissões. Cobre a lista e — por
 * herança de Suspense — as sub-rotas sem loading próprio (relatórios,
 * histórico, configurações, nova/editar). Rotas de layout distinto (ficha,
 * kanban, calendário) têm o seu.
 */
export default function LoadingAdmissoes() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
