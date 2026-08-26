import Link from "next/link";
import type { ElementType, ReactNode } from "react";

interface Props {
  href: string;
  /** Ícone opcional (lucide-react) exibido antes do texto. */
  icon?: ElementType;
  children: ReactNode;
  className?: string;
  /** Abre em nova aba quando true. */
  external?: boolean;
}

/**
 * Botão primário de criação (verde da marca), padronizado em todo o painel —
 * unifica variações antigas (rounded-full de Admissões vs rounded-lg de Vagas).
 * Usado no slot `action` do [[PageHeader]].
 */
export function PrimaryActionLink({
  href,
  icon: Icon,
  children,
  className = "",
  external = false,
}: Props) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center gap-2 rounded-lg bg-wg-green px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition-opacity hover:opacity-90 font-sora ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </Link>
  );
}
