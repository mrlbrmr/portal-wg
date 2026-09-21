import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tons semânticos do painel. O significado é fixo em todo o sistema:
 * success = concluído/ok · info = em processamento · warning = aguardando/atenção ·
 * danger = atrasado/erro · neutral = inativo/rascunho.
 */
export type Tone = "success" | "info" | "warning" | "danger" | "neutral";

export const TONE_SOFT: Record<Tone, string> = {
  success: "bg-success-bg text-success-fg",
  info: "bg-info-bg text-info-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
};

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-neutral",
};

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success-fg",
  info: "text-info-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
  neutral: "text-neutral-fg",
};

interface StatusBadgeProps {
  tone: Tone;
  children: ReactNode;
  /** Ícone lucide antes do texto — reforça o significado além da cor. */
  icon?: ElementType;
  /** Explicação curta exibida no hover (tooltip nativo) e lida por leitores de tela. */
  hint?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * STATUS de uma entidade (vaga, solicitação, documento): pílula preenchida em tom suave.
 * Para ETAPA de processo use <StageBadge> — visual contornado, para não confundir as duas
 * dimensões.
 */
export function StatusBadge({ tone, children, icon: Icon, hint, size = "sm", className }: StatusBadgeProps) {
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold",
        size === "sm" ? "h-[22px] px-2 text-[11.5px]" : "h-6 px-2.5 text-xs",
        TONE_SOFT[tone],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
      {children}
      {hint && <span className="sr-only">. {hint}</span>}
    </span>
  );
}

interface StageBadgeProps {
  children: ReactNode;
  /** Cor do ponto. Aceita hex vindo do banco (etapas configuráveis). */
  color?: string;
  hint?: string;
  className?: string;
}

/**
 * ETAPA do processo (Triagem, Entrevista, Formulário admissional…): chip contornado com
 * ponto colorido. O texto fica sempre em tinta escura — cores de etapa são configuradas
 * pelo usuário e não garantem contraste como texto.
 */
export function StageBadge({ children, color = "#9AA68A", hint, className }: StageBadgeProps) {
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-wg-border-light bg-white px-2 text-[11.5px] font-medium text-wg-ink-secondary",
        className
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
