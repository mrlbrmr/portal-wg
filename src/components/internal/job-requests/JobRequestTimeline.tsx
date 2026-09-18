import { historyEventLabel } from "@/lib/job-requests/constants";
import { formatDateTimeBR } from "@/lib/job-requests/mapping";
import type { JobRequestHistoryRow } from "@/types/job-requests";

const EVENT_DOT: Record<string, string> = {
  CREATED: "#9AA694",
  UPDATED: "#9AA694",
  SUBMITTED: "#3C56A8",
  HR_VALIDATED: "#3C56A8",
  HR_RETURN: "#B4791C",
  HR_RETURNED: "#B4791C",
  APPROVER_RETURN: "#B4791C",
  APPROVER_RETURNED: "#B4791C",
  REAPPROVAL_REQUIRED: "#B4791C",
  APPROVE: "#4F6930",
  APPROVED: "#4F6930",
  REJECT: "#9A3B3B",
  REJECTED: "#9A3B3B",
  CANCEL: "#9A3B3B",
  CANCELLED: "#9A3B3B",
  REOPEN: "#55614A",
  REOPENED: "#55614A",
  RECRUITMENT_STARTED: "#2F6B4F",
};

/** Timeline vertical dos eventos da solicitação (quem fez o quê, quando e por quê). */
export function JobRequestTimeline({ events }: { events: JobRequestHistoryRow[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-[#55614A]">Nenhum evento registrado para esta solicitação.</p>
    );
  }

  return (
    <ol className="relative space-y-5 pl-5">
      {/* Linha vertical da timeline */}
      <span
        aria-hidden
        className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-[#E7EEDD]"
      />
      {events.map((e) => {
        const color = EVENT_DOT[e.event] ?? "#9AA694";
        return (
          <li key={e.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-5 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white"
              style={{ background: color }}
            />
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#8A9480]">
              {formatDateTimeBR(e.createdAt)}
            </p>
            <p className="text-sm text-[#1A2213]">
              <strong className="font-semibold">{e.actorName ?? "Sistema"}</strong>
              {" — "}
              {historyEventLabel(e.event)}
            </p>
            {e.comment && (
              <p className="mt-1 rounded-lg border border-[#E7EEDD] bg-white px-3 py-2 text-sm text-[#55614A] whitespace-pre-wrap">
                {e.comment}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
