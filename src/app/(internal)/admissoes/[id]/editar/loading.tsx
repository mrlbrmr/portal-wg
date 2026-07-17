import { Skeleton } from "@/components/ui/Skeleton";

/** Loading do formulário de edição de admissão. */
export default function LoadingEditarAdmissao() {
  return (
    <div className="max-w-3xl">
      <Skeleton className="h-5 w-28 mb-4" />
      <Skeleton className="h-8 w-52 mb-6" />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}
