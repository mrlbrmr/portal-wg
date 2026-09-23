"use client";

// Peças visuais compartilhadas do Banco de Talentos (lista, drawer e perfil completo).

import { Archive, Briefcase, CheckCircle2, CircleSlash, Clock, Star, UserCheck } from "lucide-react";
import type { ElementType } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { SITUATION_META, type TalentSituation } from "@/lib/talentos/crm";
import { getAvatarStyle, getInitials } from "./talentos-utils";

export function TalentAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const style = getAvatarStyle(name);
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-bold",
        size === "sm" && "h-8 w-8 text-[11px]",
        size === "md" && "h-9 w-9 text-[12px]",
        size === "lg" && "h-12 w-12 text-[15px]"
      )}
      style={{ background: style.bg, color: style.fg }}
    >
      {getInitials(name)}
    </span>
  );
}

const SITUATION_ICON: Record<TalentSituation, ElementType> = {
  DISPONIVEL: CheckCircle2,
  EM_PROCESSO: Clock,
  CONTRATADO: UserCheck,
  INDISPONIVEL: CircleSlash,
  ARQUIVADO: Archive,
};

/** Situação do talento no banco (≠ etapa da candidatura). Ícone + texto: não depende só de cor. */
export function SituationBadge({ situation, className }: { situation: TalentSituation; className?: string }) {
  const meta = SITUATION_META[situation];
  return (
    <StatusBadge tone={meta.tone} icon={SITUATION_ICON[situation]} hint={meta.hint} className={className}>
      {meta.label}
    </StatusBadge>
  );
}

/** Estrela de favorito. Sem permissão de escrita, só indica (não é botão). */
export function FavoriteToggle({
  active,
  onToggle,
  disabled,
  name,
  size = "sm",
}: {
  active: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  name: string;
  size?: "sm" | "md";
}) {
  const icon = (
    <Star
      aria-hidden
      className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5", active ? "fill-[#E0A526] text-[#C98F12]" : "text-wg-ink-muted/70")}
    />
  );
  if (!onToggle) {
    return active ? (
      <span title="Favorito" className="inline-flex">
        {icon}
        <span className="sr-only">Favorito</span>
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      title={active ? "Remover dos favoritos" : "Favoritar"}
      className={cn(
        "inline-flex items-center justify-center rounded-control transition-colors hover:bg-wg-hover-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50 disabled:opacity-50",
        size === "sm" ? "h-7 w-7" : "h-9 w-9"
      )}
    >
      {icon}
    </button>
  );
}

/** Tag do cadastro central: ponto colorido + texto em tinta escura (contraste garantido). */
export function TagChip({
  name,
  color,
  onRemove,
  className,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-[160px] shrink-0 items-center gap-1.5 rounded-full border border-wg-border-light bg-white pl-2 text-[11.5px] font-medium text-wg-ink-secondary",
        onRemove ? "pr-0.5" : "pr-2",
        className
      )}
      title={name}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover tag ${name}`}
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink"
        >
          ×
        </button>
      )}
    </span>
  );
}

/** Rótulo secundário para dado ausente — diz O QUE falta, em vez de só "—". */
export function Missing({ children, className }: { children: string; className?: string }) {
  return <span className={cn("text-meta italic text-wg-ink-muted/80", className)}>{children}</span>;
}

export function ProfileLine({
  cargo,
  cargoFromCv,
  area,
}: {
  cargo: string | null;
  cargoFromCv: string | null;
  area: string | null;
}) {
  const primary = cargo ?? cargoFromCv;
  if (!primary && !area) return <Missing>Perfil não informado</Missing>;
  return (
    <div className="min-w-0">
      {primary ? (
        <p
          className="flex min-w-0 items-center gap-1 truncate text-body text-wg-ink"
          title={cargo ? "Cargo de interesse" : "Último cargo informado no currículo"}
        >
          {!cargo && <Briefcase className="h-3 w-3 shrink-0 text-wg-ink-muted" aria-hidden />}
          <span className="truncate">{primary}</span>
        </p>
      ) : null}
      {area && (
        <p className={cn("truncate", primary ? "text-meta text-wg-ink-muted" : "text-body text-wg-ink")} title="Área">
          {area}
        </p>
      )}
    </div>
  );
}
