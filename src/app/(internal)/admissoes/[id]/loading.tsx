import { Skeleton } from "@/components/ui/Skeleton";

/** Loading da Central da admissão: cabeçalho, abas + conteúdo e sidebar operacional. */
export default function LoadingAdmissaoFicha() {
  return (
    <div role="status" aria-label="Carregando admissão" className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <div>
        <Skeleton className="h-5 w-28" />
        <div className="mt-3 flex items-start gap-4">
          <Skeleton className="hidden h-12 w-12 rounded-card sm:block" />
          <div className="flex-1">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="mt-2 h-4 w-96 max-w-full" />
            <Skeleton className="mt-3 h-5 w-80 max-w-full rounded-full" />
          </div>
          <Skeleton className="hidden h-9 w-40 sm:block" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
        <div className="space-y-3 rounded-card border border-wg-border-lighter bg-white p-5 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-40 rounded-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
          <Skeleton className="mt-4 h-3 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-4 h-3 w-28" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="space-y-5 lg:col-start-1 lg:row-start-1">
          <div className="flex gap-4 border-b border-wg-border-lighter pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
