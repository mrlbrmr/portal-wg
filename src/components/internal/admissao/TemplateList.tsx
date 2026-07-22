"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { reorderTemplates } from "@/lib/admissao/template-actions";

export interface TemplateListItem {
  id: string;
  name: string;
  positionName: string | null;
}

interface Props {
  templates: TemplateListItem[];
  selectedId?: string;
}

/**
 * Lista lateral de modelos de checklist. Cada linha navega para o modelo (via
 * ?t=) e pode ser arrastada para reordenar (drag-and-drop nativo — sem dep. nova).
 * A ordem é otimista no cliente e persistida por reorderTemplates.
 */
export function TemplateList({ templates, selectedId }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(templates);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Ressincroniza quando a lista do servidor muda (criar / excluir / duplicar).
  useEffect(() => setItems(templates), [templates]);

  function reset() {
    setDragId(null);
    setOverId(null);
  }

  function handleDrop(targetId: string) {
    const draggedId = dragId;
    reset();
    if (!draggedId || draggedId === targetId) return;

    const from = items.findIndex((t) => t.id === draggedId);
    const to = items.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);

    startTransition(async () => {
      const res = await reorderTemplates(next.map((t) => t.id));
      if (!res.ok) {
        notify("error", res.error);
        setItems(templates); // desfaz o otimismo
      } else {
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8 px-4">Nenhum modelo criado.</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((tpl) => {
        const selected = selectedId === tpl.id;
        const isOver = overId === tpl.id && dragId !== tpl.id;
        return (
          <div
            key={tpl.id}
            draggable
            onDragStart={() => setDragId(tpl.id)}
            onDragEnd={reset}
            onDragOver={(e) => {
              e.preventDefault();
              if (overId !== tpl.id) setOverId(tpl.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(tpl.id);
            }}
            onClick={() => router.push(`/admissoes/configuracoes/modelos?t=${tpl.id}`)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
              selected ? "bg-wg-green/10" : "hover:bg-gray-50"
            } ${dragId === tpl.id ? "opacity-50" : ""} ${
              isOver ? "border-t-2 border-wg-green" : ""
            }`}
          >
            <GripVertical
              className="w-4 h-4 text-gray-300 group-hover:text-gray-400 shrink-0 cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">{tpl.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {tpl.positionName ?? "Todos os cargos"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
