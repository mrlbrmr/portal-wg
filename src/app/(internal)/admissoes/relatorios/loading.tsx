import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/ui/PageContainer";

/** Loading dos Relatórios: indicadores, gráfico mensal, alertas e distribuições. */
export default function LoadingRelatorios() {
  return (
    <PageContainer>
      <div role="status" aria-label="Carregando relatórios" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skeleton className="hidden h-9 w-9 sm:block" />
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[300px] rounded-card xl:col-span-2" />
        <Skeleton className="h-[300px] rounded-card" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-card" />
        ))}
      </div>
    </PageContainer>
  );
}
