/**
 * Bloco de carregamento (skeleton) com pulso. Use para montar placeholders
 * que espelham o layout real da página enquanto os dados chegam.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />;
}
