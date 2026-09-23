"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  KanbanSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import { SortableList } from "@/components/internal/settings/SortableList";
import { ColorInput } from "@/components/internal/settings/ColorInput";
import { settingsInputClass, settingsSelectClass } from "@/components/internal/settings/fields";
import {
  createStage,
  duplicateStage,
  recolorStage,
  renameStage,
  reorderStages,
  setStageActive,
  setStageAutomations,
  setStageBoardVisibility,
  setStageKind,
  setStageTemplate,
  type ActionResult,
} from "@/lib/selection-funnel/config-actions";
import {
  STAGE_KINDS,
  STAGE_KIND_DESCRIPTIONS,
  STAGE_KIND_LABELS,
  automationsFor,
  isAutomationOn,
  parseAutomations,
  type StageKind,
} from "@/lib/selection-funnel/automations";
import { StageRemovalDialog } from "./funnel/StageRemovalDialog";

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  kind: StageKind;
  active: boolean;
  templateId: string | null;
  hideFromBoard: boolean;
  automations: unknown;
  /** Candidatos nesta etapa agora (todas as vagas). */
  candidates: number;
}

export interface TemplateOption {
  id: string;
  name: string;
  kind: string;
}

const KIND_BADGE: Record<StageKind, string> = {
  OPEN: "border-wg-border-light bg-white text-wg-ink-secondary",
  TEST: "border-info-border bg-info-bg text-info-fg",
  ADMISSION: "border-[#D8CCF0] bg-[#F3EEFB] text-[#5B3F99]",
  WON: "border-success-border bg-success-bg text-success-fg",
  LOST: "border-danger-border bg-danger-bg text-danger-fg",
};

export function StageKindBadge({ kind }: { kind: StageKind }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11.5px] font-semibold",
        KIND_BADGE[kind]
      )}
    >
      {kind === "TEST" && <FlaskConical className="h-3 w-3" aria-hidden />}
      {STAGE_KIND_LABELS[kind]}
    </span>
  );
}

interface Props {
  stages: FunnelStage[];
  templates: TemplateOption[];
}

export function FunnelStagesManager({ stages, templates }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(stages);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [removal, setRemoval] = useState<{ stage: FunnelStage; mode: "delete" | "deactivate" } | null>(null);

  useEffect(() => setItems(stages), [stages]);

  const templateName = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates]);
  const activeCount = items.filter((s) => s.active).length;
  const hasWon = items.some((s) => s.active && s.kind === "WON");
  const hasLost = items.some((s) => s.active && s.kind === "LOST");

  function run(action: () => Promise<ActionResult>, successMsg?: string, onError?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        onError?.();
        notify("error", res.error ?? "Não foi possível concluir.");
        return;
      }
      if (successMsg) notify("success", successMsg);
      router.refresh();
    });
  }

  function patchLocal(id: string, p: Partial<FunnelStage>) {
    setItems((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  function reorder(next: FunnelStage[]) {
    const previous = items;
    setItems(next);
    run(() => reorderStages(next.map((s) => s.id)), "Ordem das etapas salva.", () => setItems(previous));
  }

  function move(id: string, dir: -1 | 1) {
    const i = items.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  }

  function onAdd() {
    const name = newName.trim();
    if (!name) return;
    run(() => createStage(name), `Etapa "${name}" criada.`);
    setNewName("");
    setAdding(false);
  }

  function toggleActive(s: FunnelStage) {
    if (s.active && s.candidates > 0) {
      setRemoval({ stage: s, mode: "deactivate" });
      return;
    }
    patchLocal(s.id, { active: !s.active });
    run(
      () => setStageActive(s.id, !s.active),
      s.active ? `Etapa "${s.name}" desativada.` : `Etapa "${s.name}" reativada.`,
      () => patchLocal(s.id, { active: s.active })
    );
  }

  return (
    <div className="space-y-4">
      {(!hasWon || !hasLost) && (
        <div role="note" className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-meta text-warning-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {!hasWon && !hasLost
              ? "Não há etapas ativas do tipo Contratado nem Reprovado."
              : !hasWon
                ? "Não há etapa ativa do tipo Contratado."
                : "Não há etapa ativa do tipo Reprovado."}{" "}
            Sem elas, os indicadores de contratação e reprovação ficam zerados.
          </span>
        </div>
      )}

      <section className="rounded-card border border-wg-border-lighter bg-white" aria-labelledby="funnel-stages-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-wg-border-lighter px-5 py-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 id="funnel-stages-title" className="font-sora text-section-title text-wg-ink">
                Etapas
              </h2>
              <span className="text-meta text-wg-ink-muted">
                {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
                {items.length > activeCount && ` · ${items.length - activeCount} desativada(s)`}
              </span>
            </div>
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Arraste pela alça <span aria-hidden>⋮⋮</span> para mudar a ordem. A ordem vale para todas as vagas.
            </p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={adding}>
            Nova etapa
          </Button>
        </header>

        {adding && (
          <form
            className="flex flex-wrap items-center gap-2 border-b border-wg-border-lighter bg-wg-bg/60 px-5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              onAdd();
            }}
          >
            <label htmlFor="new-stage" className="sr-only">
              Nome da nova etapa
            </label>
            <input
              id="new-stage"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="Nome da etapa (ex.: Teste técnico)"
              maxLength={120}
              className={cn(settingsInputClass, "min-w-0 flex-1")}
            />
            <Button variant="tertiary" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </form>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={KanbanSquare}
            title="Nenhuma etapa configurada"
            description="Crie as etapas pelas quais os candidatos passam nos processos seletivos."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Nova etapa
              </Button>
            }
          />
        ) : (
          <SortableList
            label="Etapas do funil de seleção"
            items={items}
            getId={(s) => s.id}
            getLabel={(s) => `Etapa ${s.name}`}
            onReorder={reorder}
            disabled={pending}
            className="divide-y divide-wg-border-lighter"
            renderItem={(s, { handle, index }) => (
              <StageRow
                stage={s}
                index={index}
                total={items.length}
                handle={handle}
                pending={pending}
                expanded={expanded === s.id}
                renaming={renaming === s.id}
                templates={templates}
                templateName={s.templateId ? templateName.get(s.templateId) ?? null : null}
                onToggleExpand={() => setExpanded((cur) => (cur === s.id ? null : s.id))}
                onStartRename={() => setRenaming(s.id)}
                onRename={(name) => {
                  setRenaming(null);
                  if (!name || name === s.name) return;
                  patchLocal(s.id, { name });
                  run(() => renameStage(s.id, name), "Etapa renomeada.", () => patchLocal(s.id, { name: s.name }));
                }}
                onCancelRename={() => setRenaming(null)}
                onDuplicate={() => run(() => duplicateStage(s.id), `Etapa "${s.name}" duplicada.`)}
                onMove={(dir) => move(s.id, dir)}
                onToggleActive={() => toggleActive(s)}
                onDelete={() => setRemoval({ stage: s, mode: "delete" })}
                onKind={(kind) => {
                  patchLocal(s.id, { kind });
                  run(() => setStageKind(s.id, kind), "Tipo da etapa atualizado.", () => patchLocal(s.id, { kind: s.kind }));
                }}
                onColor={(color) => run(() => recolorStage(s.id, color), "Cor atualizada.")}
                onTemplate={(templateId) => {
                  patchLocal(s.id, { templateId });
                  run(
                    () => setStageTemplate(s.id, templateId),
                    templateId ? "Teste vinculado." : "Vínculo removido.",
                    () => patchLocal(s.id, { templateId: s.templateId })
                  );
                }}
                onBoard={(show) => {
                  patchLocal(s.id, { hideFromBoard: !show });
                  run(
                    () => setStageBoardVisibility(s.id, show),
                    show ? "Etapa exibida no quadro." : "Etapa ocultada do quadro.",
                    () => patchLocal(s.id, { hideFromBoard: s.hideFromBoard })
                  );
                }}
                onAutomation={(key, on) => {
                  const next = { ...parseAutomations(s.automations), [key]: on };
                  patchLocal(s.id, { automations: next });
                  run(
                    () => setStageAutomations(s.id, next),
                    on ? "Automação ativada." : "Automação desativada.",
                    () => patchLocal(s.id, { automations: s.automations })
                  );
                }}
              />
            )}
          />
        )}
      </section>

      <StageRemovalDialog
        target={removal}
        stages={items}
        onClose={() => setRemoval(null)}
        onDone={() => {
          setRemoval(null);
          router.refresh();
        }}
      />
    </div>
  );
}

// ─── Linha da etapa ───────────────────────────────────────────────────────────

interface RowProps {
  stage: FunnelStage;
  index: number;
  total: number;
  handle: React.ReactNode;
  pending: boolean;
  expanded: boolean;
  renaming: boolean;
  templates: TemplateOption[];
  templateName: string | null;
  onToggleExpand: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onKind: (kind: StageKind) => void;
  onColor: (color: string) => void;
  onTemplate: (templateId: string | null) => void;
  onBoard: (show: boolean) => void;
  onAutomation: (key: "openAdmission" | "createTestLink", on: boolean) => void;
}

function StageRow(p: RowProps) {
  const s = p.stage;
  const panelId = `stage-config-${s.id}`;
  const activeAutomations = automationsFor(s.kind).filter((a) => isAutomationOn(s, a.key));

  return (
    <div className={cn("bg-white", !s.active && "bg-wg-bg/60")}>
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        {p.handle}
        <span className="w-5 shrink-0 text-center text-label tabular-nums text-wg-ink-muted" aria-hidden>
          {p.index + 1}
        </span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: s.color }} aria-hidden />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {p.renaming ? (
            <RenameInput initial={s.name} onSubmit={p.onRename} onCancel={p.onCancelRename} />
          ) : (
            <button
              type="button"
              onClick={p.onToggleExpand}
              aria-expanded={p.expanded}
              aria-controls={panelId}
              className={cn(
                "min-w-0 truncate rounded-sm text-left text-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
                s.active ? "text-wg-ink" : "text-wg-ink-muted line-through decoration-wg-ink-muted/40"
              )}
            >
              {s.name}
            </button>
          )}
          <StageKindBadge kind={s.kind} />
          {!s.active && (
            <span className="text-label font-medium text-wg-ink-muted">Desativada</span>
          )}
          {s.kind === "TEST" && (
            <span className={cn("text-label", p.templateName ? "text-wg-ink-muted" : "text-warning-fg")}>
              {p.templateName ? `Teste: ${p.templateName}` : "Sem teste vinculado"}
            </span>
          )}
          {s.hideFromBoard && s.active && <span className="text-label text-wg-ink-muted">Fora do quadro</span>}
          {activeAutomations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-label text-wg-ink-muted" title={activeAutomations.map((a) => a.label).join(" · ")}>
              <Zap className="h-3 w-3" aria-hidden />
              {activeAutomations.length === 1 ? "1 automação" : `${activeAutomations.length} automações`}
            </span>
          )}
          {s.candidates > 0 && (
            <span
              className={cn("inline-flex items-center gap-1 text-label", s.active ? "text-wg-ink-muted" : "font-medium text-warning-fg")}
              title={s.active ? undefined : "Estes candidatos não aparecem no quadro enquanto a etapa estiver desativada."}
            >
              <Users className="h-3 w-3" aria-hidden />
              {s.candidates} {s.candidates === 1 ? "candidato" : "candidatos"}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={p.onToggleActive}
          disabled={p.pending}
          aria-label={s.active ? `Desativar etapa ${s.name}` : `Reativar etapa ${s.name}`}
          title={s.active ? "Desativar (a etapa sai do funil de todas as vagas)" : "Reativar etapa"}
          className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
        >
          {s.active ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        </button>

        <DropdownMenu
          ariaLabel={`Mais ações da etapa ${s.name}`}
          title="Mais ações"
          trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
          triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
          portal
          disabled={p.pending}
          items={[
            { label: "Renomear", icon: Pencil, onSelect: p.onStartRename },
            { label: "Duplicar", icon: Copy, onSelect: p.onDuplicate },
            { type: "separator" },
            { label: "Mover para cima", icon: ArrowUp, onSelect: () => p.onMove(-1), disabled: p.index === 0 },
            { label: "Mover para baixo", icon: ArrowDown, onSelect: () => p.onMove(1), disabled: p.index === p.total - 1 },
            { type: "separator" },
            { label: "Excluir", icon: Trash2, danger: true, onSelect: p.onDelete },
          ]}
        />

        <button
          type="button"
          onClick={p.onToggleExpand}
          aria-expanded={p.expanded}
          aria-controls={panelId}
          aria-label={p.expanded ? `Recolher configurações de ${s.name}` : `Configurar etapa ${s.name}`}
          title={p.expanded ? "Recolher" : "Configurar"}
          className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
        >
          <ChevronDown className={cn("transition-transform", p.expanded && "rotate-180")} aria-hidden />
        </button>
      </div>

      {p.expanded && (
        <div id={panelId} className="border-t border-wg-border-lighter bg-wg-bg/50 px-4 py-4 sm:pl-[76px]">
          <StageConfig {...p} />
        </div>
      )}
    </div>
  );
}

function RenameInput({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      aria-label="Nome da etapa"
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onSubmit(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      className={cn(settingsInputClass, "h-8 max-w-xs py-1")}
    />
  );
}

// ─── Configurações da etapa (painel expandido) ───────────────────────────────

function StageConfig(p: RowProps) {
  const s = p.stage;
  const kindId = `stage-kind-${s.id}`;
  const colorId = `stage-color-${s.id}`;
  const tplId = `stage-tpl-${s.id}`;
  const available = automationsFor(s.kind);
  const values = parseAutomations(s.automations);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label htmlFor={kindId} className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
            Tipo da etapa
          </label>
          <select
            id={kindId}
            value={s.kind}
            disabled={p.pending}
            onChange={(e) => p.onKind(e.target.value as StageKind)}
            className={settingsSelectClass}
            aria-describedby={`${kindId}-hint`}
          >
            {STAGE_KINDS.map((k) => (
              <option key={k} value={k}>
                {STAGE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <p id={`${kindId}-hint`} className="mt-1 text-label font-normal text-wg-ink-muted">
            {STAGE_KIND_DESCRIPTIONS[s.kind]}
          </p>
        </div>

        {s.kind === "TEST" && (
          <div>
            <label htmlFor={tplId} className="mb-1.5 block text-label font-semibold text-wg-ink-secondary">
              Teste vinculado
            </label>
            <select
              id={tplId}
              value={s.templateId ?? ""}
              disabled={p.pending}
              onChange={(e) => p.onTemplate(e.target.value || null)}
              className={settingsSelectClass}
            >
              <option value="">Nenhum teste vinculado</option>
              {p.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {p.templates.length === 0 && (
              <p className="mt-1 text-label font-normal text-wg-ink-muted">
                Nenhum teste ativo no banco de avaliações.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <label htmlFor={colorId} className="text-label font-semibold text-wg-ink-secondary">
            Cor no quadro
          </label>
          <ColorInput id={colorId} value={s.color} disabled={p.pending} onCommit={p.onColor} />
        </div>

        <div className="rounded-control border border-wg-border-lighter bg-white px-3">
          <Toggle
            label="Mostrar como coluna no quadro de candidatos"
            description="Etapas fora do quadro continuam disponíveis em “Mover para…” (ex.: candidatos em espera)."
            checked={!s.hideFromBoard}
            disabled={p.pending}
            onChange={() => p.onBoard(s.hideFromBoard)}
          />
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-label font-semibold text-wg-ink-secondary">
          <Zap className="h-3.5 w-3.5" aria-hidden /> Automações
        </p>
        <p className="mt-0.5 text-label font-normal text-wg-ink-muted">Ao candidato entrar nesta etapa:</p>
        {available.length === 0 ? (
          <p className="mt-2 rounded-control border border-dashed border-wg-border-light bg-white px-3 py-3 text-meta text-wg-ink-muted">
            Nenhuma automação disponível para etapas do tipo {STAGE_KIND_LABELS[s.kind]}. Hoje há automações para
            etapas de Teste, Admissão e Contratado.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-wg-border-lighter rounded-control border border-wg-border-lighter bg-white px-3">
            {available.map((a) => {
              const blocked = a.requiresTemplate && !s.templateId;
              return (
                <Toggle
                  key={a.key}
                  label={a.label}
                  description={blocked ? "Vincule um teste à etapa para usar esta automação." : a.description}
                  checked={!blocked && (values[a.key] ?? a.defaultOn)}
                  disabled={p.pending || blocked}
                  stateLabels={["Ativa", "Inativa"]}
                  onChange={() => p.onAutomation(a.key, !(values[a.key] ?? a.defaultOn))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
