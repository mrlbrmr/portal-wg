import { Skeleton, SkeletonListItem, SkeletonPageTop } from "@/components/ui/Skeleton";

/** Placeholder da tela de Vagas enquanto o server component busca os dados. */
export default function LoadingGerenciar() {
  return (
    <div>
      <SkeletonPageTop />
      <div className="max-w-5xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 min-w-[220px] flex-1" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-8 w-[74px] rounded-full" />
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
