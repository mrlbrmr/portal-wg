import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder da página da vaga (cabeçalho + abas + duas colunas) enquanto carrega. */
export default function LoadingEditarVaga() {
  return (
    <div aria-busy="true" aria-label="Carregando vaga">
      <Skeleton className="mb-3 h-4 w-16" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40 rounded-control" />
          <Skeleton className="h-9 w-9 rounded-control" />
          <Skeleton className="h-9 w-40 rounded-control" />
        </div>
      </div>
      <div className="mt-4 flex gap-4 border-b border-wg-border-lighter pb-2.5">
        {["w-24", "w-20", "w-32", "w-24", "w-20"].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {[6, 3, 4].map((fields, p) => (
            <div key={p} className="rounded-card border border-wg-border-lighter bg-white p-5">
              <Skeleton className="mb-4 h-5 w-48" />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: fields }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="mb-1.5 h-3.5 w-28" />
                    <Skeleton className="h-9 w-full rounded-control" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[9, 3, 4].map((rows, p) => (
            <div key={p} className="rounded-card border border-wg-border-lighter bg-white p-5">
              <Skeleton className="mb-4 h-5 w-24" />
              <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
