// Formatação compartilhada entre a solicitação e a vaga. Client-safe (sem banco).
//
// A cópia de campos solicitação → vaga NÃO mora mais aqui: ela acontece dentro da função
// transacional `create_job_from_request` no banco (supabase/migrations/20260918120001…),
// para que criar a vaga, fechar o vínculo e mover o status sejam uma coisa só.
// Este módulo guarda apenas o que a UI precisa exibir de forma consistente.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return BRL.format(value);
}

/** Mesma regra usada na migration ao gerar `jobs.salaryRange`. */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min != null && max != null && max > min) return `${BRL.format(min)} – ${BRL.format(max)}`;
  if (min != null && max != null) return BRL.format(min);
  if (min != null) return `A partir de ${BRL.format(min)}`;
  if (max != null) return `Até ${BRL.format(max)}`;
  return null;
}

/** Converte "3", "3 posições" → 3. Retorna null quando não houver número. */
export function parseOpenings(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = String(raw).match(/\d+/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normaliza data vinda de <input type="date"> (YYYY-MM-DD). Inválida → null. */
export function parseIsoDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
