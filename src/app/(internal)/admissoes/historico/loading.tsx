import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/ui/PageContainer";

/** Loading de Atividades: cabeçalho, filtros e linhas da timeline. */
export default function LoadingAtividades() {
  return (
    <PageContainer>
      <div role="status" aria-label="Carregando atividades" className="flex items-start gap-3">
        <Skeleton className="hidden h-9 w-9 sm:block" />
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-card border border-wg-border-lighter bg-white">
        <Skeleton className="h-8 w-full rounded-none rounded-t-card" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-wg-border-lighter px-5 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-48 lg:block" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
