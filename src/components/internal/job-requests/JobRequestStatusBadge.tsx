import { displayStatusColors, displayStatusLabel, requestDisplayStatus } from "@/lib/job-requests/outcome";
import type { JobRequestStatus } from "@/types/domain";

interface Props {
  status: JobRequestStatus;
  /** Status da vaga ligada: com ele, "Em recrutamento" vira o desfecho (Atendida/Encerrada). */
  jobStatus?: string | null;
  /** `short` cabe nas células da tabela; `full` explica o estado por extenso. */
  variant?: "short" | "full";
  className?: string;
}

/** Badge de status da solicitação — rótulos e cores vêm de constants.ts/outcome.ts. */
export function JobRequestStatusBadge({ status, jobStatus, variant = "short", className = "" }: Props) {
  const display = requestDisplayStatus(status, jobStatus);
  const c = displayStatusColors(display);

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${className}`}
      style={{ background: c.bg, color: c.color }}
    >
      {displayStatusLabel(display, variant)}
    </span>
  );
}
