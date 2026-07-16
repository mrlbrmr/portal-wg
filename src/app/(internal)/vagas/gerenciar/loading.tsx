import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder da tela de Vagas enquanto o server component busca os dados. */
export default function LoadingGerenciar() {
  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Faixa de indicadores (6 cards) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="mt-3 h-6 w-10" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="max-w-4xl">
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 min-w-[240px] flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>

        {/* Cards da lista */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="mt-2.5 h-4 w-72" />
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
