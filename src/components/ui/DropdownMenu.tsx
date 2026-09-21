"use client";

import { useEffect, useId, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownMenuItem =
  | {
      type?: "item";
      label: string;
      icon?: ElementType;
      /** Ação ao selecionar. Ignorada quando `href` é informado. */
      onSelect?: () => void;
      href?: string;
      /** Abre o link em nova aba (WhatsApp, currículo). */
      external?: boolean;
      /** Ação destrutiva: texto em vermelho. */
      danger?: boolean;
      disabled?: boolean;
      /** Texto secundário à direita (ex.: "fora do Kanban"). */
      hint?: string;
    }
  | { type: "separator" };

interface Props {
  /** Conteúdo do botão gatilho (texto + ícones). */
  trigger: ReactNode;
  /** Classe do botão gatilho — use buttonVariants() para manter a hierarquia. */
  triggerClassName: string;
  /** Rótulo acessível quando o gatilho é só ícone (ex.: "Mais ações"). */
  ariaLabel?: string;
  title?: string;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  disabled?: boolean;
  menuClassName?: string;
}

/**
 * Menu contextual acessível (•••, "Contatar ▾"): abre por clique/Enter/Espaço/↓, navega
 * com ↑↓ Home End, fecha com Esc (devolvendo o foco ao gatilho) ou clique fora.
 * O Esc chama preventDefault para que drawers/modais por baixo não fechem junto.
 */
export function DropdownMenu({
  trigger,
  triggerClassName,
  ariaLabel,
  title,
  items,
  align = "right",
  disabled,
  menuClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const focusables = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open) return;
    focusables()[0]?.focus();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const list = focusables();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const itemClass = (danger?: boolean) =>
    cn(
      "flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-[13px] outline-none transition-colors",
      "aria-disabled:pointer-events-none aria-disabled:opacity-50",
      danger
        ? "text-danger-fg hover:bg-danger-bg focus-visible:bg-danger-bg"
        : "text-wg-ink-secondary hover:bg-wg-bg hover:text-wg-ink focus-visible:bg-wg-bg focus-visible:text-wg-ink"
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        title={title}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-[60] mt-1 min-w-[200px] overflow-hidden rounded-card border border-wg-border-lighter bg-white py-1 shadow-[0_12px_32px_rgba(26,34,19,.12)]",
            align === "right" ? "right-0" : "left-0",
            menuClassName
          )}
        >
          {items.map((item, idx) => {
            if (item.type === "separator") {
              return <div key={`sep-${idx}`} role="separator" className="my-1 h-px bg-wg-border-lighter" />;
            }
            const Icon = item.icon;
            const content = (
              <>
                {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-[11px] text-wg-ink-muted">{item.hint}</span>}
              </>
            );
            if (item.href && !item.disabled) {
              return (
                <a
                  key={item.label}
                  role="menuitem"
                  tabIndex={-1}
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() => close(false)}
                  className={itemClass(item.danger)}
                >
                  {content}
                </a>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  // Foco volta ao gatilho ANTES da ação: um diálogo aberto por ela
                  // devolve o foco para cá ao fechar.
                  close();
                  item.onSelect?.();
                }}
                className={itemClass(item.danger)}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
