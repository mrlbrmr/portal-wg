import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ElementType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hierarquia de botões do painel RH.
 *
 * - primary   → a ação principal da página (verde WG). No máximo uma por área.
 * - secondary → ações auxiliares (Exportar, Editar, Filtros).
 * - tertiary  → ações discretas e menus de contexto (•••, Cancelar).
 * - danger    → ações destrutivas (sempre com confirmação).
 *
 * Alturas, paddings, radius, ícone e tipografia são fixos por tamanho — não sobrescreva
 * via className, exceto para layout (margem, largura).
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-wg-green text-wg-dark border border-wg-green hover:bg-wg-green-bright hover:border-wg-green-bright shadow-sm",
  secondary:
    "bg-white text-wg-ink-secondary border border-wg-border-light hover:bg-wg-bg hover:text-wg-ink hover:border-[#C9D9B4]",
  tertiary:
    "bg-transparent text-wg-ink-muted border border-transparent hover:bg-wg-hover-light hover:text-wg-ink",
  danger:
    "bg-white text-danger-fg border border-danger-border hover:bg-danger-bg",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 gap-1.5 text-[13px] [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 px-3.5 gap-2 text-sm [&_svg]:h-4 [&_svg]:w-4",
  icon: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
  "icon-sm": "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
};

export function buttonVariants({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    className
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone lucide exibido antes do texto. */
  icon?: ElementType;
  /** Mostra spinner no lugar do ícone e desabilita o botão. */
  loading?: boolean;
  children?: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  icon: Icon,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "children"> & { external?: boolean };

/** Mesmo visual do Button, para navegação (next/link). */
export function ButtonLink({
  variant,
  size,
  icon: Icon,
  className,
  children,
  external = false,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Link>
  );
}
