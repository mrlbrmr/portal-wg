"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createCategory,
  renameCategory,
  recolorCategory,
  deleteCategory,
  type CatEntity,
  type ActionResult,
} from "@/lib/admissao/config-actions";

export interface CategoryItem {
  id: string;
  name: string;
  color?: string | null;
}

interface Props {
  entity: CatEntity;
  title: string;
  description?: string;
  items: CategoryItem[];
  hasColor?: boolean;
  addPlaceholder?: string;
}

const input =
  "h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

export function CategoryManager({
  entity,
  title,
  description,
  items,
  hasColor,
  addPlaceholder,
}: Props) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(entity === "stage" ? "#94a3b8" : "#64748b");

  function run(fn: () => Promise<ActionResult>, okMsg?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
      else if (okMsg) notify("success", okMsg);
    });
  }

  function handleAdd() {
    const clean = name.trim();
    if (!clean) return;
    run(async () => {
      const r = await createCategory(entity, clean, hasColor ? color : undefined);
      if (r.ok) setName("");
      return r;
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          {hasColor && (
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 shrink-0 rounded-lg border border-gray-300 cursor-pointer"
              title="Cor"
            />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={addPlaceholder ?? "Novo item"}
            className={`${input} flex-1`}
          />
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 bg-wg-green hover:bg-wg-green-bright text-black text-sm font-semibold px-3 py-2 rounded-full disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum item cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2.5 py-2">
                {hasColor && (
                  <input
                    type="color"
                    defaultValue={it.color ?? "#94a3b8"}
                    onChange={(e) =>
                      run(() => recolorCategory(entity as "tag" | "stage", it.id, e.target.value))
                    }
                    className="h-7 w-7 shrink-0 rounded border border-gray-300 cursor-pointer"
                    title="Cor"
                  />
                )}
                <input
                  defaultValue={it.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== it.name) run(() => renameCategory(entity, it.id, v));
                  }}
                  className={`${input} h-8 flex-1 max-w-md`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remover "${it.name}"?`)) run(() => deleteCategory(entity, it.id));
                  }}
                  className="ml-auto p-1.5 text-gray-400 hover:text-red-600 rounded"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
