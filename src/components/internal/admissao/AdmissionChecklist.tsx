"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Wand2, ListChecks } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import type { ActionResult } from "@/lib/admissao/actions";
import {
  applyChecklistTemplate,
  addChecklistGroup,
  deleteChecklistGroup,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
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

export function AdmissionChecklist({ admissionId, canManage, groups, templates }: Props) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tplId, setTplId] = useState("");
  const [newGroup, setNewGroup] = useState("");

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
    });
  }

  const allItems = groups.flatMap((g) => g.items);
  const total = allItems.length;
  const done = allItems.filter((i) => i.status === "DONE").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Checklist
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {done} de {total} concluídos · {pct}%
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={tplId} onChange={(e) => setTplId(e.target.value)} className={smallInput}>
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
              onClick={() => run(async () => {
                const r = await applyChecklistTemplate(admissionId, tplId);
                if (r.ok) {
                  notify("success", "Modelo aplicado.");
                  setTplId("");
                }
                return r;
              })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-wg-green-dark hover:opacity-80 disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" /> Aplicar
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {total > 0 && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-wg-green transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        {groups.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum grupo ainda. {canManage ? "Aplique um modelo ou crie um grupo abaixo." : ""}
          </p>
        )}

        {groups.map((g) => (
          <div key={g.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <span className="font-medium text-sm text-gray-800">{g.name}</span>
              <span className="text-[11px] text-gray-500 bg-gray-200 rounded-full px-1.5">{g.items.length}</span>
              {canManage && (
                <div className="ml-auto flex items-center gap-1">
                  <AddItemInline
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
            <div className="divide-y divide-gray-100">
              {g.items.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-3">Sem itens.</p>
              )}
              {g.items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50/60">
                  <input
                    type="checkbox"
                    checked={it.status === "DONE"}
                    disabled={!canManage || isPending}
                    onChange={(e) =>
                      run(() =>
                        updateChecklistItem(admissionId, it.id, {
                          status: e.target.checked ? "DONE" : "PENDING",
                        })
                      )
                    }
                    className="accent-wg-green"
                  />
                  <span
                    className={`flex-1 min-w-0 truncate text-sm ${
                      it.status === "DONE" ? "line-through text-gray-400" : "text-gray-800"
                    }`}
                  >
                    {it.name}
                  </span>
                  <input
                    type="date"
                    defaultValue={it.dueDate ?? ""}
                    disabled={!canManage || isPending}
                    onChange={(e) =>
                      run(() =>
                        updateChecklistItem(admissionId, it.id, {
                          dueDate: e.target.value || null,
                        })
                      )
                    }
                    className={`${smallInput} w-[130px]`}
                  />
                  <select
                    value={it.status}
                    disabled={!canManage || isPending}
                    onChange={(e) =>
                      run(() =>
                        updateChecklistItem(admissionId, it.id, { status: e.target.value as Status })
                      )
                    }
                    className={`${smallInput} w-[130px]`}
                    style={{ color: STATUS_COLOR[it.status] }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} style={{ color: "#111827" }}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => run(() => deleteChecklistItem(admissionId, it.id))}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Excluir item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {canManage && (
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
    </div>
  );
}

function AddItemInline({ onAdd }: { onAdd: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-1.5 py-1 rounded"
      >
        <Plus className="w-3.5 h-3.5" /> Item
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Novo item…"
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
