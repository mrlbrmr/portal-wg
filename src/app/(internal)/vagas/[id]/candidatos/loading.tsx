import { Skeleton } from "@/components/ui/Skeleton";
import { CandidateCardSkeleton } from "@/components/internal/candidates/CandidateCard";

/** Placeholder do pipeline de candidatos: header, resumo, toolbar e colunas com cards. */
export default function LoadingCandidatos() {
  return (
    <div role="status" aria-label="Carregando candidatos">
      <Skeleton className="mb-3 h-4 w-28" />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[22px] w-14 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      <Skeleton className="mb-5 h-5 w-96 max-w-full" />

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 min-w-[220px] flex-1" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="mt-4 flex gap-3 overflow-hidden pb-3">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="w-[272px] shrink-0 rounded-card bg-[#EEF2E8]/50 p-2">
            <div className="flex items-center gap-2 px-1 pb-2 pt-0.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="ml-auto h-5 w-5 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: col % 3 === 0 ? 2 : 1 }).map((_, card) => (
                <CandidateCardSkeleton key={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
