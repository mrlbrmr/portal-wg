"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Link2, Lock, Unlink } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StageBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { unlinkAdmissionCandidate } from "@/lib/admissao/candidate-link-actions";
import { daysFromToday, formatDateBR, formatSalaryDigits, relativeDaysLabel, todayFrom } from "@/lib/admissao/workspace";
import { optionName, useAdmissionWorkspace } from "./context";
import { DataField, EditableSection, FieldGrid, RegistrySelect, fieldA11y, inputClass } from "./fields";

function dateWithRelative(value: string, today: Date | null): string | null {
  const d = formatDateBR(value);
  if (!d) return null;
  return today ? `${d} · ${relativeDaysLabel(daysFromToday(value, today)).toLowerCase()}` : d;
}

/** Contratação: informações internas do RH (nunca aparecem no formulário do candidato). */
export function AdmissionEmploymentData() {
  const { data, options, draft, saved, patch, isEditing } = useAdmissionWorkspace();
  const editing = isEditing("contratacao");
  const r = data.record;
  const s = data.saved;
  // Contagem relativa ("em 3 dias") só enquanto a admissão está em aberto.
  const today = s.stageIsFinal ? null : todayFrom(data.today);
  const changed = (k: keyof typeof draft) => draft[k] !== saved[k];

  return (
    <div className="flex flex-col gap-5">
      <EditableSection
        section="contratacao"
        title="Contratação"
        meta={
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3" aria-hidden /> Interno do RH
          </span>
        }
        description="Definidas pelo RH. Não aparecem para o candidato."
      >
        <div className="flex flex-col gap-6">
          <FieldGroup title="Cargo e lotação">
            <FieldGrid editing={editing} cols={3}>
              <DataField label="Cargo" htmlFor="adm-position" editing={editing} changed={changed("positionId")}
                view={optionName(options.positions, draft.positionId, r.positionId, s.positionName)}>
                <RegistrySelect id="adm-position" value={draft.positionId} onChange={(v) => patch({ positionId: v })}
                  options={options.positions} savedId={r.positionId} savedName={s.positionName} />
              </DataField>
              <DataField label="Empresa" htmlFor="adm-company" editing={editing} changed={changed("companyId")}
                view={optionName(options.companies, draft.companyId, r.companyId, s.companyName)}>
                <RegistrySelect id="adm-company" value={draft.companyId} onChange={(v) => patch({ companyId: v })}
                  options={options.companies} savedId={r.companyId} savedName={s.companyName} />
              </DataField>
              <DataField label="Filial" htmlFor="adm-branch" editing={editing} changed={changed("branchId")}
                view={optionName(options.branches, draft.branchId, r.branchId, s.branchName)}>
                <RegistrySelect id="adm-branch" value={draft.branchId} onChange={(v) => patch({ branchId: v })}
                  options={options.branches} savedId={r.branchId} savedName={s.branchName} />
              </DataField>
            </FieldGrid>
          </FieldGroup>

          <FieldGroup title="Processo de admissão">
            <FieldGrid editing={editing} cols={3}>
              <DataField label="Etapa" htmlFor="adm-stage" editing={editing} changed={changed("stageId")}
                hint="Mover a etapa também atualiza o progresso da admissão."
                view={optionName(options.stages, draft.stageId, r.stageId, s.stageName)}>
                <RegistrySelect id="adm-stage" value={draft.stageId} onChange={(v) => patch({ stageId: v })}
                  options={options.stages} savedId={r.stageId} savedName={s.stageName} placeholder="Sem etapa" />
              </DataField>
              <DataField label="Gestor" htmlFor="adm-manager" editing={editing} changed={changed("managerName")} view={draft.managerName || null}>
                <input {...fieldA11y("adm-manager")} value={draft.managerName} onChange={(e) => patch({ managerName: e.target.value })}
                  maxLength={120} placeholder="Nome do gestor" className={inputClass} />
              </DataField>
              <DataField label="Data de início" htmlFor="adm-start" editing={editing} changed={changed("startDate")}
                view={dateWithRelative(draft.startDate, today)}>
                <input {...fieldA11y("adm-start")} type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} className={inputClass} />
              </DataField>
              <DataField label="Exame admissional (ASO)" htmlFor="adm-exam" editing={editing} changed={changed("medicalExamDate")}
                hint="Data do exame. Deixe em branco enquanto não estiver agendado."
                view={dateWithRelative(draft.medicalExamDate, today)}>
                <input {...fieldA11y("adm-exam", undefined, "Data do exame. Deixe em branco enquanto não estiver agendado.")} type="date"
                  value={draft.medicalExamDate} onChange={(e) => patch({ medicalExamDate: e.target.value })} className={inputClass} />
              </DataField>
            </FieldGrid>
          </FieldGroup>

          <FieldGroup title="Remuneração e jornada">
            <FieldGrid editing={editing} cols={3}>
              <DataField label="Salário" htmlFor="adm-salary" editing={editing} changed={changed("salaryDigits")}
                view={formatSalaryDigits(draft.salaryDigits) || null}>
                <input {...fieldA11y("adm-salary")} value={formatSalaryDigits(draft.salaryDigits)} inputMode="numeric" placeholder="R$ 0,00"
                  onChange={(e) => patch({ salaryDigits: e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12) })}
                  className={inputClass} />
              </DataField>
              <DataField label="Turno" htmlFor="adm-shift" editing={editing} changed={changed("shift")} view={draft.shift || null}>
                <input {...fieldA11y("adm-shift")} value={draft.shift} onChange={(e) => patch({ shift: e.target.value })}
                  maxLength={60} placeholder="Ex.: Comercial" className={inputClass} />
              </DataField>
            </FieldGrid>
          </FieldGroup>
        </div>
      </EditableSection>

      <AdmissionOrigin />
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-wg-border-lighter pb-1.5 text-label uppercase tracking-wide text-wg-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Processo seletivo de onde a pessoa veio. Gravado pelo "Contratar" do pipeline ou, para
 * admissão cadastrada direto aqui, pelo vínculo manual (unifica admissão e candidato).
 */
function AdmissionOrigin() {
  const { data, canManage, openCandidateLink } = useAdmissionWorkspace();
  const router = useRouter();
  const { notify } = useToast();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const { job, candidateHref, candidate } = data.origin;

  const unlink = async () => {
    setConfirmUnlink(false);
    const r = await unlinkAdmissionCandidate(data.id).catch(() => null);
    if (!r || !r.ok) {
      notify("error", r && !r.ok ? r.error : "Não foi possível desvincular.");
      return;
    }
    notify("success", "Admissão desvinculada do processo seletivo.");
    router.refresh();
  };

  return (
    <Panel
      title="Processo seletivo"
      description="Vaga e candidatura desta pessoa. Com o vínculo, o pipeline mostra a admissão e o Banco de Talentos a conta como contratada."
      action={
        canManage && candidate ? (
          <Button variant="tertiary" size="sm" icon={Unlink} onClick={() => setConfirmUnlink(true)}>
            Desvincular
          </Button>
        ) : undefined
      }
    >
      {job || candidate ? (
        <dl className="grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
          {candidate && (
            <div className="min-w-0">
              <dt className="text-label text-wg-ink-muted">Candidato</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-body">
                {candidateHref ? (
                  <Link href={candidateHref} className="inline-flex max-w-full items-center gap-1 font-semibold text-wg-green-dark hover:underline">
                    <span className="truncate">{candidate.fullName}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <span className="font-semibold text-wg-ink">{candidate.fullName}</span>
                )}
                {candidate.stageName && (
                  <StageBadge color={candidate.stageColor ?? undefined} hint="Etapa da candidatura no funil">
                    {candidate.stageName}
                  </StageBadge>
                )}
              </dd>
            </div>
          )}
          {job && (
            <div className="min-w-0">
              <dt className="text-label text-wg-ink-muted">Vaga</dt>
              <dd className="mt-0.5 text-body">
                <Link href={`/vagas/${job.id}/editar`} className="inline-flex max-w-full items-center gap-1 font-semibold text-wg-green-dark hover:underline">
                  <span className="truncate">{[job.code, job.title].filter(Boolean).join(" · ")}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Link>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-body text-wg-ink-muted">
            Admissão cadastrada direto em Admissões, sem candidatura vinculada.
            {canManage && " Se a pessoa participou de um processo seletivo, vincule para unificar os cadastros."}
          </p>
          {canManage && (
            <Button variant="secondary" size="sm" icon={Link2} onClick={openCandidateLink}>
              Vincular ao processo seletivo
            </Button>
          )}
        </div>
      )}
      <ConfirmModal
        isOpen={confirmUnlink}
        variant="warning"
        title="Desvincular do processo seletivo?"
        message={`A admissão deixa de apontar para a candidatura de ${candidate?.fullName ?? "este candidato"}. A etapa do candidato e a posição que ele ocupa na vaga não mudam — se foi engano, libere a posição na página da vaga.`}
        confirmLabel="Desvincular"
        onConfirm={unlink}
        onCancel={() => setConfirmUnlink(false)}
      />
    </Panel>
  );
}
