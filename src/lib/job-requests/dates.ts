// Datas da solicitação de vaga. Puro e testado (dates.test.ts).

/** AAAA-MM-DD de hoje no fuso de São Paulo (o gestor e o RH estão no Brasil). */
export function todayIsoInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Envio novo: a data desejada para admissão não pode ser anterior a hoje. */
export function desiredStartDateProblem(iso: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso < todayIsoInBrazil(now) ? "A data desejada não pode ser anterior a hoje." : null;
}
