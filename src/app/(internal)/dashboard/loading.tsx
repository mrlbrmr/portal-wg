import { Skeleton, SkeletonPageTop } from "@/components/ui/Skeleton";

/** Placeholder da Visão geral: métricas compactas + 4 painéis de trabalho. */
export default function LoadingDashboard() {
  return (
    <div className="flex flex-col gap-5">
      <SkeletonPageTop metrics={false} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[62px] w-full rounded-card" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card border border-wg-border-lighter bg-white p-5">
            <Skeleton className="h-5 w-48" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-control" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
