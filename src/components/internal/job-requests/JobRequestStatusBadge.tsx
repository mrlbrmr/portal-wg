import {
  JOB_REQUEST_STATUS_COLORS,
  JOB_REQUEST_STATUS_LABELS,
  JOB_REQUEST_STATUS_SHORT,
} from "@/lib/job-requests/constants";
import type { JobRequestStatus } from "@/types/domain";

interface Props {
  status: JobRequestStatus;
  /** `short` cabe nas células da tabela; `full` explica o estado por extenso. */
  variant?: "short" | "full";
  className?: string;
}

/** Badge de status da solicitação — cores e rótulos vêm do módulo de constantes. */
export function JobRequestStatusBadge({ status, variant = "short", className = "" }: Props) {
  const c = JOB_REQUEST_STATUS_COLORS[status] ?? { bg: "#EFEFEF", color: "#6B7280" };
  const label =
    variant === "full"
      ? (JOB_REQUEST_STATUS_LABELS[status] ?? status)
      : (JOB_REQUEST_STATUS_SHORT[status] ?? status);

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${className}`}
      style={{ background: c.bg, color: c.color }}
    >
      {label}
    </span>
  );
}
