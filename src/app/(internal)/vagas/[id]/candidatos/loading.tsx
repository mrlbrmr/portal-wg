import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder do Kanban de candidatos enquanto as candidaturas carregam. */
export default function LoadingCandidatos() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />

      {/* Colunas do Kanban */}
      <div className="mt-6 flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 6 }).map((_, col) => (
          <div
            key={col}
            className="w-72 shrink-0 rounded-xl border border-gray-200 bg-gray-100"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6" />
            </div>
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: col % 3 === 0 ? 2 : 1 }).map((_, card) => (
                <div
                  key={card}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-40" />
                  <Skeleton className="mt-2 h-3 w-36" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
