import { Skeleton } from "@/components/ui/Skeleton";

/** Loading do calendário de admissões (grade mensal). */
export default function LoadingAdmissoesCalendario() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-52" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[104px] border-t border-l border-gray-100 p-1.5">
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
