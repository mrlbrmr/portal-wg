import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder do Dashboard enquanto as métricas e listas são carregadas. */
export default function LoadingDashboard() {
  return (
    <div>
      {/* Saudação */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      {/* Cards de métricas */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
            <Skeleton className="h-7 w-10" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Tendência + painéis */}
      <Skeleton className="mb-6 h-20 w-full rounded-xl" />
      <Skeleton className="mb-6 h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
