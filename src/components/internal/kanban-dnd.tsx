"use client";

import { type ReactNode } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Primitivas de Kanban sobre @dnd-kit, compartilhadas pelos quadros de
 * vagas e de candidatos. As colunas são áreas droppable (id = status/etapa)
 * e os cards são draggable com handle dedicado — mantém links e botões
 * internos totalmente clicáveis e dá suporte a teclado (acessibilidade).
 */

/** Sensores padrão: ponteiro (com folga p/ não roubar cliques) + teclado. */
export function useKanbanSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
}

interface ColumnProps {
  id: string;
  children: ReactNode;
}

export function KanbanColumn({ id, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[260px] rounded-2xl transition-colors ${
        isOver ? "bg-wg-green/10 ring-2 ring-wg-green/30" : "bg-[#F4F5EF]"
      }`}
    >
      {children}
    </div>
  );
}

interface CardProps {
  id: string;
  /** Habilita o arraste (falso para papéis somente-leitura). */
  draggable: boolean;
  className?: string;
  children: ReactNode;
}

export function KanbanCard({ id, draggable, className = "", children }: CardProps) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    transform,
    isDragging,
  } = useDraggable({ id, disabled: !draggable });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,.05)] transition-shadow ${
        draggable ? "pr-7" : ""
      } ${
        isDragging
          ? "shadow-lg ring-2 ring-wg-green/30"
          : "hover:shadow-[0_8px_22px_rgba(0,0,0,.08)]"
      } ${className}`}
    >
      {draggable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          title="Arraste para mover"
          aria-label="Arraste para mover"
          className="absolute right-1 top-1.5 cursor-grab touch-none rounded p-0.5 text-gray-300 transition-colors hover:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-wg-green active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}
