"use client";

import Link from "next/link";
import { X } from "lucide-react";

type WidgetAdmission = {
  id: string;
  fullName: string;
  startDate: string | null;
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  checklistDone: number;
  checklistTotal: number;
};

type WidgetItem = {
  id: string;
  name: string;
  dueDate: string;
  admissionId: string;
  groupName: string;
};

type Props = {
  admission: WidgetAdmission | null;
  pendingItems: WidgetItem[];
  todayStr: string;
  onClose: () => void;
};

function ptBRDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function daysFromToday(dateStr: string | null, todayStr: string): number | null {
  if (!dateStr) return null;
  const a = new Date(dateStr.slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(todayStr + "T00:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

export function AdmissaoPreviewDrawer({ admission, pendingItems, todayStr, onClose }: Props) {
  const isOpen = admission !== null;

  const pct =
    admission && admission.checklistTotal > 0
      ? Math.round((admission.checklistDone / admission.checklistTotal) * 100)
      : 0;

  const startDays = admission ? daysFromToday(admission.startDate, todayStr) : null;
  const companyInfo = admission
    ? [admission.companyName, admission.branchName].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={admission ? `Prévia de ${admission.fullName}` : "Prévia de admissão"}
        className={`fixed top-0 right-0 h-full w-[400px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#E8EDE2] shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-wg-ink truncate">
              {admission?.fullName ?? "—"}
            </div>
            {admission?.positionName && (
              <div className="text-[13px] text-wg-ink-muted mt-0.5">{admission.positionName}</div>
            )}
            {companyInfo && (
              <div className="text-[12px] text-wg-ink-muted mt-0.5">{companyInfo}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar painel"
            className="shrink-0 p-1.5 rounded-lg text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Start date */}
        {admission && startDays !== null && (
          <div className="px-5 py-3 bg-[#FAFBF8] border-b border-[#E8EDE2] shrink-0">
            {startDays > 0 && (
              <span className="text-[13px] text-[#4F6930] font-semibold">
                Inicia em {startDays} dia{startDays !== 1 ? "s" : ""} (
                {ptBRDate(admission.startDate!.slice(0, 10))})
              </span>
            )}
            {startDays === 0 && (
              <span className="text-[13px] text-[#A0721E] font-semibold">Inicia hoje</span>
            )}
            {startDays < 0 && (
              <span className="text-[13px] text-wg-ink-muted">
                Iniciou há {Math.abs(startDays)} dia{Math.abs(startDays) !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Progress */}
        {admission && admission.checklistTotal > 0 && (
          <div className="px-5 py-4 border-b border-[#E8EDE2] shrink-0">
            <div className="text-[11px] font-semibold text-wg-ink-muted uppercase tracking-wide mb-2">
              📋 Progresso do Checklist
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-[#E8EDE2] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#90CB46] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[13px] font-bold text-wg-ink tabular-nums shrink-0">{pct}%</span>
            </div>
            <div className="text-[12px] text-wg-ink-muted mt-1.5">
              {admission.checklistDone} de {admission.checklistTotal} tarefas concluídas
            </div>
          </div>
        )}

        {/* Pending items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[11px] font-semibold text-wg-ink-muted uppercase tracking-wide mb-3">
            Pendentes ({pendingItems.length})
          </div>
          {pendingItems.length === 0 ? (
            <p className="text-[13px] text-wg-ink-muted text-center py-8">
              Nenhum item pendente nos próximos dias. 🎉
            </p>
          ) : (
            <div className="flex flex-col">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 py-2 border-b border-[#F0F3EC] last:border-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0 mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-wg-ink font-medium leading-snug">{item.name}</div>
                    <div className="text-[11px] text-wg-ink-muted mt-0.5">{ptBRDate(item.dueDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {admission && (
          <div className="p-5 border-t border-[#E8EDE2] flex gap-2 shrink-0">
            <Link
              href={`/admissoes/${admission.id}?tab=checklist`}
              className="flex-1 text-center py-2.5 rounded-xl border border-[#E5EAE0] text-[13px] font-semibold text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
              onClick={onClose}
            >
              Ver Checklist
            </Link>
            <Link
              href={`/admissoes/${admission.id}`}
              className="flex-1 text-center py-2.5 rounded-xl bg-[#EAF4DC] text-[#3E5A2A] text-[13px] font-semibold hover:bg-[#D7ECC4] transition-colors"
              onClick={onClose}
            >
              Abrir ficha completa →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
