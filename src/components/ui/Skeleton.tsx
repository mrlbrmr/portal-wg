import { cn } from "@/lib/utils";

/**
 * Bloco de carregamento (skeleton) com pulso. Use para montar placeholders
 * que espelham o layout real da página enquanto os dados chegam — mesmas
 * alturas e larguras, para não haver "pulo" quando o conteúdo aparece.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-[#E9EEE2]", className)} />;
}

/** Linha de lista (vaga/admissão) em carregamento — mesma altura dos itens reais. */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 rounded-card border border-wg-border-lighter bg-white px-4 py-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-20" />
      <Skeleton className="hidden h-8 w-28 md:block" />
    </div>
  );
}

/** Cabeçalho de página + faixa de métricas compacta. */
export function SkeletonPageTop({ metrics = true }: { metrics?: boolean }) {
  return (
    <>
      <div role="status" aria-label="Carregando" className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      {metrics && <Skeleton className="mb-4 h-[46px] w-full rounded-card" />}
    </>
  );
}
