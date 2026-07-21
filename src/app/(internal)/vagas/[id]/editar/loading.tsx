import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder da tela de edição de vaga enquanto o job + histórico carregam. */
export default function LoadingEditarVaga() {
  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-4 w-28" />

      {/* Título + badge de status */}
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Corpo do formulário */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3.5 w-28" />
            <Skeleton className={`h-10 w-full rounded-lg ${i === 3 || i === 7 ? "h-24" : ""}`} />
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>

      {/* Histórico de status */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
