import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_ROOT } from "@/lib/settings/registry";
import { formatChangeDate } from "@/lib/settings/format";
import type { ConfigChange } from "@/lib/settings/audit";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Breadcrumb padrão das Configurações. "Configurações" é sempre o primeiro nível;
 * o último item é a página atual (sem link, com aria-current).
 */
export function SettingsBreadcrumb({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [SETTINGS_ROOT, ...items];
  return (
    <nav aria-label="Trilha de navegação" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-meta text-wg-ink-muted">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A3AD98]" aria-hidden />}
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-wg-ink" : undefined}>
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="rounded-sm transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Última alteração: Murilo Bremer · hoje às 08:14" — só quando há registro real. */
export function LastChange({ change }: { change: ConfigChange | null | undefined }) {
  if (!change) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-label font-normal text-wg-ink-muted" title={change.summary}>
      <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Última alteração: <span className="font-medium text-wg-ink-secondary">{change.actorName}</span> ·{" "}
        {formatChangeDate(change.createdAt)}
      </span>
    </p>
  );
}

interface Props {
  /** Trilha abaixo de "Configurações" — o último item é a página atual. */
  breadcrumb: Crumb[];
  title: string;
  description?: ReactNode;
  /** Ações do cabeçalho (ex.: "Visualizar como gestor"). A primária fica por último. */
  actions?: ReactNode;
  lastChange?: ConfigChange | null;
  /** Conteúdo logo abaixo do cabeçalho (ex.: navegação interna de Cadastros). */
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Layout padrão de TODAS as páginas de Configurações: container central de 1180px,
 * breadcrumb, título, descrição, última alteração e ações.
 */
export function SettingsPage({ breadcrumb, title, description, actions, lastChange, nav, children, className }: Props) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px]", className)}>
      {breadcrumb.length > 0 && <SettingsBreadcrumb items={breadcrumb} />}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink md:text-page-title">{title}</h1>
          {description && <p className="mt-1 text-body text-wg-ink-muted">{description}</p>}
          {lastChange && (
            <div className="mt-2">
              <LastChange change={lastChange} />
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {nav}
      {children}
    </div>
  );
}
