import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  /** Slot de ação(ões) no canto superior direito (botões de criar/exportar). */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das páginas internas: título + subtítulo opcional à esquerda
 * e um slot de ação à direita. Centraliza o espaçamento (mb-4) para densificar o
 * topo em telas 1080p e manter as ações de criação sempre no canto superior
 * direito da área de conteúdo (nunca na sidebar).
 */
export function PageHeader({ title, subtitle, action, className = "" }: Props) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold text-[#1A2213] font-sora tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[#55614A] mt-0.5 font-inter">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
