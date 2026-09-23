"use client";

// Tela da solicitação: leitura por seções, edição inline quando permitida, e o aviso de
// reaprovação da regra 9 (mexer em campo crítico depois de aprovado exige nova aprovação).
//
// As AÇÕES do workflow ficam em <JobRequestActions>; aqui cuidamos só dos dados.

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { saveJobRequest } from "@/lib/job-requests/actions";
import {
  JobRequestFormFields,
  toPayload,
  type JobRequestFormValues,
} from "@/components/job-requests/JobRequestFormFields";
import {
  CONTRACT_TYPE_LABELS,
  JOB_REQUEST_REASON_LABELS,
  MODALITY_LABELS,
} from "@/lib/job-requests/constants";
import { formatDateBR, formatDateTimeBR } from "@/lib/job-requests/mapping";
import {
  CRITICAL_FIELD_LABELS,
  evaluateEdit,
  findCriticalChanges,
  type WorkflowActor,
} from "@/lib/job-requests/workflow";
import type { FormFieldConfig } from "@/types/form-config";
import { formatExtraValue } from "@/lib/job-requests/extra-fields";
import type { JobRequestRow } from "@/types/job-requests";

interface Props {
  request: JobRequestRow;
  actor: WorkflowActor;
  extraFields: FormFieldConfig[];
  unitOptions: string[];
  departmentOptions: string[];
}

function toFormValues(r: JobRequestRow): JobRequestFormValues {
  return {
    title: r.title ?? "",
    department: r.department ?? "",
    location: r.location ?? "",
    requesterName: r.requesterName ?? "",
    requesterEmail: r.requesterEmail ?? "",
    openings: String(r.openings ?? 1),
    reasonType: r.reasonType,
    replacedEmployee: r.replacedEmployee ?? "",
    justification: r.justification ?? "",
    desiredStartDate: r.desiredStartDate ?? "",
    contractType: r.contractType ?? "CLT",
    modality: r.modality ?? "PRESENTIAL",
    workSchedule: r.workSchedule ?? "",
    extraData: r.extraData ?? {},
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#8A9480]">{label}</dt>
      <dd className="text-sm text-[#1A2213] whitespace-pre-wrap break-words mt-0.5">
        {value || "—"}
      </dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[#8A9480] font-sora mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function JobRequestDetail({
  request,
  actor,
  extraFields,
  unitOptions,
  departmentOptions,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<JobRequestFormValues>(() => toFormValues(request));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const workflowRequest = {
    status: request.status,
    requestedByUserId: request.requestedByUserId,
    currentApproverUserId: request.currentApproverUserId,
    jobId: request.jobId,
  };

  // Avaliação "a seco" (sem mudanças) para saber se a edição é possível neste status.
  const editability = evaluateEdit(workflowRequest, actor, []);
  const canEdit = editability.allowed;

  // Quais campos críticos estão diferentes AGORA — alimenta o aviso de reaprovação.
  const changedCritical = useMemo(() => {
    const before = {
      title: request.title,
      openings: request.openings,
      location: request.location,
      contractType: request.contractType,
      reasonType: request.reasonType,
    };
    return findCriticalChanges(before, toPayload(values) as Record<string, unknown>);
  }, [request, values]);

  const pendingDecision = evaluateEdit(workflowRequest, actor, changedCritical);
  const willRequireReapproval =
    pendingDecision.allowed && pendingDecision.requiresReapproval === true;

  function handleSave() {
    setErrors({});
    startTransition(async () => {
      const res = await saveJobRequest(request.id, toPayload(values), {
        // O usuário já viu o aviso em tela antes de clicar em salvar.
        confirmReapproval: willRequireReapproval,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) flat[k] = v[0];
          setErrors(flat);
        }
        notify("error", res.error);
        return;
      }
      notify(
        "success",
        res.requiresReapproval
          ? "Alterações salvas. A solicitação voltou para aprovação."
          : "Alterações salvas."
      );
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="space-y-4">
        {willRequireReapproval && (
          <div className="rounded-2xl border border-[#F0D7A6] bg-[#FCF1DD] px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-bold text-[#8A5B10]">
              <AlertTriangle className="w-4 h-4" />
              Esta alteração modifica dados que já foram aprovados e exigirá uma nova aprovação.
            </p>
            <p className="text-[12.5px] text-[#8A5B10] mt-1">
              Campos alterados:{" "}
              {changedCritical.map((f) => CRITICAL_FIELD_LABELS[f]).join(", ")}. Ao salvar, a
              solicitação volta para <strong>Aguardando aprovação</strong> e o recrutamento fica
              bloqueado até a nova decisão.
            </p>
          </div>
        )}

        <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
          <JobRequestFormFields
            values={values}
            onChange={(p) => setValues((prev) => ({ ...prev, ...p }))}
            errors={errors}
            extraFields={extraFields}
            unitOptions={unitOptions}
            departmentOptions={departmentOptions}
            criticalHighlight={
              request.status === "APPROVED" || request.status === "PENDING_APPROVAL"
            }
          />

          <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E7EEDD] pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F6930] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#415726] disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar alterações
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setValues(toFormValues(request));
                setErrors({});
                setEditing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-4 py-2 text-[13px] font-semibold text-[#55614A] hover:bg-[#F4F7EE]"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-3 py-2 text-[13px] font-semibold text-[#55614A] hover:bg-[#F4F7EE]"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar solicitação
          </button>
        </div>
      )}

      <Card title="Dados da solicitação">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Row label="Título da vaga" value={request.title} />
          <Row label="Área / Departamento" value={request.department} />
          <Row label="Empresa / Unidade" value={request.location} />
          <Row
            label="Gestor requisitante"
            value={
              <>
                {request.requesterName ?? "—"}
                {request.requesterEmail && (
                  <a
                    href={`mailto:${request.requesterEmail}`}
                    className="block text-[12.5px] text-[#4F6930] hover:underline"
                  >
                    {request.requesterEmail}
                  </a>
                )}
              </>
            }
          />
          <Row label="Número de posições" value={request.openings} />
        </dl>
      </Card>

      <Card title="Motivo da contratação">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Row label="Motivo da abertura" value={JOB_REQUEST_REASON_LABELS[request.reasonType]} />
          {request.reasonType === "REPLACEMENT" && (
            <Row label="Colaborador substituído" value={request.replacedEmployee} />
          )}
          <Row label="Data desejada para admissão" value={formatDateBR(request.desiredStartDate)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Row label="Justificativa da contratação" value={request.justification} />
          </div>
        </dl>
      </Card>

      <Card title="Condições da vaga">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Row
            label="Tipo de contratação"
            value={request.contractType ? CONTRACT_TYPE_LABELS[request.contractType] : null}
          />
          <Row
            label="Modalidade"
            value={request.modality ? MODALITY_LABELS[request.modality] : null}
          />
          <Row label="Horário / Jornada" value={request.workSchedule} />
        </dl>
      </Card>

      {extraFields.length > 0 && (
        <Card title="Informações complementares">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {extraFields.map((f) => (
              <Row key={f.id} label={f.label} value={formatExtraValue(f, request.extraData[f.key])} />
            ))}
          </dl>
        </Card>
      )}

      <Card title="Aprovação">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Row label="Data do envio ao RH" value={formatDateTimeBR(request.submittedAt)} />
          <Row
            label="Validada pelo RH"
            value={
              request.hrValidatedAt
                ? `${request.hrValidatedBy ?? "—"} · ${formatDateTimeBR(request.hrValidatedAt)}`
                : null
            }
          />
          <Row label="Aprovador atual" value={request.currentApproverName} />
          <Row label="Data da aprovação" value={formatDateTimeBR(request.approvedAt)} />
          <Row label="Aprovado por" value={request.approvedByName} />
          <Row
            label="Último parecer"
            value={
              request.decisionNote
                ? `${request.decisionNote}\n— ${request.decidedBy ?? "—"}, ${formatDateTimeBR(request.decidedAt)}`
                : null
            }
          />
        </dl>
      </Card>

      {editability.allowed === false && (
        <p className="text-[12.5px] text-[#8A9480]">{editability.message}</p>
      )}
    </div>
  );
}
