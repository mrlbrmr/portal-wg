import { Skeleton } from "@/components/ui/Skeleton";

/** Loading do Kanban de admissões (colunas com cards). */
export default function LoadingAdmissoesKanban() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, c) => (
          <div key={c} className="w-72 shrink-0 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <div className="p-2 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
