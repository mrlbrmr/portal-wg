"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, normalizeText } from "@/lib/utils";
import { getRegistry } from "@/lib/settings/registry";
import { updateCategory, type CatEntity } from "@/lib/admissao/config-actions";
import type { RegistryItem } from "@/lib/admissao/registry-data";
import { RegistryItemDialog } from "./RegistryItemDialog";
import { RegistryDeleteDialog } from "./RegistryDeleteDialog";

const PAGE_SIZE = 25;
type StatusFilter = "all" | "active" | "inactive";

/**
 * Tabela administrativa de um cadastro: busca em tempo real, filtro de status,
 * paginação e ações por linha (editar, ativar/desativar, excluir com checagem de uso).
 * Nada é salvo ao digitar — edição e criação acontecem no diálogo.
 */
export function RegistryTable({ entity, items }: { entity: Exclude<CatEntity, "stage">; items: RegistryItem[] }) {
  const reg = getRegistry(entity);
  const Icon = reg.icon;
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<RegistryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RegistryItem | null>(null);

  const hasStatus = items.some((i) => i.active !== null);
  const hasColor = entity === "tag";
  const hasRequired = entity === "documentType";

  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    return items.filter((i) => {
      if (status === "active" && i.active === false) return false;
      if (status === "inactive" && i.active !== false) return false;
      return !q || normalizeText(i.name).includes(q);
    });
  }, [items, deferredQuery, status]);

  useEffect(() => setPage(0), [deferredQuery, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const inactiveCount = items.filter((i) => i.active === false).length;

  function toggleActive(item: RegistryItem) {
    startTransition(async () => {
      const res = await updateCategory(entity, item.id, { active: !item.active });
      if (!res.ok) return notify("error", res.error);
      notify("success", `“${item.name}” ${item.active ? "desativad" : "reativad"}${reg.article}.`);
      router.refresh();
    });
  }

  const newLabel = `${reg.article === "a" ? "Nova" : "Novo"} ${reg.singular}`;

  return (
    <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby={`reg-${entity}-title`}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 id={`reg-${entity}-title`} className="font-sora text-section-title text-wg-ink">
              {reg.title}
            </h2>
            <span className="text-meta text-wg-ink-muted">
              {items.length} {items.length === 1 ? reg.singular : reg.plural}
              {inactiveCount > 0 && ` · ${inactiveCount} inativ${reg.article}${inactiveCount > 1 ? "s" : ""}`}
            </span>
          </div>
          <p className="mt-0.5 text-meta text-wg-ink-muted">{reg.description}</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
          {newLabel}
        </Button>
      </header>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-wg-border-lighter bg-wg-bg/50 px-5 py-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
            <label htmlFor={`reg-${entity}-search`} className="sr-only">
              Buscar {reg.singular}
            </label>
            <input
              id={`reg-${entity}-search`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar ${reg.singular}…`}
              className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-9 pr-8 text-body text-wg-ink placeholder:text-[#9AA590] focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-wg-ink-muted hover:text-wg-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          {hasStatus && (
            <SegmentedControl<StatusFilter>
              label="Filtrar por status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" },
              ]}
            />
          )}
          <p className="ml-auto text-label font-normal text-wg-ink-muted" aria-live="polite">
            {filtered.length === items.length ? "" : `${filtered.length} de ${items.length}`}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Nenhum${reg.article === "a" ? "a" : ""} ${reg.singular} cadastrad${reg.article}`}
          description={reg.description}
          action={
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              {newLabel}
            </Button>
          }
          className="border-t border-wg-border-lighter"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title={query ? `Nada encontrado para “${query}”` : `Nenhum${reg.article === "a" ? "a" : ""} ${reg.singular} neste filtro`}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-wg-border-lighter text-label uppercase tracking-[0.06em] text-wg-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  {capitalize(reg.singular)}
                </th>
                {hasRequired && (
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Obrigatório
                  </th>
                )}
                {hasStatus && (
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Status
                  </th>
                )}
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Uso
                </th>
                <th scope="col" className="w-14 px-3 py-2.5 font-semibold">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wg-border-lighter">
              {visible.map((item) => (
                <tr key={item.id} className="group transition-colors hover:bg-wg-bg/60">
                  <td className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-sm text-left text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                        item.active === false ? "text-wg-ink-muted" : "text-wg-ink hover:text-wg-green-dark"
                      )}
                    >
                      {hasColor && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ background: item.color ?? "#64748b" }}
                          aria-hidden
                        />
                      )}
                      {item.name}
                    </button>
                  </td>
                  {hasRequired && (
                    <td className="px-3 py-2.5 text-meta text-wg-ink-secondary">{item.required ? "Sim" : "Não"}</td>
                  )}
                  {hasStatus && (
                    <td className="px-3 py-2.5">
                      {item.active ? (
                        <StatusBadge tone="success">Ativ{reg.article}</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Inativ{reg.article}</StatusBadge>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-meta text-wg-ink-muted">
                    {item.usage.total === 0 ? (
                      <span>Sem uso</span>
                    ) : (
                      <span title={item.usage.parts.map((p) => `${p.count} ${p.label}`).join(" · ")}>
                        {item.usage.parts.map((p) => `${p.count} ${p.label}`).join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu
                      ariaLabel={`Ações de ${item.name}`}
                      title="Ações"
                      portal
                      trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                      triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                      items={[
                        { label: "Editar", icon: Pencil, onSelect: () => setEditing(item) },
                        ...(item.active !== null
                          ? [{ label: item.active ? "Desativar" : "Reativar", icon: Power, onSelect: () => toggleActive(item) }]
                          : []),
                        { type: "separator" as const },
                        { label: "Excluir", icon: Trash2, danger: true, onSelect: () => setDeleting(item) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3 border-t border-wg-border-lighter px-5 py-2.5">
          <p className="text-label font-normal text-wg-ink-muted">
            {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="px-2 text-label text-wg-ink-secondary">
              {current + 1} / {pages}
            </span>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Próxima página"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </nav>
      )}

      <RegistryItemDialog
        entity={entity}
        item={editing}
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <RegistryDeleteDialog entity={entity} item={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
