import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Placeholder genérico das telas internas (fallback). Rotas com layout
 * próprio — Vagas, Dashboard, Candidatos — têm seu próprio loading.tsx.
 */
export default function LoadingInternal() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-48" />

      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-11 w-40" />
      </div>
    </div>
  );
}
