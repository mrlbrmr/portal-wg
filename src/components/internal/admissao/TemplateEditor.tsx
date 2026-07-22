"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  addTemplateGroup,
  deleteTemplateGroup,
  addTemplateItem,
  deleteTemplateItem,
  type ActionResult,
} from "@/lib/admissao/template-actions";

export interface TemplateDetail {
  id: string;
  name: string;
  positionId: string | null;
  groups: { id: string; name: string; items: { id: string; name: string }[] }[];
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
        <select
          defaultValue={template.positionId ?? ""}
          onChange={(e) => run(() => updateTemplate(template.id, { positionId: e.target.value || null }))}
          className={`${input} w-[200px]`}
        >
          <option value="">Todos os cargos</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
              {g.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="text-gray-300">·</span>
                  <span className="flex-1 truncate text-gray-800">{it.name}</span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteTemplateItem(it.id))}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    title="Excluir item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
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
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-1.5 py-1 rounded"
      >
        <Plus className="w-3.5 h-3.5" /> {label}
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
