// Formatação compartilhada entre a solicitação e a vaga. Client-safe (sem banco).
//
// A cópia de campos solicitação → vaga NÃO mora aqui: ela acontece dentro da função
// transacional `create_job_from_request` no banco (supabase/migrations/20260918120001…),
// para que criar a vaga, fechar o vínculo e mover o status sejam uma coisa só.

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
