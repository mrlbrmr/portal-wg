import { Skeleton } from "@/components/ui/Skeleton";

// Skeleton do Banco de Talentos: mesmo desenho da página (cabeçalho, indicadores, barra de
// ferramentas e linhas da tabela) — sem spinner no meio da tela.
export default function TalentosLoading() {
  return (
    <div role="status" aria-label="Carregando Banco de Talentos">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-60" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="mb-4 h-[46px] w-full rounded-card" />
      <div className="mb-3 flex gap-1.5">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="hidden h-9 w-52 sm:block" />
      </div>
      <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <div className="border-b border-wg-border-lighter bg-wg-bg/60 px-4 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-wg-border-lighter px-4 py-3 last:border-b-0">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-36 md:block" />
            <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
            <Skeleton className="hidden h-4 w-32 lg:block" />
            <Skeleton className="hidden h-8 w-36 lg:block" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
