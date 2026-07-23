"use client";

// Marcador visual de progresso das subtarefas de uma tarefa-mãe: uma "fatia de
// pizza" que vai se preenchendo conforme as subtarefas são concluídas, ao lado
// do contador concluídas/total (ex.: 1/4). Usado nos checklists de modelos e
// de admissões.

const DONE_COLOR = "#10b981"; // emerald — mesma cor de "Concluído" no status
const RING_COLOR = "#d1d5db"; // gray-300 — contorno da pizza vazia

/** Caminho SVG de uma fatia de pizza a partir das 12h, sentido horário. */
function piePath(cx: number, cy: number, r: number, fraction: number): string {
  const angle = fraction * 2 * Math.PI;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`;
}

export function SubtaskProgress({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  if (total <= 0) return null;
  const frac = Math.max(0, Math.min(1, done / total));
  const cx = 8;
  const cy = 8;
  const r = 6;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-gray-500 shrink-0 ${
        className ?? ""
      }`}
      title={`${done}/${total} subtarefa(s) concluída(s)`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={RING_COLOR} strokeWidth="1.5" />
        {frac >= 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={DONE_COLOR} />
        ) : frac > 0 ? (
          <path d={piePath(cx, cy, r, frac)} fill={DONE_COLOR} />
        ) : null}
      </svg>
      {done}/{total}
    </span>
  );
}
