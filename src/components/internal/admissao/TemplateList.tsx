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

export function TemplateList({ templates, selectedId }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(templates);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [groupOverId, setGroupOverId] = useState<string | null>(null);

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
        setItems(templates);
      } else {
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#8A9480] text-center py-8 px-4">Nenhum modelo criado.</p>
    );
  }

  return (
    <div
      className="divide-y divide-[#EEF2E9]"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setGroupOverId(null);
      }}
    >
      {items.map((tpl) => {
        const selected = selectedId === tpl.id;
        const isOver = dragId !== null && overId === tpl.id && dragId !== tpl.id;
        const isGroupOver = groupOverId === tpl.id && !selected;
        return (
          <div
            key={tpl.id}
            draggable
            onDragStart={() => setDragId(tpl.id)}
            onDragEnd={reset}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(TEMPLATE_GROUP_MIME)) {
                if (selected) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (groupOverId !== tpl.id) setGroupOverId(tpl.id);
                return;
              }
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
              selected ? "bg-[#EAF4DC]" : "hover:bg-[#FAFBF7]"
            } ${dragId === tpl.id ? "opacity-50" : ""} ${
              isOver ? "border-t-2 border-[#90CB46]" : ""
            } ${isGroupOver ? "ring-2 ring-inset ring-[#90CB46] bg-[#90CB46]/5" : ""}`}
          >
            <GripVertical
              className="w-4 h-4 text-[#C9D6BA] group-hover:text-[#8A9480] shrink-0 cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="min-w-0">
              <div className={`font-bold text-sm truncate ${selected ? "text-[#1A2213]" : "text-[#3E4A34]"}`}>
                {tpl.name}
              </div>
              <div className="text-xs text-[#55614A] mt-0.5 truncate">{tpl.positionLabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
