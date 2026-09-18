"use client";

// Barra de ações da solicitação.
//
// Regra 15: nada de dropdown de status. Os botões saem de `availableActions()` — a MESMA
// função que o servidor usa para autorizar — então o que aparece na tela é exatamente o
// que vai ser aceito. Comentário obrigatório e confirmação também vêm da definição da ação.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CornerUpLeft,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import type { ElementType } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  approveJobRequest,
  cancelJobRequest,
  rejectJobRequest,
  reopenJobRequest,
  returnJobRequestByApprover,
  returnJobRequestByHr,
  startRecruitmentFromRequest,
  submitJobRequest,
  validateJobRequest,
} from "@/lib/job-requests/actions";
import {
  availableActions,
  type WorkflowActionId,
  type WorkflowActor,
} from "@/lib/job-requests/workflow";
import type { JobRequestRow } from "@/types/job-requests";

interface Props {
  request: JobRequestRow;
  actor: WorkflowActor;
  approvers: Array<{ id: string; name: string; email: string }>;
}

const ICONS: Record<WorkflowActionId, ElementType> = {
  SUBMIT: Send,
  HR_VALIDATE: ShieldCheck,
  HR_RETURN: CornerUpLeft,
  APPROVE: Check,
  APPROVER_RETURN: CornerUpLeft,
  REJECT: X,
  CANCEL: Undo2,
  START_RECRUITMENT: ArrowRight,
  REOPEN: RotateCcw,
};

const TONE_CLASS: Record<string, string> = {
  primary: "bg-[#4F6930] text-white hover:bg-[#415726]",
  neutral: "bg-white border border-[#E7EEDD] text-[#55614A] hover:bg-[#F4F7EE]",
  warning: "bg-white border border-[#E7EEDD] text-[#8A5B10] hover:bg-[#F4F7EE]",
  danger: "bg-white border border-[#E7EEDD] text-[#9A3B3B] hover:bg-[#F4F7EE]",
};

export function JobRequestActions({ request, actor, approvers }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [approverId, setApproverId] = useState(request.currentApproverUserId ?? "");
  const [confirming, setConfirming] = useState<WorkflowActionId | null>(null);

  const actions = useMemo(
    () =>
      availableActions(
        {
          status: request.status,
          requestedByUserId: request.requestedByUserId,
          currentApproverUserId: request.currentApproverUserId,
          jobId: request.jobId,
        },
        actor
      ),
    [request, actor]
  );

  const needsComment = actions.some((a) => a.requiresComment);
  const needsApprover = actions.some((a) => a.id === "HR_VALIDATE");

  if (actions.length === 0) {
    return (
      <p className="text-sm text-[#55614A]">
        Nenhuma ação disponível para você neste status.
      </p>
    );
  }

  /** Uma action por ação do workflow — a escolha é feita aqui, não por status. */
  async function dispatch(
    id: WorkflowActionId,
    note: string
  ): Promise<{ ok: boolean; error?: string; jobId?: string }> {
    switch (id) {
      case "SUBMIT":
        return submitJobRequest(request.id);
      case "HR_VALIDATE":
        return validateJobRequest(request.id, approverId, note);
      case "HR_RETURN":
        return returnJobRequestByHr(request.id, note);
      case "APPROVE":
        return approveJobRequest(request.id, note);
      case "APPROVER_RETURN":
        return returnJobRequestByApprover(request.id, note);
      case "REJECT":
        return rejectJobRequest(request.id, note);
      case "CANCEL":
        return cancelJobRequest(request.id, note);
      case "REOPEN":
        return reopenJobRequest(request.id);
      case "START_RECRUITMENT":
        return startRecruitmentFromRequest(request.id);
    }
  }

  function run(id: WorkflowActionId) {
    setConfirming(null);
    startTransition(async () => {
      const note = comment.trim();
      const res = await dispatch(id, note);

      if (!res.ok) {
        notify("error", res.error ?? "Não foi possível concluir a ação.");
        return;
      }

      setComment("");
      if (id === "START_RECRUITMENT" && res.jobId) {
        notify("success", "Processo seletivo criado. Complete os dados da vaga.");
        router.push(`/vagas/${res.jobId}/editar`);
        return;
      }
      notify("success", "Solicitação atualizada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {needsApprover && (
        <div>
          <label htmlFor="jr-approver" className="block text-sm font-semibold text-gray-800 mb-1.5">
            Quem aprova esta contratação? <span className="text-red-500">*</span>
          </label>
          <select
            id="jr-approver"
            value={approverId}
            onChange={(e) => setApproverId(e.target.value)}
            className="w-full bg-white border border-[#E7EEDD] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
          >
            <option value="">Selecione o aprovador…</option>
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.email}
              </option>
            ))}
          </select>
          {approvers.length === 0 && (
            <p className="text-xs text-[#A24B2B] mt-1">
              Nenhum aprovador cadastrado. Marque um usuário como aprovador em Usuários.
            </p>
          )}
        </div>
      )}

      {needsComment && (
        <div>
          <label htmlFor="jr-comment" className="block text-sm font-semibold text-gray-800 mb-1.5">
            Motivo / orientação para ajuste
          </label>
          <textarea
            id="jr-comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Obrigatório ao devolver, reprovar ou cancelar. Vai no e-mail ao gestor e fica no histórico."
            className="w-full bg-white border border-[#E7EEDD] rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = ICONS[a.id];
          const isConfirming = confirming === a.id;
          return (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              onClick={() => (a.confirm && !isConfirming ? setConfirming(a.id) : run(a.id))}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                isConfirming ? "bg-[#9A3B3B] text-white hover:bg-[#832F2F]" : TONE_CLASS[a.tone]
              }`}
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {isConfirming ? `Confirmar: ${a.label.toLowerCase()}` : a.label}
            </button>
          );
        })}

        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-semibold text-[#6B7280] hover:bg-white"
          >
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}
