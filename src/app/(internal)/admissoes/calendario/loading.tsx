import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/ui/PageContainer";

/** Loading do Calendário: mesmo esqueleto da página (resumo, controles, grade mensal). */
export default function LoadingAdmissoesCalendario() {
  return (
    <PageContainer>
      <div role="status" aria-label="Carregando calendário" className="flex items-start gap-3">
        <Skeleton className="hidden h-9 w-9 sm:block" />
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-[28rem] max-w-full" />
        </div>
      </div>
      <Skeleton className="h-[54px] w-full rounded-card" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="ml-auto h-9 w-56" />
      </div>
      <Skeleton className="h-9 w-[36rem] max-w-full" />
      <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[118px] border-b border-l border-wg-border-lighter p-2 first:border-l-0">
              <Skeleton className="h-4 w-5" />
              {i % 4 === 1 && <Skeleton className="mt-2 h-5 w-full" />}
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
