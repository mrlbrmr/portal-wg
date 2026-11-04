import Link from "next/link";
import { CalendarClock, MapPin, User } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { roundShort } from "@/lib/recruitment/interviews/catalog";
import { formatInterviewWhen } from "@/lib/recruitment/interviews/rules";
import type { JobInterviewItem } from "@/lib/recruitment/interviews/job-items";

export type { JobInterviewItem };

/** Entrevistas agendadas da vaga: atrasadas (pedem desfecho) primeiro, depois as próximas. */
export function JobInterviewsPanel({ jobId, items }: { jobId: string; items: JobInterviewItem[] }) {
  const late = items.filter((i) => i.overdue).length;
  return (
    <Panel title="Entrevistas" meta={items.length ? `${items.length} agendada${items.length > 1 ? "s" : ""}` : undefined}>
      {items.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="Nenhuma entrevista agendada." />
      ) : (
        <ul className="divide-y divide-wg-border-lighter px-5 pb-3">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                href={`/vagas/${jobId}/candidatos?candidato=${i.applicationId}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 hover:text-wg-ink"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-wg-ink">{i.candidateName}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-meta text-wg-ink-muted">
                    {i.interviewerName && (
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden />{i.interviewerName}</span>
                    )}
                    {i.location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{i.location}</span>
                    )}
                  </span>
                </span>
                <span className="text-right text-meta text-wg-ink-muted">
                  <span className="block">{roundShort(i.round)}</span>
                  <span className={i.overdue ? "block font-medium text-danger-fg" : "block"}>
                    {formatInterviewWhen(i.scheduledAt)}
                    {i.overdue && " · atrasada"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {late > 0 && (
        <p className="px-5 pb-3 text-meta text-wg-ink-muted">
          {late} {late > 1 ? "entrevistas passaram" : "entrevista passou"} do horário e aguardam desfecho.
        </p>
      )}
    </Panel>
  );
}
