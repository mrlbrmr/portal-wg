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
      className={`shrink-0 w-72 rounded-xl border transition-colors ${
        isOver ? "border-wg-green bg-wg-green/5" : "border-gray-200 bg-gray-100"
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
      className={`relative rounded-lg border bg-white p-3 shadow-sm ${
        draggable ? "pr-7" : ""
      } ${
        isDragging
          ? "border-wg-green/60 shadow-lg ring-2 ring-wg-green/30"
          : "border-gray-200"
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
