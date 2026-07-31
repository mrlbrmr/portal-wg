"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Copy,
  GripVertical,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
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
import { SubtaskProgress } from "./SubtaskProgress";

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
  "h-9 rounded-lg border border-[#DCE8CC] px-3 text-sm text-[#1A2213] focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30 focus:border-[#90CB46]";
const smallInput =
  "h-8 rounded-md border border-[#DCE8CC] px-2 text-xs text-[#1A2213] focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30 focus:border-[#90CB46] bg-white";

export function TemplateEditor({ template, positions }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newGroup, setNewGroup] = useState("");
  const [positionIds, setPositionIds] = useState<string[]>(template.positionIds);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  function expandAll() {
    setCollapsedGroups(new Set());
  }

  const totalItems = template.groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="bg-white border border-[#E7EEDD] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.05)]">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-[#EEF2E9]">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#1A2213] flex items-center gap-2 font-sora">
              <ListChecks className="w-4 h-4" /> Editar modelo
            </h2>
            <p className="text-[12.5px] text-[#55614A] mt-0.5">
              {template.groups.length}{" "}
              {template.groups.length === 1 ? "grupo" : "grupos"} · {totalItems}{" "}
              {totalItems === 1 ? "item" : "itens"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {template.groups.length > 0 && (
              <button
                type="button"
                onClick={expandAll}
                className="bg-[#F6F8F3] text-[#3E4A34] border border-[#E7EEDD] px-3.5 py-2 rounded-lg text-[12.5px] font-semibold whitespace-nowrap hover:bg-[#EEF2E9] transition-colors"
              >
                Expandir tudo
              </button>
            )}
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
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#3E4A34] bg-[#F6F8F3] border border-[#E7EEDD] px-3 py-2 rounded-lg hover:bg-[#EEF2E9] transition-colors disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicar
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
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-red-600 bg-[#FFF0EE] border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </div>

        {/* Nome + cargos */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            defaultValue={template.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== template.name) run(() => updateTemplate(template.id, { name: v }));
            }}
            className={`${input} font-semibold flex-1 min-w-[180px]`}
            placeholder="Nome do modelo…"
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
        </div>
      </div>

      <div className="p-5 space-y-3">
        {template.groups.length === 0 && (
          <p className="text-sm text-[#8A9480] text-center py-6">
            Nenhum grupo. Adicione o primeiro abaixo.
          </p>
        )}

        {template.groups.map((g) => {
          const isCollapsed = collapsedGroups.has(g.id);
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

                {/* Drag handle — move seção para outro modelo */}
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TEMPLATE_GROUP_MIME, g.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#C9D6BA] hover:text-[#8A9480] cursor-grab active:cursor-grabbing shrink-0"
                  title="Arraste para mover esta seção para outro modelo"
                >
                  <GripVertical className="w-4 h-4" />
                </span>

                <span className="font-bold text-[14.5px] text-[#1A2213] truncate flex-1">
                  {g.name}
                </span>

                <span className="bg-[#E4EED6] text-[#2E4319] text-[11.5px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  [{g.items.length}]
                </span>

                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AddInline
                    label="Item"
                    placeholder="Novo item…"
                    onAdd={(name) => run(() => addTemplateItem(g.id, name))}
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => duplicateTemplateGroup(g.id))}
                    className="p-1 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-40"
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
                    className="p-1 text-[#8A9480] hover:text-red-600 rounded"
                    title="Excluir grupo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Itens */}
              {!isCollapsed && (
                <div className="divide-y divide-[#F2F5EE]">
                  {g.items.length === 0 && (
                    <p className="text-[13px] text-[#8A9480] px-4 py-3.5">Sem itens.</p>
                  )}
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
              )}
            </div>
          );
        })}

        {/* Adicionar grupo */}
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
            className={`${smallInput} flex-1 h-9`}
          />
          <button
            type="button"
            disabled={!newGroup.trim() || isPending}
            onClick={() => {
              run(() => addTemplateGroup(template.id, newGroup));
              setNewGroup("");
            }}
            className="inline-flex items-center gap-1.5 bg-[#F0F5E8] hover:bg-[#E4EED6] text-[#3E5A2A] text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
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
        className={`inline-flex items-center gap-1 text-xs text-[#8A9480] hover:text-[#3E4A34] px-1.5 py-1 rounded transition-colors ${
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
      className="h-7 w-[200px] rounded-md border border-[#DCE8CC] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#90CB46]/30 bg-white"
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

function ItemNameTextarea({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={value}
      onInput={resize}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (!v) {
          e.target.value = value;
          resize();
          return;
        }
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          resize();
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}

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
  const hasSubtasks = !isSub && item.subtasks.length > 0;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div
        className={`group/item flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#FAFBF7] transition-colors ${
          isSub ? "pl-10" : ""
        }`}
      >
        {isSub && (
          <CornerDownRight className="w-3.5 h-3.5 text-[#C9D6BA] shrink-0 -ml-5" />
        )}

        {/* Toggle subtarefas (só em itens-pai) */}
        {!isSub &&
          (hasSubtasks ? (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
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

        {/* Nome do item */}
        <ItemNameTextarea
          value={item.name}
          onCommit={(v) => run(() => renameTemplateItem(item.id, v))}
          className={`flex-1 min-w-0 resize-none overflow-hidden rounded border border-transparent px-1.5 py-0.5 leading-snug hover:border-[#DCE8CC] focus:border-[#90CB46] focus:outline-none focus:ring-1 focus:ring-[#90CB46]/30 ${
            isSub ? "text-[13px] text-[#3E4A34]" : "text-sm text-[#1A2213]"
          }`}
        />

        {/* Badge de subtarefas */}
        {hasSubtasks && <SubtaskProgress done={0} total={item.subtasks.length} />}

        {/* Ações (hover) */}
        <div className="flex flex-col opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            disabled={index === 0 || isPending}
            onClick={() => run(() => moveTemplateItem(item.id, "up"))}
            className="p-0.5 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-30 disabled:cursor-default"
            title="Mover para cima"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={index === siblingCount - 1 || isPending}
            onClick={() => run(() => moveTemplateItem(item.id, "down"))}
            className="p-0.5 text-[#8A9480] hover:text-[#3E4A34] rounded disabled:opacity-30 disabled:cursor-default"
            title="Mover para baixo"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

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
          className="p-1 text-[#8A9480] hover:text-red-600 rounded shrink-0"
          title={isSub ? "Excluir subtarefa" : "Excluir item"}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Subtarefas */}
      {!isSub &&
        !collapsed &&
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
