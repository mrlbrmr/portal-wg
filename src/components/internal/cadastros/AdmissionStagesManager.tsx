"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, Eye, EyeOff, KanbanSquare, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { SortableList } from "@/components/internal/settings/SortableList";
import { settingsSelectClass } from "@/components/internal/settings/fields";
import {
  removeAdmissionStage,
  reorderCategories,
  setConclusionStage,
  updateCategory,
  type ActionResult,
} from "@/lib/admissao/config-actions";
import type { RegistryItem } from "@/lib/admissao/registry-data";
import { RegistryItemDialog } from "./RegistryItemDialog";

/**
 * Etapas do quadro de admissões: ordem por arrastar e soltar, cor, status e a ÚNICA
 * etapa de conclusão (isFinal) — a que conta como "admissão concluída" nas métricas.
 */
export function AdmissionStagesManager({ stages }: { stages: RegistryItem[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(stages);
  const [editing, setEditing] = useState<RegistryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [removal, setRemoval] = useState<{ stage: RegistryItem; mode: "delete" | "deactivate" } | null>(null);

  useEffect(() => setItems(stages), [stages]);

  const conclusion = items.find((s) => s.isFinal) ?? null;
  const activeStages = items.filter((s) => s.active);

  function run(action: () => Promise<ActionResult>, ok?: string, onError?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        onError?.();
        notify("error", res.error);
        return;
      }
      if (ok) notify("success", ok);
      router.refresh();
    });
  }

  function reorder(next: RegistryItem[]) {
    const prev = items;
    setItems(next);
    run(() => reorderCategories("stage", next.map((s) => s.id)), "Ordem das etapas salva.", () => setItems(prev));
  }

  function move(id: string, dir: -1 | 1) {
    const i = items.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  }

  function toggleActive(s: RegistryItem) {
    if (s.active && s.isFinal) {
      notify("error", "Esta é a etapa de conclusão. Escolha outra etapa de conclusão antes de desativá-la.");
      return;
    }
    if (s.active && s.usage.total > 0) {
      setRemoval({ stage: s, mode: "deactivate" });
      return;
    }
    run(() => updateCategory("stage", s.id, { active: !s.active }), s.active ? "Etapa desativada." : "Etapa reativada.");
  }

  return (
    <div className="space-y-5">
      {/* Etapa de conclusão */}
      <section className="rounded-card border border-wg-border-lighter bg-white p-5" aria-labelledby="conclusion-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 id="conclusion-title" className="flex items-center gap-2 font-sora text-section-title text-wg-ink">
              <CheckCircle2 className="h-4 w-4 text-success-fg" aria-hidden /> Etapa de conclusão da admissão
            </h2>
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Admissões nesta etapa contam como concluídas nos indicadores e saem da lista de admissões em andamento.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <label htmlFor="conclusion-stage" className="sr-only">
              Etapa de conclusão
            </label>
            <select
              id="conclusion-stage"
              value={conclusion?.id ?? ""}
              disabled={pending || activeStages.length === 0}
              onChange={(e) =>
                e.target.value &&
                run(() => setConclusionStage(e.target.value), "Etapa de conclusão atualizada.")
              }
              className={settingsSelectClass}
            >
              {!conclusion && <option value="">Selecione a etapa…</option>}
              {activeStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!conclusion && (
          <p role="note" className="mt-3 rounded-control border border-warning-border bg-warning-bg px-3 py-2 text-meta text-warning-fg">
            Nenhuma etapa de conclusão definida: nenhuma admissão é contada como concluída.
          </p>
        )}
      </section>

      {/* Etapas */}
      <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="adm-stages-title">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 id="adm-stages-title" className="font-sora text-section-title text-wg-ink">
                Etapas do quadro
              </h2>
              <span className="text-meta text-wg-ink-muted">
                {activeStages.length} ativa(s){items.length > activeStages.length && ` · ${items.length - activeStages.length} desativada(s)`}
              </span>
            </div>
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Arraste pela alça <span aria-hidden>⋮⋮</span> para definir a ordem das colunas no quadro de admissões.
            </p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Nova etapa
          </Button>
        </header>

        {items.length === 0 ? (
          <EmptyState
            icon={KanbanSquare}
            title="Nenhuma etapa cadastrada"
            description="Crie as etapas pelas quais as admissões passam, da documentação à conclusão."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                Nova etapa
              </Button>
            }
            className="border-t border-wg-border-lighter"
          />
        ) : (
          <SortableList
            label="Etapas do quadro de admissões"
            items={items}
            getId={(s) => s.id}
            getLabel={(s) => `Etapa ${s.name}`}
            onReorder={reorder}
            disabled={pending}
            className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter"
            renderItem={(s, { handle, index }) => (
              <div className={cn("flex items-center gap-2 px-3 py-2.5 sm:px-4", !s.active && "bg-wg-bg/60")}>
                {handle}
                <span className="w-5 shrink-0 text-center text-label tabular-nums text-wg-ink-muted" aria-hidden>
                  {index + 1}
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: s.color ?? "#94a3b8" }} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className={cn(
                      "min-w-0 truncate rounded-sm text-left text-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                      s.active ? "text-wg-ink" : "text-wg-ink-muted line-through decoration-wg-ink-muted/40"
                    )}
                  >
                    {s.name}
                  </button>
                  {s.isFinal && (
                    <StatusBadge tone="success" icon={CheckCircle2}>
                      Conclusão
                    </StatusBadge>
                  )}
                  {!s.active && <span className="text-label font-medium text-wg-ink-muted">Desativada</span>}
                  {s.usage.total > 0 && (
                    <span
                      className={cn("inline-flex items-center gap-1 text-label", s.active ? "text-wg-ink-muted" : "font-medium text-warning-fg")}
                      title={s.active ? undefined : "Estas admissões não aparecem no quadro enquanto a etapa estiver desativada."}
                    >
                      <Users className="h-3 w-3" aria-hidden />
                      {s.usage.total} {s.usage.total === 1 ? "admissão" : "admissões"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(s)}
                  disabled={pending}
                  aria-label={s.active ? `Desativar etapa ${s.name}` : `Reativar etapa ${s.name}`}
                  title={s.active ? "Desativar (a etapa sai do quadro de admissões)" : "Reativar etapa"}
                  className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                >
                  {s.active ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                </button>
                <DropdownMenu
                  ariaLabel={`Mais ações da etapa ${s.name}`}
                  title="Mais ações"
                  portal
                  disabled={pending}
                  trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                  triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                  items={[
                    { label: "Editar", icon: Pencil, onSelect: () => setEditing(s) },
                    { label: "Mover para cima", icon: ArrowUp, disabled: index === 0, onSelect: () => move(s.id, -1) },
                    { label: "Mover para baixo", icon: ArrowDown, disabled: index === items.length - 1, onSelect: () => move(s.id, 1) },
                    { type: "separator" },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      danger: true,
                      disabled: !!s.isFinal,
                      hint: s.isFinal ? "etapa de conclusão" : undefined,
                      onSelect: () => setRemoval({ stage: s, mode: "delete" }),
                    },
                  ]}
                />
              </div>
            )}
          />
        )}
      </section>

      <RegistryItemDialog
        entity="stage"
        item={editing}
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <AdmissionStageRemovalDialog
        target={removal}
        destinations={activeStages}
        onClose={() => setRemoval(null)}
        onDone={() => {
          setRemoval(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function AdmissionStageRemovalDialog({
  target,
  destinations,
  onClose,
  onDone,
}: {
  target: { stage: RegistryItem; mode: "delete" | "deactivate" } | null;
  destinations: RegistryItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [moveTo, setMoveTo] = useState("");
  const stage = target?.stage;
  const options = destinations.filter((d) => d.id !== stage?.id);

  useEffect(() => {
    if (stage) setMoveTo(options[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  if (!target || !stage) return null;
  const used = stage.usage.total;
  const willDelete = target.mode === "delete" && used === 0;

  function confirm() {
    startTransition(async () => {
      const res = await removeAdmissionStage(stage!.id, { mode: target!.mode, moveTo: used > 0 ? moveTo || null : null });
      if (!res.ok) return notify("error", res.error);
      notify(
        "success",
        `${res.outcome === "deleted" ? "Etapa excluída." : "Etapa desativada."}${res.moved ? ` ${res.moved} admissão(ões) movida(s).` : ""}`
      );
      onDone();
    });
  }

  return (
    <Dialog
      open
      alert
      onClose={onClose}
      busy={pending}
      title={target.mode === "delete" ? `Excluir a etapa “${stage.name}”?` : `Desativar a etapa “${stage.name}”?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} loading={pending}>
            {willDelete
              ? "Excluir etapa"
              : used > 0 && moveTo
                ? target.mode === "delete"
                  ? "Mover e excluir"
                  : "Mover e desativar"
                : "Desativar etapa"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-body text-wg-ink-secondary">
        {used > 0 ? (
          <>
            <p className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-warning-fg">
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong>
                  {used} {used === 1 ? "admissão está" : "admissões estão"}
                </strong>{" "}
                nesta etapa. Nenhuma admissão é excluída.
              </span>
            </p>
            <div>
              <label htmlFor="adm-stage-move" className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
                O que fazer com essas admissões?
              </label>
              <select id="adm-stage-move" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={settingsSelectClass}>
                {options.map((d) => (
                  <option key={d.id} value={d.id}>
                    Mover para “{d.name}”
                  </option>
                ))}
                <option value="">Não mover (ficam fora do quadro até a etapa ser reativada)</option>
              </select>
            </div>
            {target.mode === "delete" && (
              <p className="text-meta text-wg-ink-muted">
                {moveTo
                  ? "Depois de mover as admissões, a etapa é excluída."
                  : "Sem mover as admissões, a etapa é desativada em vez de excluída — assim nenhuma admissão fica sem etapa."}
              </p>
            )}
          </>
        ) : willDelete ? (
          <p>Nenhuma admissão está nesta etapa. Ela será excluída definitivamente.</p>
        ) : (
          <p>A etapa sai do quadro de admissões e pode ser reativada a qualquer momento.</p>
        )}
      </div>
    </Dialog>
  );
}
