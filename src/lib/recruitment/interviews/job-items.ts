// Itens do painel "Entrevistas" da página da vaga. Puro: sem banco, sem React.

import { isOverdue } from "./rules";

export interface JobInterviewItem {
  id: string;
  applicationId: string;
  candidateName: string;
  round: string;
  scheduledAt: string;
  durationMin: number;
  interviewerName: string | null;
  location: string | null;
  overdue: boolean;
}

type Embed = { id?: string | null; fullName?: string | null };

export interface JobInterviewRow {
  id: string;
  applicationId: string;
  round: string;
  scheduledAt: string;
  durationMin: number;
  interviewerName: string | null;
  location: string | null;
  application?: Embed | Embed[] | null;
}

/** Monta os itens (embed objeto ou array), ignora data inválida; atrasadas primeiro, depois as próximas. */
export function buildJobInterviewItems(
  rows: JobInterviewRow[],
  now: Date,
  /** Candidaturas ativas no funil; quando informado, entrevistas de outras (reprovadas, contratadas, ocultas) ficam fora. */
  activeApplicationIds?: ReadonlySet<string>,
): JobInterviewItem[] {
  const items: JobInterviewItem[] = [];
  for (const r of rows) {
    if (activeApplicationIds && !activeApplicationIds.has(r.applicationId)) continue;
    if (Number.isNaN(new Date(r.scheduledAt).getTime())) continue;
    const a = (Array.isArray(r.application) ? r.application[0] : r.application) ?? {};
    items.push({
      id: r.id,
      applicationId: r.applicationId,
      candidateName: a.fullName ?? "Candidato",
      round: r.round,
      scheduledAt: r.scheduledAt,
      durationMin: r.durationMin,
      interviewerName: r.interviewerName,
      location: r.location,
      overdue: isOverdue({ status: "SCHEDULED", scheduledAt: r.scheduledAt, durationMin: r.durationMin }, now),
    });
  }
  return items.sort((x, y) => {
    if (x.overdue !== y.overdue) return x.overdue ? -1 : 1;
    return new Date(x.scheduledAt).getTime() - new Date(y.scheduledAt).getTime();
  });
}
