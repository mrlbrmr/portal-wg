import { Skeleton } from '@/components/ui/Skeleton'

/** Placeholder da página de resultado: cabeçalho, gráfico + dimensões e cards. */
export default function LoadingResultado() {
  return (
    <div role="status" aria-label="Carregando" className="max-w-5xl">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-5 w-48 rounded-full" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      <Skeleton className="mt-2 mb-8 h-4 w-56" />
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <Skeleton className="mx-auto aspect-square w-full max-w-[280px] rounded-full" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
