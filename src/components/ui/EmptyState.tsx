import type { ElementType, ReactNode } from "react";

interface Props {
  icon?: ElementType;
  title: string;
  description?: string;
  /** CTA opcional (botão/link) exibido abaixo do texto. */
  action?: ReactNode;
  className?: string;
}

/**
 * Estado vazio reutilizável: ícone opcional em bolha, título, descrição e um
 * CTA opcional. Use para diferenciar "ainda não há dados" de "a busca/filtro
 * não retornou nada" (neste caso passe um action de limpar filtros).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
