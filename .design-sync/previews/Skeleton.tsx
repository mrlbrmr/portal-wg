import { Skeleton } from "portal-vagas-wg-ui";

export function Line() {
  return <Skeleton className="h-4 w-56" />;
}

export function CardPlaceholder() {
  return (
    <div className="w-72 rounded-xl border border-gray-200 bg-white p-4">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function ListRows() {
  return (
    <div className="w-80 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
