import { Skeleton } from "@/components/ui/Skeleton";

/** Loading da ficha da admissão: cabeçalho com jornada, resumo lateral e abas. */
export default function LoadingAdmissaoFicha() {
  return (
    <div role="status" aria-label="Carregando admissão" className="mx-auto max-w-[1280px]">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mb-5 rounded-card border border-wg-border-lighter bg-white p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-card" />
          <div className="flex-1">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
            <Skeleton className="mt-3 h-5 w-40 rounded-full" />
          </div>
          <Skeleton className="hidden h-12 w-56 sm:block" />
        </div>
        <Skeleton className="mt-5 h-14 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-card border border-wg-border-lighter bg-white p-5">
          <Skeleton className="h-16 w-full rounded-control" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-1.5 h-4 w-40" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 border-b border-wg-border-lighter pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
