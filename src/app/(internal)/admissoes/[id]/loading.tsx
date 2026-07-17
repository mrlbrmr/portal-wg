import { Skeleton } from "@/components/ui/Skeleton";

/** Loading da ficha da admissão (coluna de informações + checklist/anexos). */
export default function LoadingAdmissaoFicha() {
  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      <div className="flex items-center gap-4 mb-5">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-1.5 h-4 w-40" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
