// Formatação usada no cabeçalho das Configurações ("Última alteração").
// Puro: roda no servidor e no cliente, sempre no fuso de São Paulo.

const TZ = "America/Sao_Paulo";

function dayKey(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

/** "hoje às 08:14", "ontem às 17:02" ou "12/09/2026 às 08:14". */
export function formatChangeDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (dayKey(d) === dayKey(now)) return `hoje às ${time}`;
  if (dayKey(d) === dayKey(yesterday)) return `ontem às ${time}`;
  return `${dayKey(d)} às ${time}`;
}
