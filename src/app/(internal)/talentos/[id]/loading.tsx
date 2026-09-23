import { Skeleton } from "@/components/ui/Skeleton";

// Mesmo desenho do perfil completo: voltar, cabeçalho com avatar/ações, abas e cards.
export default function LoadingTalentoPerfil() {
  return (
    <div role="status" aria-label="Carregando perfil do talento">
      <Skeleton className="mb-4 h-4 w-36" />
      <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <div className="border-b border-wg-border-lighter px-5 pb-3 pt-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-8" />
          </div>
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="space-y-3 bg-wg-bg px-5 py-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
