"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { moveTemplateGroupToTemplate, reorderTemplates } from "@/lib/admissao/template-actions";
import { TEMPLATE_GROUP_MIME } from "@/lib/admissao/template-dnd";

export interface TemplateListItem {
  id: string;
  name: string;
  positionLabel: string;
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
  // Linha destacada quando uma seção (grupo) está sendo arrastada sobre ela.
  const [groupOverId, setGroupOverId] = useState<string | null>(null);

  // Ressincroniza quando a lista do servidor muda (criar / excluir / duplicar).
  useEffect(() => setItems(templates), [templates]);

  function reset() {
    setDragId(null);
    setOverId(null);
  }

  function handleGroupDrop(groupId: string, targetId: string, targetName: string) {
    setGroupOverId(null);
    startTransition(async () => {
      const res = await moveTemplateGroupToTemplate(groupId, targetId);
      if (!res.ok) notify("error", res.error);
      else {
        notify("success", `Seção movida para "${targetName}".`);
        router.refresh();
      }
    });
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
    <div
      className="divide-y divide-gray-100"
      onDragLeave={(e) => {
        // Limpa o destaque quando a seção sai da lista inteira.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setGroupOverId(null);
      }}
    >
      {items.map((tpl) => {
        const selected = selectedId === tpl.id;
        // Só mostra o indicador de reordenar durante um arraste de modelo.
        const isOver = dragId !== null && overId === tpl.id && dragId !== tpl.id;
        // A seção arrastada pertence ao modelo aberto (selecionado), então ele
        // não é destino válido para o drop de seção.
        const isGroupOver = groupOverId === tpl.id && !selected;
        return (
          <div
            key={tpl.id}
            draggable
            onDragStart={() => setDragId(tpl.id)}
            onDragEnd={reset}
            onDragOver={(e) => {
              // Seção (grupo) sendo arrastada → destino de drop (menos o próprio
              // modelo de origem, que é o selecionado).
              if (e.dataTransfer.types.includes(TEMPLATE_GROUP_MIME)) {
                if (selected) return; // não é destino válido
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (groupOverId !== tpl.id) setGroupOverId(tpl.id);
                return;
              }
              // Reordenar modelos.
              e.preventDefault();
              if (overId !== tpl.id) setOverId(tpl.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const groupId = e.dataTransfer.getData(TEMPLATE_GROUP_MIME);
              if (groupId) {
                if (!selected) handleGroupDrop(groupId, tpl.id, tpl.name);
                return;
              }
              handleDrop(tpl.id);
            }}
            onClick={() => router.push(`/admissoes/configuracoes/modelos?t=${tpl.id}`)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
              selected ? "bg-wg-green/10" : "hover:bg-gray-50"
            } ${dragId === tpl.id ? "opacity-50" : ""} ${
              isOver ? "border-t-2 border-wg-green" : ""
            } ${isGroupOver ? "ring-2 ring-inset ring-wg-green bg-wg-green/5" : ""}`}
          >
            <GripVertical
              className="w-4 h-4 text-gray-300 group-hover:text-gray-400 shrink-0 cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">{tpl.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {tpl.positionLabel}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
