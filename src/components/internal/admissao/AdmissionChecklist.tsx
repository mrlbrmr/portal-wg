"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import type { ActionResult } from "@/lib/admissao/actions";
import {
  applyChecklistTemplate,
  addChecklistGroup,
  deleteChecklistGroup,
  addChecklistItem,
  addChecklistSubtask,
  updateChecklistItem,
  deleteChecklistItem,
  moveChecklistGroup,
  moveChecklistItem,
  duplicateChecklistGroup,
} from "@/lib/admissao/actions";

type Status = "PENDING" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE";

const STATUSES: Status[] = ["PENDING", "IN_PROGRESS", "DONE", "NOT_APPLICABLE"];
const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  NOT_APPLICABLE: "N/A",
};
const STATUS_COLOR: Record<Status, string> = {
  PENDING: "#94a3b8",
  IN_PROGRESS: "#3b82f6",
  DONE: "#10b981",
  NOT_APPLICABLE: "#a1a1aa",
};

export interface ChecklistItemView {
  id: string;
  name: string;
  status: Status;
  dueDate: string | null; // "AAAA-MM-DD"
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
  "h-8 rounded-md border border-gray-300 px-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

/** Conta apenas as folhas (itens sem subtarefas): pais viram apenas agrupadores. */
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

export function AdmissionChecklist({ admissionId, canManage, groups, templates }: Props) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tplId, setTplId] = useState("");
  const [newGroup, setNewGroup] = useState("");

  // B1: colapsar grupos
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // B3: seleção múltipla
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
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

  // B2: totais globais (por folhas)
  const { done, total } = countLeaves(groups.flatMap((g) => g.items));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const rowCtx: RowContext = {
    admissionId,
    canManage,
    isPending,
    selectionMode,
    selectedItems,
    toggleSelect,
    run,
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Cabeçalho global */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Checklist
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {done} de {total} concluídos · {pct}%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              {/* B3: botão de modo seleção */}
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedItems(new Set());
                }}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  selectionMode
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-wg-green-dark hover:opacity-80 disabled:opacity-40"
              >
                <Wand2 className="w-3.5 h-3.5" /> Aplicar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* B2: barra de progresso global */}
        {total > 0 && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-wg-green transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        {groups.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum grupo ainda.{" "}
            {canManage ? "Aplique um modelo ou crie um grupo abaixo." : ""}
          </p>
        )}

        {groups.map((g, gIdx) => {
          // B2: totais por seção (por folhas)
          const { done: gDone, total: gTotal } = countLeaves(g.items);
          const gPct = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;
          const isCollapsed = collapsedGroups.has(g.id);

          return (
            <div key={g.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Cabeçalho do grupo (B1 + B2) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-700 rounded transition-colors shrink-0"
                  title={isCollapsed ? "Expandir" : "Recolher"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <span className="font-medium text-sm text-gray-800 truncate">{g.name}</span>
                <span className="shrink-0 text-[11px] text-gray-500 bg-gray-200 rounded-full px-1.5">
                  {gDone}/{gTotal}
                </span>
                {gTotal > 0 && (
                  <span className="shrink-0 text-[11px] text-gray-400">{gPct}%</span>
                )}
                {canManage && (
                  <div className="ml-auto flex items-center gap-1">
                    {!selectionMode && (
                      <>
                        <button
                          type="button"
                          disabled={gIdx === 0 || isPending}
                          onClick={() => run(() => moveChecklistGroup(admissionId, g.id, "up"))}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
                          title="Mover grupo para cima"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={gIdx === groups.length - 1 || isPending}
                          onClick={() => run(() => moveChecklistGroup(admissionId, g.id, "down"))}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
                          title="Mover grupo para baixo"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => run(() => duplicateChecklistGroup(admissionId, g.id))}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-40"
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
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Excluir grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* B2: barra de progresso por seção */}
              {gTotal > 0 && (
                <div className="h-0.5 bg-gray-100">
                  <div
                    className="h-full bg-wg-green transition-all"
                    style={{ width: `${gPct}%` }}
                  />
                </div>
              )}

              {/* B1: itens ocultos quando recolhido */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {g.items.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-3">Sem itens.</p>
                  )}
                  {g.items.map((it, iIdx) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      index={iIdx}
                      siblingCount={g.items.length}
                      depth={0}
                      ctx={rowCtx}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Adicionar grupo (oculto no modo seleção) */}
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
              className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Grupo
            </button>
          </div>
        )}
      </div>

      {/* B3: toolbar de ações em lote */}
      {selectionMode && (
        <div className="border-t border-gray-800 px-5 py-3 bg-gray-900 rounded-b-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-white shrink-0">
              {selectedItems.size > 0
                ? `${selectedItems.size} selecionado(s) · Marcar como:`
                : "Selecione itens acima"}
            </span>
            {selectedItems.size > 0 &&
              STATUSES.map((s) => (
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
              className="ml-auto text-gray-400 hover:text-white transition-colors"
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
  run: (fn: () => Promise<ActionResult>) => void;
}

/** Uma linha de item de checklist. Em depth 0, renderiza também suas subtarefas. */
function ItemRow({
  item,
  index,
  siblingCount,
  depth,
  ctx,
}: {
  item: ChecklistItemView;
  index: number;
  siblingCount: number;
  depth: 0 | 1;
  ctx: RowContext;
}) {
  const { admissionId, canManage, isPending, selectionMode, selectedItems, toggleSelect, run } = ctx;
  const isSub = depth === 1;

  return (
    <>
      <div
        className={`group flex items-center gap-3 px-3 py-2 hover:bg-gray-50/60 ${
          isSub ? "pl-9" : ""
        }`}
      >
        {isSub && <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0 -ml-4" />}
        {/* B3: alterna entre checkbox de seleção e de status */}
        {canManage && selectionMode ? (
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={(e) => toggleSelect(item.id, e.target.checked)}
            className="accent-blue-500 w-4 h-4 shrink-0"
            title="Selecionar"
          />
        ) : (
          <input
            type="checkbox"
            checked={item.status === "DONE"}
            disabled={!canManage || isPending}
            onChange={(e) =>
              run(() =>
                updateChecklistItem(admissionId, item.id, {
                  status: e.target.checked ? "DONE" : "PENDING",
                })
              )
            }
            className="accent-wg-green shrink-0"
          />
        )}
        <span
          className={`flex-1 min-w-0 truncate ${isSub ? "text-[13px]" : "text-sm"} ${
            item.status === "DONE" ? "line-through text-gray-400" : "text-gray-800"
          }`}
        >
          {item.name}
        </span>
        <input
          type="date"
          defaultValue={item.dueDate ?? ""}
          disabled={!canManage || isPending || selectionMode}
          onBlur={(e) =>
            run(() =>
              updateChecklistItem(admissionId, item.id, {
                dueDate: e.target.value || null,
              })
            )
          }
          className={`${smallInput} w-[130px]`}
        />
        <select
          value={item.status}
          disabled={!canManage || isPending || selectionMode}
          onChange={(e) =>
            run(() =>
              updateChecklistItem(admissionId, item.id, {
                status: e.target.value as Status,
              })
            )
          }
          className={`${smallInput} w-[130px]`}
          style={{ color: STATUS_COLOR[item.status] }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} style={{ color: "#111827" }}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {canManage && !selectionMode && (
          <>
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                disabled={index === 0 || isPending}
                onClick={() => run(() => moveChecklistItem(admissionId, item.id, "up"))}
                className="p-0.5 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
                title="Mover para cima"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === siblingCount - 1 || isPending}
                onClick={() => run(() => moveChecklistItem(admissionId, item.id, "down"))}
                className="p-0.5 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
                title="Mover para baixo"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            {/* Adicionar subtarefa só em itens de topo */}
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
              className="p-1 text-gray-400 hover:text-red-600 rounded"
              title={isSub ? "Excluir subtarefa" : "Excluir item"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Subtarefas (um nível) */}
      {!isSub &&
        item.subtasks.map((sub, sIdx) => (
          <ItemRow
            key={sub.id}
            item={sub}
            index={sIdx}
            siblingCount={item.subtasks.length}
            depth={1}
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
        className={`inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-1.5 py-1 rounded ${
          compact ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""
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
      className="h-7 w-[200px] rounded-md border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-wg-green/40"
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
