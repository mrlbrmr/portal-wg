"use client";

import { useState, useTransition, useOptimistic, useRef } from "react";
import {
  Plus,
  Trash2,
  Wand2,
  ListChecks,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckSquare2,
  X,
  Copy,
  CornerDownRight,
  Pencil,
  GripVertical,
  Printer,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { SubtaskProgress } from "./SubtaskProgress";
import type { ActionResult } from "@/lib/admissao/actions";
import {
  applyChecklistTemplate,
  addChecklistGroup,
  deleteChecklistGroup,
  addChecklistItem,
  addChecklistSubtask,
  updateChecklistItem,
  setChecklistItemDone,
  deleteChecklistItem,
  moveChecklistGroup,
  reorderChecklistItems,
  duplicateChecklistGroup,
} from "@/lib/admissao/actions";

type Status = "PENDING" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE";

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  NOT_APPLICABLE: "N/A",
};

export interface ChecklistItemView {
  id: string;
  name: string;
  status: Status;
  dueDate: string | null; // "YYYY-MM-DD"
  subtasks: ChecklistItemView[];
}
export interface ChecklistGroupView {
  id: string;
  name: string;
  items: ChecklistItemView[];
}

interface Props {
  admissionId: string;
  canManage: boolean;
  groups: ChecklistGroupView[];
  templates: { id: string; name: string }[];
}

const smallInput =
  "h-8 rounded-md border border-[#DCE8CC] px-2 text-xs text-[#1A2213] focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30 focus:border-[#90CB46] bg-white";

function countLeaves(items: ChecklistItemView[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const it of items) {
    if (it.subtasks.length === 0) {
      total += 1;
      if (it.status === "DONE") done += 1;
    } else {
      const c = countLeaves(it.subtasks);
      done += c.done;
      total += c.total;
    }
  }
  return { done, total };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < todayISO();
}

export function AdmissionChecklist({ admissionId, canManage, groups, templates }: Props) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tplId, setTplId] = useState("");
  const [newGroup, setNewGroup] = useState("");

  // Grupos colapsados (todos expandidos por padrão)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Itens com subtarefas: iniciam COLAPSADOS
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      for (const it of g.items) {
        if (it.subtasks.length > 0) ids.add(it.id);
      }
    }
    return ids;
  });

  const [hideDone, setHideDone] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [drag, setDrag] = useState<{ id: string; scope: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function onDragStartItem(id: string, scope: string) {
    setDrag({ id, scope });
  }
  function onDragEnterItem(id: string, scope: string) {
    if (drag && drag.scope === scope && drag.id !== id) setDragOverId(id);
  }
  function onDragEndItem() {
    setDrag(null);
    setDragOverId(null);
  }
  function onDropItem(scope: string, siblingIds: string[], targetId: string) {
    const d = drag;
    onDragEndItem();
    if (!d || d.scope !== scope || d.id === targetId) return;
    const from = siblingIds.indexOf(d.id);
    const to = siblingIds.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...siblingIds];
    next.splice(from, 1);
    next.splice(to, 0, d.id);
    run(() => reorderChecklistItems(admissionId, next));
  }

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
    });
  }

  function runCheck(itemId: string, currentChecked: boolean, onError?: () => void) {
    const nextValue = !currentChecked;
    startTransition(async () => {
      const res = await setChecklistItemDone(admissionId, itemId, nextValue);
      if (!res.ok) {
        onError?.();
        notify("error", res.error);
      }
    });
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleItemCollapse(id: string) {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setCollapsedGroups(new Set());
    setCollapsedItems(new Set());
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }

  function bulkUpdate(status: Status) {
    const ids = [...selectedItems];
    startTransition(async () => {
      const results = await Promise.all(
        ids.map((id) => updateChecklistItem(admissionId, id, { status }))
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) notify("error", `${failed} item(s) não puderam ser atualizados.`);
      else notify("success", `${ids.length} item(s) marcados como "${STATUS_LABEL[status]}".`);
      exitSelectionMode();
    });
  }

  const { done, total } = countLeaves(groups.flatMap((g) => g.items));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const rowCtx: RowContext = {
    admissionId,
    canManage,
    isPending,
    selectionMode,
    selectedItems,
    toggleSelect,
    collapsedItems,
    toggleItemCollapse,
    hideDone,
    run,
    runCheck,
    dragId: drag?.id ?? null,
    dragScope: drag?.scope ?? null,
    dragOverId,
    onDragStartItem,
    onDragEnterItem,
    onDragEndItem,
    onDropItem,
  };

  return (
    <div className="bg-white border border-[#E7EEDD] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.05)]">
      {/* Cabeçalho global */}
      <div className="px-5 py-4 border-b border-[#EEF2E9]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1A2213] flex items-center gap-2 font-sora">
              <ListChecks className="w-4 h-4" /> Checklist de G&amp;G
            </h2>
            <p className="text-[12.5px] text-[#55614A] mt-0.5">
              {done} de {total} concluídos · {pct}%
            </p>
          </div>

          {/* Ações globais */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="bg-[#F6F8F3] text-[#3E4A34] border border-[#E7EEDD] px-3.5 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#EEF2E9] transition-colors"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={() => setHideDone((v) => !v)}
              className="px-3.5 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap border transition-colors"
              style={{
                background: hideDone ? "#90CB46" : "#F6F8F3",
                color: hideDone ? "#0C0D0C" : "#3E4A34",
                borderColor: hideDone ? "#90CB46" : "#E7EEDD",
              }}
            >
              Ocultar concluídos
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#F6F8F3] text-[#3E4A34] border border-[#E7EEDD] px-3.5 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#EEF2E9] transition-colors inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedItems(new Set());
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                    selectionMode
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      : "text-[#55614A] hover:bg-[#F0F5E8] hover:text-[#1A2213]"
                  }`}
                >
                  <CheckSquare2 className="w-3.5 h-3.5" />
                  {selectionMode ? "Cancelar seleção" : "Selecionar"}
                </button>
                <select
                  value={tplId}
                  onChange={(e) => setTplId(e.target.value)}
                  className={smallInput}
                >
                  <option value="">Aplicar modelo…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!tplId || isPending}
                  onClick={() =>
                    run(async () => {
                      const r = await applyChecklistTemplate(admissionId, tplId);
                      if (r.ok) {
                        notify("success", "Modelo aplicado.");
                        setTplId("");
                      }
                      return r;
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F6930] hover:opacity-80 disabled:opacity-40"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Aplicar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de progresso global */}
        {total > 0 && (
          <div className="mt-3 h-1.5 bg-[#EEF2E9] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#90CB46] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        {groups.length === 0 && (
          <p className="text-sm text-[#8A9480] text-center py-6">
            Nenhum grupo ainda.{" "}
            {canManage ? "Aplique um modelo ou crie um grupo abaixo." : ""}
          </p>
        )}

        {groups.map((g, gIdx) => {
          const { done: gDone, total: gTotal } = countLeaves(g.items);
          const gPct = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;
          const isCollapsed = collapsedGroups.has(g.id);

          // Items visíveis (filtra concluídos quando hideDone)
          const visibleItems = hideDone
            ? g.items.filter((it) => {
                if (it.subtasks.length === 0) return it.status !== "DONE";
                return !it.subtasks.every((s) => s.status === "DONE");
              })
            : g.items;

          // IDs completos para reordenação via DnD (sempre inclui todos)
          const allItemIds = g.items.map((i) => i.id);

          return (
            <div key={g.id} className="border border-[#EEF2E9] rounded-xl overflow-hidden">
              {/* Cabeçalho do grupo */}
              <div
                className="flex items-center gap-2.5 px-4 py-3 bg-[#F6F8F3] cursor-pointer select-none"
                onClick={() => toggleGroup(g.id)}
              >
                <span className="text-[#55614A] text-[11px] shrink-0">
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span className="font-bold text-[14.5px] text-[#1A2213] truncate flex-1">
                  {g.name}
                </span>
                <span className="bg-[#E4EED6] text-[#2E4319] text-[11.5px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  [{gDone}/{gTotal}]
                </span>
                <span className="text-[#3E4A34] text-xs font-bold shrink-0">{gPct}%</span>

                {/* Mini barra de progresso */}
                <div
                  className="w-[80px] h-1.5 bg-[#E7EEDD] rounded-full overflow-hidden shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="h-full bg-[#90CB46] rounded-full transition-all"
                    style={{ width: `${gPct}%` }}
                  />
                </div>

                {/* Ações de admin do grupo */}
                {canManage && (
                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!selectionMode && (
                      <>
                        <button
                          type="button"
                          disabled={gIdx === 0 || isPending}
                          onClick={() => run(() => moveChecklistGroup(admissionId, g.id, "up"))}
                          className="p-1 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-30 disabled:cursor-default"
                          title="Mover grupo para cima"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={gIdx === groups.length - 1 || isPending}
                          onClick={() => run(() => moveChecklistGroup(admissionId, g.id, "down"))}
                          className="p-1 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-30 disabled:cursor-default"
                          title="Mover grupo para baixo"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => run(() => duplicateChecklistGroup(admissionId, g.id))}
                          className="p-1 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-40"
                          title="Duplicar grupo"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <AddItemInline
                      label="Item"
                      onAdd={(name) => run(() => addChecklistItem(admissionId, g.id, name))}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir grupo "${g.name}" e seus itens?`))
                          run(() => deleteChecklistGroup(admissionId, g.id));
                      }}
                      className="p-1 text-[#8A9480] hover:text-red-600 rounded"
                      title="Excluir grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Itens */}
              {!isCollapsed && (
                <div className="divide-y divide-[#F2F5EE]">
                  {visibleItems.length === 0 && (
                    <p className="text-[13px] text-[#8A9480] px-4 py-3.5">
                      {hideDone ? "Todas as tarefas desta fase estão concluídas." : "Sem itens."}
                    </p>
                  )}
                  {visibleItems.map((it, iIdx) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      index={iIdx}
                      siblingCount={g.items.length}
                      depth={0}
                      scope={`grp:${g.id}`}
                      siblingIds={allItemIds}
                      ctx={rowCtx}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Adicionar grupo */}
        {canManage && !selectionMode && (
          <div className="flex items-center gap-2 pt-1">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroup.trim()) {
                  run(() => addChecklistGroup(admissionId, newGroup));
                  setNewGroup("");
                }
              }}
              placeholder="Novo grupo (ex.: Documentos)"
              className={`${smallInput} flex-1 h-9`}
            />
            <button
              type="button"
              disabled={!newGroup.trim() || isPending}
              onClick={() => {
                run(() => addChecklistGroup(admissionId, newGroup));
                setNewGroup("");
              }}
              className="inline-flex items-center gap-1.5 bg-[#F0F5E8] hover:bg-[#E4EED6] text-[#3E5A2A] text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Grupo
            </button>
          </div>
        )}
      </div>

      {/* Toolbar de seleção em lote */}
      {selectionMode && (
        <div className="border-t border-[#1A2213] px-5 py-3 bg-[#1A2213] rounded-b-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-white shrink-0">
              {selectedItems.size > 0
                ? `${selectedItems.size} selecionado(s) · Marcar como:`
                : "Selecione itens acima"}
            </span>
            {selectedItems.size > 0 &&
              (["PENDING", "DONE", "NOT_APPLICABLE"] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={isPending}
                  onClick={() => bulkUpdate(s)}
                  className="text-xs px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            <button
              type="button"
              onClick={exitSelectionMode}
              className="ml-auto text-white/50 hover:text-white transition-colors"
              title="Cancelar seleção"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface RowContext {
  admissionId: string;
  canManage: boolean;
  isPending: boolean;
  selectionMode: boolean;
  selectedItems: Set<string>;
  toggleSelect: (id: string, checked: boolean) => void;
  collapsedItems: Set<string>;
  toggleItemCollapse: (id: string) => void;
  hideDone: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
  runCheck: (itemId: string, currentChecked: boolean, onError?: () => void) => void;
  dragId: string | null;
  dragScope: string | null;
  dragOverId: string | null;
  onDragStartItem: (id: string, scope: string) => void;
  onDragEnterItem: (id: string, scope: string) => void;
  onDragEndItem: () => void;
  onDropItem: (scope: string, siblingIds: string[], targetId: string) => void;
}

function ItemRow({
  item,
  index,
  siblingCount,
  depth,
  scope,
  siblingIds,
  ctx,
}: {
  item: ChecklistItemView;
  index: number;
  siblingCount: number;
  depth: 0 | 1;
  scope: string;
  siblingIds: string[];
  ctx: RowContext;
}) {
  const {
    admissionId, canManage, isPending, selectionMode, selectedItems, toggleSelect,
    collapsedItems, toggleItemCollapse, hideDone, run,
  } = ctx;
  const [editing, setEditing] = useState(false);
  const dateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSub = depth === 1;
  const canDrop = ctx.dragScope === scope;
  const hasSubtasks = !isSub && item.subtasks.length > 0;
  const subsDone = hasSubtasks ? item.subtasks.filter((s) => s.status === "DONE").length : 0;
  const allSubsDone = hasSubtasks && subsDone === item.subtasks.length;
  const checked = hasSubtasks ? allSubsDone : item.status === "DONE";
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked);
  const collapsed = collapsedItems.has(item.id);
  const urgente = !checked && isOverdue(item.dueDate);

  // Subtarefas visíveis (filtra concluídas quando hideDone)
  const visibleSubs = hasSubtasks
    ? (hideDone ? item.subtasks.filter((s) => s.status !== "DONE") : item.subtasks)
    : [];

  return (
    <>
      <div
        className={`group/row flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#FAFBF7] transition-colors ${
          isSub ? "pl-10" : ""
        } ${ctx.dragOverId === item.id ? "bg-[#90CB46]/10" : ""} ${
          ctx.dragId === item.id ? "opacity-50" : ""
        }`}
        onDragOver={canDrop ? (e) => e.preventDefault() : undefined}
        onDragEnter={canDrop ? () => ctx.onDragEnterItem(item.id, scope) : undefined}
        onDrop={canDrop ? () => ctx.onDropItem(scope, siblingIds, item.id) : undefined}
      >
        {isSub && <CornerDownRight className="w-3.5 h-3.5 text-[#C9D6BA] shrink-0 -ml-5" />}

        {/* Toggle de subtarefas (apenas em item-pai) */}
        {!isSub &&
          (hasSubtasks ? (
            <button
              type="button"
              onClick={() => toggleItemCollapse(item.id)}
              className="p-0.5 -ml-1 text-[#8A9480] hover:text-[#3E4A34] rounded shrink-0 transition-colors"
              title={collapsed ? "Mostrar subtarefas" : "Ocultar subtarefas"}
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" aria-hidden />
          ))}

        {/* Checkbox: seleção em lote ou toggle done */}
        {canManage && selectionMode ? (
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={(e) => toggleSelect(item.id, e.target.checked)}
            className="w-4 h-4 shrink-0 accent-[#90CB46]"
          />
        ) : (
          <span
            className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-white text-[11px] font-bold shrink-0 transition-colors"
            style={{
              border: `1.5px solid ${optimisticChecked ? "#90CB46" : "#C9D6BA"}`,
              background: optimisticChecked ? "#90CB46" : "#fff",
              cursor: canManage ? "pointer" : "default",
            }}
            onClick={() => {
              if (!canManage) return;
              // Atualiza visualmente de forma síncrona — antes do startTransition
              setOptimisticChecked(!checked);
              ctx.runCheck(item.id, checked, () => setOptimisticChecked(checked));
            }}
          >
            {optimisticChecked ? "✓" : ""}
          </span>
        )}

        {/* Label */}
        {editing ? (
          <input
            autoFocus
            defaultValue={item.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== item.name)
                run(() => updateChecklistItem(admissionId, item.id, { name: v }));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className={`flex-1 min-w-0 rounded border border-[#DCE8CC] px-1.5 py-0.5 text-[13.5px] text-[#1A2213] focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30`}
          />
        ) : (
          <span
            onDoubleClick={() => {
              if (canManage && !selectionMode) setEditing(true);
            }}
            title={canManage && !selectionMode ? "Duplo clique para editar" : undefined}
            className={`flex-1 min-w-0 break-words text-[13.5px] ${
              checked ? "line-through text-[#8A9480]" : "text-[#1A2213]"
            }`}
          >
            {item.name}
          </span>
        )}

        {/* Badge de progresso de subtarefas */}
        {hasSubtasks && <SubtaskProgress done={subsDone} total={item.subtasks.length} />}

        {/* Tag URGENTE */}
        {urgente && (
          <span className="bg-[#FBE6E1] text-[#8F2F1A] text-[10.5px] font-extrabold px-2 py-0.5 rounded-full tracking-wide whitespace-nowrap shrink-0">
            ⚠ URGENTE
          </span>
        )}

        {/* Data limite (só aparece quando há data e a tarefa não está concluída) */}
        {!checked && item.dueDate && !urgente && (
          <span className="text-[#6B7860] text-[11px] whitespace-nowrap shrink-0">
            {new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
        )}

        {/* Ações do admin (hover) */}
        {canManage && !selectionMode && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
            {/* Campo de data como ação de admin */}
            <input
              type="date"
              defaultValue={item.dueDate ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                if (dateTimerRef.current) clearTimeout(dateTimerRef.current);
                dateTimerRef.current = setTimeout(() => {
                  run(() => updateChecklistItem(admissionId, item.id, { dueDate: val }));
                }, 600);
              }}
              className="h-7 w-[120px] rounded-md border border-[#DCE8CC] px-1.5 text-[11px] text-[#3E4A34] focus:outline-none focus:border-[#90CB46] bg-white"
              title="Data limite"
            />
            {siblingCount > 1 && (
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.id);
                  e.dataTransfer.effectAllowed = "move";
                  ctx.onDragStartItem(item.id, scope);
                }}
                onDragEnd={ctx.onDragEndItem}
                className="cursor-grab active:cursor-grabbing p-0.5 text-[#8A9480] hover:text-[#3E4A34] rounded"
                title="Arrastar para reordenar"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1 text-[#8A9480] hover:text-[#3E4A34] rounded"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!isSub && (
              <AddItemInline
                label="Subtarefa"
                compact
                onAdd={(name) => run(() => addChecklistSubtask(admissionId, item.id, name))}
              />
            )}
            <button
              type="button"
              onClick={() => run(() => deleteChecklistItem(admissionId, item.id))}
              className="p-1 text-[#8A9480] hover:text-red-600 rounded"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Subtarefas — ocultas quando colapsadas */}
      {!isSub && !collapsed &&
        visibleSubs.map((sub, sIdx) => (
          <ItemRow
            key={sub.id}
            item={sub}
            index={sIdx}
            siblingCount={item.subtasks.length}
            depth={1}
            scope={`sub:${item.id}`}
            siblingIds={item.subtasks.map((s) => s.id)}
            ctx={ctx}
          />
        ))}
    </>
  );
}

function AddItemInline({
  onAdd,
  label = "Item",
  compact = false,
}: {
  onAdd: (name: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex items-center gap-1 text-xs text-[#8A9480] hover:text-[#3E4A34] px-1.5 py-1 rounded transition-colors ${
          compact ? "opacity-0 group-hover/row:opacity-100" : ""
        }`}
        title={`Adicionar ${label.toLowerCase()}`}
      >
        <Plus className="w-3.5 h-3.5" /> {compact ? "" : label}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder={`Nova ${label.toLowerCase()}…`}
      className="h-7 w-[180px] rounded-md border border-[#DCE8CC] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30 bg-white"
      onKeyDown={(e) => {
        if (e.key === "Enter" && name.trim()) {
          onAdd(name.trim());
          setName("");
          setEditing(false);
        }
        if (e.key === "Escape") {
          setEditing(false);
          setName("");
        }
      }}
      onBlur={() => setEditing(false)}
    />
  );
}
