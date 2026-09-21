import type { ElementType, ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";

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
 * Botão primário de criação (verde da marca) do slot `action` do [[PageHeader]].
 * Atalho para <ButtonLink variant="primary"> — mantido para não quebrar os usos atuais.
 */
export function PrimaryActionLink({ href, icon, children, className, external = false }: Props) {
  return (
    <ButtonLink href={href} icon={icon} variant="primary" className={className} external={external}>
      {children}
    </ButtonLink>
  );
}
