import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AdmissionAttachments,
  type AttachmentView,
} from "@/components/internal/admissao/AdmissionAttachments";
import { DigitalAdmissionCard } from "@/components/internal/admissao/DigitalAdmissionCard";
import { AdmissionDetailTabs } from "@/components/internal/admissao/AdmissionDetailTabs";
import { DigitalFormViewer } from "@/components/internal/admissao/DigitalFormViewer";
import { loadFormConfig } from "@/lib/admissao/form-config-loader";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("admissions").select("fullName").eq("id", id).single();
  return { title: data?.fullName ? `${data.fullName} — Admissão — RH` : "Ficha da admissão — RH" };
}

function fmtDate(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null;
}
function dateInput(d: string | null): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}
function fmtCpf(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length !== 11) return v;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtPhone(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

interface AdmissionDetail {
  fullName: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  responsibleId: string | null;
  managerName: string | null;
  startDate: string | null;
  medicalExamDate: string | null;
  salary: number | string | null;
  shift: string | null;
  uniformShirt: string | null;
  uniformPants: string | null;
  uniformShoe: string | null;
  notes: string | null;
  // digital form fields
  gender: string | null;
  maritalStatus: string | null;
  hasChildren: boolean | null;
  needsTransportVoucher: boolean | null;
  transportVoucherDetails: string | null;
  hasItauAccount: boolean | null;
  bankAgency: string | null;
  bankAccount: string | null;
  colorDeclaration: string | null;
  isDriverOperator: boolean | null;
  noOperationalUniform: boolean | null;
  position: { name: string } | null;
  company: { name: string } | null;
  branch: { name: string } | null;
  stage: { name: string; color: string } | null;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | string | null;
    createdAt: string;
    documentTypeId: string | null;
  }>;
}

export default async function AdmissaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [session, admissionRes, documentTypesRes, usersRes, formConfig] =
    await Promise.all([
      auth(),
      supabase
        .from("admissions")
        .select(
          `*,
           position:admission_positions(name),
           company:admission_companies(name),
           branch:admission_branches(name),
           stage:admission_stages(name, color),
           attachments:admission_attachments(id, fileName, mimeType, sizeBytes, createdAt, documentTypeId)`
        )
        .eq("id", id)
        .is("deletedAt", null)
        .maybeSingle(),
      supabase
        .from("admission_document_types")
        .select("id, name, required")
        .order("sortOrder", { ascending: true }),
      supabase.from("users").select("id, name").eq("active", true),
      loadFormConfig(),
    ]);

  const admission = admissionRes.data as unknown as AdmissionDetail | null;
  if (!admission) notFound();

  const documentTypes = (documentTypesRes.data ?? []) as Array<{
    id: string;
    name: string;
    required: boolean;
  }>;
  const users = (usersRes.data ?? []) as Array<{ id: string; name: string }>;

  const canManage = session?.user.role === "ADMIN_RH";
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const admissionRaw = admission as unknown as Record<string, unknown>;

  const formExtras = (admissionRaw.formExtras as Record<string, string> | null) ?? null;
  const extraFieldDefs = formConfig.documents.flatMap((d) => d.extraFields ?? []);
  const extraRows = formExtras
    ? Object.entries(formExtras)
        .map(([k, v]) => ({ label: extraFieldDefs.find((f) => f.key === k)?.label ?? k, value: v }))
        .filter((r) => r.value)
    : [];

  const attachments: AttachmentView[] = [...(admission.attachments ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType ?? null,
      sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
      createdAt: new Date(a.createdAt).toISOString(),
      documentTypeId: a.documentTypeId,
    }));

  const salaryFmt =
    admission.salary != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          Number(admission.salary)
        )
      : null;

  const initials = admission.fullName.slice(0, 2).toUpperCase();

  const pendingDocsCount = documentTypes.filter(
    (dt) => dt.required && !attachments.some((a) => a.documentTypeId === dt.id)
  ).length;

  const hasUniform = !!(admission.uniformShirt || admission.uniformPants || admission.uniformShoe);
  const hasOperationalData = hasUniform || extraRows.length > 0;

  const responsibleName = admission.responsibleId ? (userMap.get(admission.responsibleId) ?? null) : null;

  const secondaryFields: { label: string; value: string }[] = [
    { label: "Responsável", value: responsibleName ?? "" },
    { label: "Gestor", value: admission.managerName ?? "" },
    { label: "Turno", value: admission.shift ?? "" },
    { label: "Salário", value: salaryFmt ?? "" },
    { label: "Nascimento", value: fmtDate(admission.birthDate) ?? "" },
    { label: "CPF", value: fmtCpf(admission.cpf) ?? "" },
    { label: "E-mail", value: admission.email ?? "" },
    { label: "Telefone", value: fmtPhone(admission.phone) ?? "" },
    { label: "Exame médico", value: fmtDate(admission.medicalExamDate) ?? "" },
  ].filter((f) => f.value);

  const digitalFormSubmittedAt = (admissionRaw.digitalFormSubmittedAt as string | null) ?? null;
  const formViewerNode = digitalFormSubmittedAt ? (
    <DigitalFormViewer
      formConfig={formConfig}
      data={{
        fullName: admission.fullName,
        cpf: admission.cpf,
        birthDate: admission.birthDate,
        email: admission.email,
        phone: admission.phone,
        gender: admission.gender,
        maritalStatus: admission.maritalStatus,
        hasChildren: admission.hasChildren,
        needsTransportVoucher: admission.needsTransportVoucher,
        transportVoucherDetails: admission.transportVoucherDetails,
        hasItauAccount: admission.hasItauAccount,
        bankAgency: admission.bankAgency,
        bankAccount: admission.bankAccount,
        colorDeclaration: admission.colorDeclaration,
        isDriverOperator: admission.isDriverOperator,
        uniformShirt: admission.uniformShirt,
        noOperationalUniform: admission.noOperationalUniform,
        uniformPants: admission.uniformPants,
        uniformShoe: admission.uniformShoe,
        formExtras: (admissionRaw.formExtras as Record<string, string> | null) ?? null,
        submittedAt: digitalFormSubmittedAt,
      }}
    />
  ) : undefined;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <Link
          href="/admissoes"
          className="inline-flex items-center gap-1.5 text-[#55614A] text-[13.5px] font-semibold hover:text-[#1A2213] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Admissões
        </Link>
        <div className="flex items-center gap-2.5">
          {admission.stage && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: `${admission.stage.color}22`,
                color: admission.stage.color,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: admission.stage.color }}
              />
              {admission.stage.name}
            </span>
          )}
          {canManage && (
            <Link
              href={`/admissoes/${id}/editar`}
              className="inline-flex items-center gap-1.5 bg-[#1A2213] text-white border-2 border-[#1A2213] px-4 py-2 rounded-[10px] text-[13.5px] font-bold whitespace-nowrap hover:bg-[#2E3A26] hover:border-[#2E3A26] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar admissão
            </Link>
          )}
        </div>
      </div>

      {/* Candidate header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[#DCE8CC] text-[#2E4319] flex items-center justify-center text-[19px] font-extrabold shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-[24px] font-extrabold text-[#1A2213] tracking-tight font-sora">
            {admission.fullName}
          </h1>
          <p className="text-[#3E4A34] text-sm mt-0.5">
            {admission.position?.name ?? "Cargo não definido"} ·{" "}
            {admission.branch?.name ?? "—"}
          </p>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Left sidebar */}
        <div className="flex flex-col gap-3.5">
          {/* Block: Geral */}
          <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5 flex flex-col gap-3.5">
            <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold">
              Geral
            </div>
            {admission.position?.name && (
              <InfoRow label="Cargo" value={admission.position.name} />
            )}
            {admission.company?.name && (
              <InfoRow label="Empresa" value={admission.company.name} />
            )}
            {admission.branch?.name && (
              <InfoRow label="Filial" value={admission.branch.name} />
            )}
            {admission.startDate && (
              <div className="bg-[#EAF4DC] border-[1.5px] border-[#90CB46] rounded-xl px-3.5 py-3">
                <div className="text-[#3E5A2A] text-[11px] font-bold tracking-wide">
                  📅 DATA DE INÍCIO
                </div>
                <div className="text-[#1A2213] text-[19px] font-extrabold mt-0.5 font-sora tabular-nums">
                  {fmtDate(admission.startDate)}
                </div>
              </div>
            )}
            {secondaryFields.length > 0 && (
              <>
                <div className="border-t border-[#F2F5EE]" />
                {secondaryFields.map((f) => (
                  <InfoRow key={f.label} label={f.label} value={f.value} />
                ))}
              </>
            )}
          </div>

          {/* Block: Dados Operacionais */}
          {hasOperationalData && (
            <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5 flex flex-col gap-3.5">
              <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold">
                Dados Operacionais
              </div>
              {hasUniform && (
                <div className="grid grid-cols-3 gap-2.5">
                  <InfoRow label="Camiseta" value={admission.uniformShirt ?? "—"} />
                  <InfoRow label="Calça" value={admission.uniformPants ?? "—"} />
                  <InfoRow label="Sapato" value={admission.uniformShoe ?? "—"} />
                </div>
              )}
              {extraRows.map((r) => (
                <InfoRow key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          )}

          {/* Notes */}
          {admission.notes && (
            <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
              <div className="text-[#6B7860] text-[11px] tracking-[.07em] uppercase font-bold mb-2">
                Observações
              </div>
              <p className="text-[#1A2213] text-sm whitespace-pre-wrap">{admission.notes}</p>
            </div>
          )}

          {/* Digital form card */}
          {canManage && (
            <DigitalAdmissionCard
              admissionId={id}
              submittedAt={digitalFormSubmittedAt}
              tokenExpiresAt={(admissionRaw.digitalFormExpiresAt as string | null) ?? null}
              hasToken={!!admissionRaw.digitalFormToken}
            />
          )}
        </div>

        {/* Right: docs / form */}
        <AdmissionDetailTabs
          pendingDocsCount={pendingDocsCount}
          formViewer={formViewerNode}
          attachments={
            <AdmissionAttachments
              admissionId={id}
              canManage={canManage}
              attachments={attachments}
              documentTypes={documentTypes}
            />
          }
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#6B7860] text-[11px]">{label}</div>
      <div className="text-[#1A2213] text-sm mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
