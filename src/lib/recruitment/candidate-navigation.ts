// Navegação sequencial entre candidatos no Quick View (‹ 1 de 5 ›, atalhos J/K) — PURO.

export interface QueuePosition {
  /** Posição 1-based do candidato aberto na fila (null se ele saiu da fila). */
  index: number | null;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

/**
 * Vizinhos do candidato aberto numa fila de ids. Se ele não está mais na fila (ex.:
 * reprovado e fora do Kanban), usa a última posição conhecida: o "próximo" é quem
 * ocupou aquele lugar — a triagem segue sem pular ninguém.
 */
export function queuePosition(queue: string[], currentId: string | null, lastIndex: number | null = null): QueuePosition {
  const total = queue.length;
  const i = currentId ? queue.indexOf(currentId) : -1;
  if (i >= 0) {
    return { index: i + 1, total, prevId: queue[i - 1] ?? null, nextId: queue[i + 1] ?? null };
  }
  if (lastIndex === null || total === 0) return { index: null, total, prevId: null, nextId: null };
  const at = Math.min(Math.max(lastIndex, 0), total);
  return { index: null, total, prevId: queue[at - 1] ?? null, nextId: queue[at] ?? null };
}

/** Papéis ARIA de componentes de edição (autocomplete, busca, campos numéricos customizados). */
const EDITABLE_ROLES = "[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only'], [role='textbox'], [role='searchbox'], [role='combobox'], [role='spinbutton']";

/** Foco num campo editável: atalhos de uma letra (J/K) não podem disparar. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return el.isContentEditable === true || el.closest?.(EDITABLE_ROLES) != null;
}
