"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, CornerDownRight, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  addTemplateGroup,
  deleteTemplateGroup,
  duplicateTemplateGroup,
  addTemplateItem,
  addTemplateSubtask,
  deleteTemplateItem,
  renameTemplateItem,
  moveTemplateItem,
  type ActionResult,
} from "@/lib/admissao/template-actions";
import { TEMPLATE_GROUP_MIME } from "@/lib/admissao/template-dnd";
import { PositionMultiSelect } from "./PositionMultiSelect";

export interface TemplateItemView {
  id: string;
  name: string;
  subtasks: { id: string; name: string }[];
}
export interface TemplateDetail {
  id: string;
  name: string;
  positionIds: string[];
  groups: { id: string; name: string; items: TemplateItemView[] }[];
}

interface Props {
  template: TemplateDetail;
  positions: { id: string; name: string }[];
}

const input =
  "h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

export function TemplateEditor({ template, positions }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newGroup, setNewGroup] = useState("");
  const [positionIds, setPositionIds] = useState<string[]>(template.positionIds);

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-200">
        <input
          defaultValue={template.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== template.name) run(() => updateTemplate(template.id, { name: v }));
          }}
          className={`${input} font-medium flex-1 min-w-[180px]`}
        />
        <PositionMultiSelect
          positions={positions}
          value={positionIds}
          onChange={(ids) => {
            setPositionIds(ids);
            run(() => updateTemplate(template.id, { positionIds: ids }));
          }}
          className="w-[200px]"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await duplicateTemplate(template.id);
              if (!res.ok) notify("error", res.error);
              else {
                notify("success", "Modelo duplicado.");
                router.push(`/admissoes/configuracoes/modelos?t=${res.id}`);
              }
            })
          }
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <Copy className="w-4 h-4" /> Duplicar
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Excluir este modelo?"))
              startTransition(async () => {
                const res = await deleteTemplate(template.id);
                if (!res.ok) notify("error", res.error);
                else router.push("/admissoes/configuracoes/modelos");
              });
          }}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" /> Excluir
        </button>
      </div>

      <div className="p-5 space-y-3">
        {template.groups.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            Nenhum grupo. Adicione o primeiro abaixo.
          </p>
        )}

        {template.groups.map((g) => (
          <div key={g.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <span
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TEMPLATE_GROUP_MIME, g.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                title="Arraste para mover esta seção para outro modelo"
              >
                <GripVertical className="w-4 h-4" />
              </span>
              <span className="font-medium text-sm text-gray-800">{g.name}</span>
              <span className="text-[11px] text-gray-500 bg-gray-200 rounded-full px-1.5">{g.items.length}</span>
              <div className="ml-auto flex items-center gap-1">
                <AddInline
                  label="Item"
                  placeholder="Novo item…"
                  onAdd={(name) => run(() => addTemplateItem(g.id, name))}
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => duplicateTemplateGroup(g.id))}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded disabled:opacity-40"
                  title="Duplicar seção"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Excluir grupo "${g.name}" e seus itens?`))
                      run(() => deleteTemplateGroup(g.id));
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Excluir grupo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {g.items.length === 0 && <p className="text-xs text-gray-400 px-3 py-2.5">Sem itens.</p>}
              {g.items.map((it, itemIdx) => (
                <TemplateItemRow
                  key={it.id}
                  item={it}
                  index={itemIdx}
                  siblingCount={g.items.length}
                  depth={0}
                  isPending={isPending}
                  run={run}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroup.trim()) {
                run(() => addTemplateGroup(template.id, newGroup));
                setNewGroup("");
              }
            }}
            placeholder="Novo grupo (ex.: Documentos)"
            className={`${input} flex-1`}
          />
          <button
            type="button"
            disabled={!newGroup.trim() || isPending}
            onClick={() => {
              run(() => addTemplateGroup(template.id, newGroup));
              setNewGroup("");
            }}
            className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Grupo
          </button>
        </div>
      </div>
    </div>
  );
}

function AddInline({
  label,
  placeholder,
  onAdd,
  compact = false,
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => void;
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
          compact ? "opacity-0 group-hover/item:opacity-100 transition-opacity" : ""
        }`}
        title={compact ? `Adicionar ${label.toLowerCase()}` : undefined}
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
      placeholder={placeholder}
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

/** Linha de item de modelo. Em depth 0, renderiza também suas subtarefas. */
function TemplateItemRow({
  item,
  index,
  siblingCount,
  depth,
  isPending,
  run,
}: {
  item: TemplateItemView;
  index: number;
  siblingCount: number;
  depth: 0 | 1;
  isPending: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
}) {
  const isSub = depth === 1;
  return (
    <>
      <div
        className={`group/item flex items-center gap-2 px-3 py-1.5 text-sm ${isSub ? "pl-9" : ""}`}
      >
        {isSub ? (
          <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0 -ml-4" />
        ) : (
          <span className="text-gray-300 shrink-0">·</span>
        )}
        <input
          defaultValue={item.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) {
              e.target.value = item.name;
              return;
            }
            if (v !== item.name) run(() => renameTemplateItem(item.id, v));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = item.name;
              e.currentTarget.blur();
            }
          }}
          className={`flex-1 min-w-0 rounded border border-transparent px-1.5 py-0.5 hover:border-gray-200 focus:border-wg-green focus:outline-none focus:ring-1 focus:ring-wg-green/30 ${
            isSub ? "text-[13px] text-gray-700" : "text-gray-800"
          }`}
        />
        <div className="flex flex-col opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            disabled={index === 0 || isPending}
            onClick={() => run(() => moveTemplateItem(item.id, "up"))}
            className="p-0.5 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
            title="Mover para cima"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={index === siblingCount - 1 || isPending}
            onClick={() => run(() => moveTemplateItem(item.id, "down"))}
            className="p-0.5 text-gray-400 hover:text-gray-700 rounded disabled:opacity-30 disabled:cursor-default"
            title="Mover para baixo"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        {/* Adicionar subtarefa só em itens de topo (um nível, como nas admissões) */}
        {!isSub && (
          <AddInline
            label="Subtarefa"
            placeholder="Nova subtarefa…"
            compact
            onAdd={(name) => run(() => addTemplateSubtask(item.id, name))}
          />
        )}
        <button
          type="button"
          onClick={() => run(() => deleteTemplateItem(item.id))}
          className="p-1 text-gray-400 hover:text-red-600 rounded shrink-0"
          title={isSub ? "Excluir subtarefa" : "Excluir item"}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Subtarefas (um nível) */}
      {!isSub &&
        item.subtasks.map((sub, sIdx) => (
          <TemplateItemRow
            key={sub.id}
            item={{ id: sub.id, name: sub.name, subtasks: [] }}
            index={sIdx}
            siblingCount={item.subtasks.length}
            depth={1}
            isPending={isPending}
            run={run}
          />
        ))}
    </>
  );
}
