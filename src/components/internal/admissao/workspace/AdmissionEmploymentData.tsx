"use client";

import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
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
                hint="Mover a etapa também atualiza o Kanban de admissões."
                view={optionName(options.stages, draft.stageId, r.stageId, s.stageName)}>
                <RegistrySelect id="adm-stage" value={draft.stageId} onChange={(v) => patch({ stageId: v })}
                  options={options.stages} savedId={r.stageId} savedName={s.stageName} placeholder="Sem etapa" />
              </DataField>
              <DataField label="Responsável pela admissão" htmlFor="adm-responsible" editing={editing} changed={changed("responsibleId")}
                view={optionName(options.users, draft.responsibleId, r.responsibleId, s.responsibleName)}>
                <RegistrySelect id="adm-responsible" value={draft.responsibleId} onChange={(v) => patch({ responsibleId: v })}
                  options={options.users} savedId={r.responsibleId} savedName={s.responsibleName} placeholder="Sem responsável" />
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

/** De onde a admissão veio (informativo). A origem é gravada na criação e não é editável. */
function AdmissionOrigin() {
  const { data } = useAdmissionWorkspace();
  const { job, candidateHref } = data.origin;
  return (
    <Panel title="Origem" description="De onde esta admissão veio. Informativo — definido na criação.">
      {job || candidateHref ? (
        <dl className="grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
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
          {candidateHref && (
            <div className="min-w-0">
              <dt className="text-label text-wg-ink-muted">Candidatura</dt>
              <dd className="mt-0.5 text-body">
                <Link href={candidateHref} className="inline-flex items-center gap-1 font-semibold text-wg-green-dark hover:underline">
                  Ver candidato no pipeline
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Link>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-body text-wg-ink-muted">Admissão cadastrada diretamente no módulo de Admissões, sem vaga vinculada.</p>
      )}
    </Panel>
  );
}
