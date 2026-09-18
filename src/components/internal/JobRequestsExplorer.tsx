"use client";

// Fila de Requisições de Pessoal (RP). Cada card abre o pedido completo do gestor
// e concentra as decisões do RH: assumir análise, devolver, aprovar, reprovar.
// Aprovar leva ao formulário de vaga pré-preenchido — a vaga só nasce ali.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  CornerUpLeft,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  approveRequest,
  cancelRequest,
  rejectRequest,
  reopenRequest,
  returnRequest,
  startReview,
} from "@/lib/job-requests/actions";
import {
  JOB_REQUEST_SLA_DAYS,
  JOB_REQUEST_STATUS_COLORS,
  JOB_REQUEST_STATUS_LABELS,
  jobRequestAgeInDays,
  type JobRequestRow,
} from "@/types/job-requests";
import type { JobRequestStatus } from "@/types/domain";
import { normalizeText } from "@/lib/utils";

interface Props {
  requests: JobRequestRow[];
  /** Rótulos do formulário configurável, para exibir o pedido como o gestor viu. */
  fieldLabels: Array<{ key: string; label: string }>;
  canManage: boolean;
}

type FilterValue = "OPEN" | "ALL" | JobRequestStatus;

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "OPEN", label: "Pendentes" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "REJECTED", label: "Reprovadas" },
  { value: "RETURNED", label: "Devolvidas" },
  { value: "ALL", label: "Todas" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: JobRequestStatus }) {
  const c = JOB_REQUEST_STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: c.bg, color: c.color }}
    >
      {JOB_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

export function JobRequestsExplorer({ requests, fieldLabels, canManage }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<FilterValue>("OPEN");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    const q = normalizeText(query);
    return requests.filter((r) => {
      if (filter === "OPEN" && !["SUBMITTED", "IN_REVIEW"].includes(r.status)) return false;
      if (filter !== "OPEN" && filter !== "ALL" && r.status !== filter) return false;
      if (!q) return true;
      return [r.title, r.requesterName, r.location, r.reason]
        .filter(Boolean)
        .some((v) => normalizeText(String(v)).includes(q));
    });
  }, [requests, filter, query]);

  const counts = useMemo(() => {
    const open = requests.filter((r) => ["SUBMITTED", "IN_REVIEW"].includes(r.status));
    const atrasadas = open.filter(
      (r) => jobRequestAgeInDays(r.createdAt) > JOB_REQUEST_SLA_DAYS
    ).length;
    return { open: open.length, atrasadas };
  }, [requests]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        notify("error", res.error ?? "Não foi possível concluir.");
        return;
      }
      notify("success", msg);
      router.refresh();
    });
  }

  function handleApprove(r: JobRequestRow) {
    const note = noteById[r.id] ?? "";
    startTransition(async () => {
      const res = await approveRequest(r.id, note);
      if (!res.ok) {
        notify("error", res.error ?? "Não foi possível aprovar.");
        return;
      }
      notify("success", "Requisição aprovada. Complete os dados da vaga.");
      router.push(`/vagas/nova?request=${r.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Resumo da fila */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
          <div className="text-[#1A2213] text-2xl font-extrabold">{counts.open}</div>
          <div className="text-[#55614A] text-[12.5px] mt-0.5">Aguardando você</div>
        </div>
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
          <div
            className="text-2xl font-extrabold"
            style={{ color: counts.atrasadas > 0 ? "#A24B2B" : "#1A2213" }}
          >
            {counts.atrasadas}
          </div>
          <div className="text-[#55614A] text-[12.5px] mt-0.5">
            Fora do SLA ({JOB_REQUEST_SLA_DAYS} dias)
          </div>
        </div>
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
          <div className="text-[#1A2213] text-2xl font-extrabold">
            {requests.filter((r) => r.status === "APPROVED").length}
          </div>
          <div className="text-[#55614A] text-[12.5px] mt-0.5">Aprovadas</div>
        </div>
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-4">
          <div className="text-[#1A2213] text-2xl font-extrabold">
            {requests.filter((r) => r.status === "REJECTED").length}
          </div>
          <div className="text-[#55614A] text-[12.5px] mt-0.5">Reprovadas</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                filter === f.value
                  ? "bg-[#1A2213] text-white"
                  : "bg-white border border-[#E7EEDD] text-[#55614A] hover:bg-[#F4F7EE]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por função, gestor, unidade..."
            className="w-full bg-white border border-[#E7EEDD] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
          />
        </div>
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-10 text-center">
          <p className="text-[#1A2213] font-semibold">Nenhuma requisição por aqui.</p>
          <p className="text-[#55614A] text-sm mt-1">
            As solicitações enviadas pelos gestores em <code>/solicitar-vaga</code> aparecem nesta fila.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((r) => {
            const isOpen = openId === r.id;
            const age = jobRequestAgeInDays(r.createdAt);
            const late = ["SUBMITTED", "IN_REVIEW"].includes(r.status) && age > JOB_REQUEST_SLA_DAYS;
            const note = noteById[r.id] ?? "";

            return (
              <div
                key={r.id}
                className="bg-white border border-[#E7EEDD] rounded-2xl overflow-hidden"
                style={late ? { borderLeft: "4px solid #D97757" } : undefined}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAFCF6] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1A2213] truncate">
                        {r.title ?? "Requisição sem função informada"}
                      </span>
                      <StatusBadge status={r.status} />
                      {late && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#A24B2B]">
                          <Clock className="w-3 h-3" /> {age} dias sem resposta
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-[#55614A] mt-0.5 truncate">
                      {[r.requesterName, r.location, r.reason, `${r.openings ?? 1} posição(ões)`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="text-[12px] text-[#8A9480] shrink-0 hidden md:block">
                    {formatDate(r.createdAt)}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[#E7EEDD] px-4 py-4 bg-[#FAFCF6]">
                    {/* O pedido, como o gestor preencheu */}
                    <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2.5">
                      {fieldLabels
                        .filter((f) => (r.formData[f.key] ?? "").trim())
                        .map((f) => (
                          <div key={f.key} className="min-w-0">
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">
                              {f.label}
                            </dt>
                            <dd className="text-sm text-[#1A2213] whitespace-pre-wrap break-words">
                              {r.formData[f.key]}
                            </dd>
                          </div>
                        ))}
                    </dl>

                    {r.requesterEmail && (
                      <p className="mt-3 text-[12.5px] text-[#55614A] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <a href={`mailto:${r.requesterEmail}`} className="underline">
                          {r.requesterEmail}
                        </a>
                      </p>
                    )}

                    {r.decidedAt && (
                      <div className="mt-3 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">
                          Decisão
                        </p>
                        <p className="text-sm text-[#1A2213]">
                          {JOB_REQUEST_STATUS_LABELS[r.status]} por {r.decidedBy ?? "—"} em{" "}
                          {formatDate(r.decidedAt)}
                        </p>
                        {r.decisionNote && (
                          <p className="text-sm text-[#55614A] mt-1 whitespace-pre-wrap">
                            {r.decisionNote}
                          </p>
                        )}
                      </div>
                    )}

                    {r.jobId && (
                      <a
                        href={`/vagas/${r.jobId}/candidatos`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4F6930] hover:underline"
                      >
                        Ver vaga criada {r.jobTitle ? `— ${r.jobTitle}` : ""}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {canManage && (
                      <div className="mt-4 border-t border-[#E7EEDD] pt-3.5">
                        {r.status !== "APPROVED" && (
                          <textarea
                            value={note}
                            onChange={(e) =>
                              setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            rows={2}
                            placeholder="Parecer / motivo — vai no e-mail ao gestor e fica no histórico."
                            className="w-full bg-white border border-[#E7EEDD] rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
                          />
                        )}

                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {r.status === "SUBMITTED" && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => startReview(r.id), "Requisição em análise.")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2 text-[13px] font-semibold text-[#3C56A8] hover:bg-[#F4F7EE] disabled:opacity-50"
                            >
                              {pending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Search className="w-3.5 h-3.5" />
                              )}
                              Assumir análise
                            </button>
                          )}

                          {["SUBMITTED", "IN_REVIEW", "RETURNED"].includes(r.status) && (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => handleApprove(r)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F6930] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#415726] disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Aprovar e abrir vaga
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => returnRequest(r.id, note),
                                    "Requisição devolvida ao gestor."
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2 text-[13px] font-semibold text-[#8A5B10] hover:bg-[#F4F7EE] disabled:opacity-50"
                              >
                                <CornerUpLeft className="w-3.5 h-3.5" />
                                Devolver para ajustes
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(() => rejectRequest(r.id, note), "Requisição reprovada.")
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2 text-[13px] font-semibold text-[#9A3B3B] hover:bg-[#F4F7EE] disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reprovar
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(() => cancelRequest(r.id, note), "Requisição cancelada.")
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#6B7280] hover:bg-white disabled:opacity-50"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            </>
                          )}

                          {r.status === "APPROVED" && !r.jobId && (
                            <a
                              href={`/vagas/nova?request=${r.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F6930] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#415726]"
                            >
                              Abrir vaga a partir desta requisição
                              <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {["REJECTED", "CANCELLED"].includes(r.status) && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => reopenRequest(r.id), "Requisição reaberta.")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2 text-[13px] font-semibold text-[#55614A] hover:bg-[#F4F7EE] disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reabrir
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
