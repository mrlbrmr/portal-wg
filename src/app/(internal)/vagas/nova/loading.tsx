import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder da tela de nova vaga enquanto o auth verifica a sessão. */
export default function LoadingNovaVaga() {
  return (
    <div className="max-w-2xl">
      <Skeleton className="mb-6 h-8 w-36" />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>
    </div>
  );
}
