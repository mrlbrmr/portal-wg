import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadFormConfig } from "@/lib/admissao/form-config-loader";
import { DIGITAL_FORM_EXPIRY_DAYS } from "@/lib/admissao/form-config";
import { digitalFormState } from "@/lib/admissao/overview";
import { needsAttention, sectionStatus } from "@/lib/admissao/document-status";
import { canWriteAdmissions } from "@/lib/admissao/permissions";
import {
  admissionPendencies,
  parseAdmissionTab,
  todayFrom,
  todayISOInSaoPaulo,
  type AdmissionRecord,
} from "@/lib/admissao/workspace";
import { buildAdmissionHistory } from "@/lib/admissao/history";
import { getAppBaseUrl } from "@/lib/app-url";
import { AdmissionAttachments, type AttachmentView } from "@/components/internal/admissao/AdmissionAttachments";
import { DigitalFormViewer } from "@/components/internal/admissao/DigitalFormViewer";
import { AdmissionWorkspace } from "@/components/internal/admissao/workspace/AdmissionWorkspace";
import type { AdmissionWorkspaceData } from "@/components/internal/admissao/workspace/types";
import { ACTIVITY_ICONS } from "@/components/internal/activity/icons";
import { ActivityTimeline, type TimelineEvent } from "@/components/ui/ActivityTimeline";
import { EmptyState } from "@/components/ui/EmptyState";

// Central da admissão: ficha única para ver e editar (a antiga /editar redireciona para cá).

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("admissions").select("fullName").eq("id", id).single();
  return { title: data?.fullName ? `${data.fullName} — Admissão — RH` : "Ficha da admissão — RH" };
}

interface AdmissionRow extends AdmissionRecord {
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  sourceApplicationId: string | null;
  sourceJobId: string | null;
  digitalFormToken: string | null;
  digitalFormExpiresAt: string | null;
  digitalFormSubmittedAt: string | null;
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
  formExtras: Record<string, string> | null;
  position: { name: string } | null;
  company: { name: string } | null;
  branch: { name: string } | null;
  stage: { name: string; color: string; isFinal: boolean } | null;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | string | null;
    createdAt: string;
    documentTypeId: string | null;
    uploadedById: string | null;
    aiStatus: string | null;
    aiReason: string | null;
    reviewStatus: string | null;
    reviewReason: string | null;
    reviewedById: string | null;
    reviewedAt: string | null;
  }>;
}

interface LogRow {
  id: number;
  userId: string | null;
  action: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
}

export default async function AdmissaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; editar?: string }>;
}) {
  const [{ id }, { aba, editar }] = await Promise.all([params, searchParams]);

  const supabase = await createClient();
  const [session, admissionRes, documentTypesRes, config, formConfig, activityRes] = await Promise.all([
    auth(),
    supabase
      .from("admissions")
      .select(
        `*,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name),
         stage:admission_stages(name, color, isFinal),
         attachments:admission_attachments(id, fileName, mimeType, sizeBytes, createdAt, documentTypeId, uploadedById, aiStatus, aiReason, reviewStatus, reviewReason, reviewedById, reviewedAt)`
      )
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle(),
    supabase.from("admission_document_types").select("id, name, required").order("sortOrder", { ascending: true }),
    getAdmissionConfig(),
    loadFormConfig(),
    supabase
      .from("admission_activity_log")
      .select("id, userId, action, description, metadata, createdAt")
      .eq("admissionId", id)
      .order("createdAt", { ascending: false })
      .limit(100),
  ]);

  const admission = admissionRes.data as unknown as AdmissionRow | null;
  if (!admission) notFound();

  const logs = (activityRes.data ?? []) as LogRow[];

  // Nomes de usuários citados na ficha — inclui desativados (config.users só traz ativos).
  const userIds = new Set<string>();
  for (const v of [admission.responsibleId, admission.createdById]) if (v) userIds.add(v);
  for (const a of admission.attachments ?? []) {
    if (a.uploadedById) userIds.add(a.uploadedById);
    if (a.reviewedById) userIds.add(a.reviewedById);
  }
  for (const l of logs) if (l.userId) userIds.add(l.userId);

  const [usersRes, jobRes] = await Promise.all([
    userIds.size > 0 ? supabase.from("users").select("id, name").in("id", [...userIds]) : Promise.resolve({ data: [] }),
    admission.sourceJobId
      ? supabase.from("jobs").select("id, code, title").eq("id", admission.sourceJobId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const userMap = new Map(((usersRes.data ?? []) as Array<{ id: string; name: string }>).map((u) => [u.id, u.name]));
  const userName = (uid: string | null) => (uid ? (userMap.get(uid) ?? null) : null);
  const job = jobRes.data as { id: string; code: string | null; title: string } | null;

  const canManage = canWriteAdmissions(session?.user.role);
  const today = todayISOInSaoPaulo();
  const documentTypes = (documentTypesRes.data ?? []) as Array<{ id: string; name: string; required: boolean }>;

  // ── Documentos ──────────────────────────────────────────────────────────────────────
  const attachments: AttachmentView[] = [...(admission.attachments ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType ?? null,
      sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
      createdAt: new Date(a.createdAt).toISOString(),
      documentTypeId: a.documentTypeId,
      aiStatus: a.aiStatus,
      aiReason: a.aiReason,
      reviewStatus: a.reviewStatus,
      reviewReason: a.reviewReason,
      reviewedByName: userName(a.reviewedById),
      reviewedAt: a.reviewedAt ? new Date(a.reviewedAt).toISOString() : null,
      uploadedByName: userName(a.uploadedById),
    }));
  const requiredTypes = documentTypes.filter((d) => d.required);
  const missingRequired = requiredTypes.filter((dt) => !attachments.some((a) => a.documentTypeId === dt.id));
  // Estado da categoria = arquivo MAIS RECENTE (a decisão do RH prevalece sobre a IA).
  const docStatus = (dt: { id: string; required: boolean }) =>
    sectionStatus(attachments.filter((a) => a.documentTypeId === dt.id), dt.required);
  const docsToReview = documentTypes.filter((dt) => needsAttention(docStatus(dt)));
  const docsRejected = docsToReview.filter((dt) => docStatus(dt) === "HR_REJECTED");
  const docsAiFlagged = docsToReview.filter((dt) => docStatus(dt) !== "HR_REJECTED");

  // ── Formulário do candidato ─────────────────────────────────────────────────────────
  const formState = digitalFormState(admission);
  const lastSent = logs.find((l) => l.action === "FORM_LINK_SENT");

  const isFinal = !!admission.stage?.isFinal;
  const record: AdmissionRecord = {
    fullName: admission.fullName,
    cpf: admission.cpf,
    email: admission.email,
    phone: admission.phone,
    birthDate: admission.birthDate,
    positionId: admission.positionId,
    companyId: admission.companyId,
    branchId: admission.branchId,
    stageId: admission.stageId,
    responsibleId: admission.responsibleId,
    managerName: admission.managerName,
    startDate: admission.startDate,
    medicalExamDate: admission.medicalExamDate,
    salary: admission.salary,
    shift: admission.shift,
    uniformShirt: admission.uniformShirt,
    uniformPants: admission.uniformPants,
    uniformShoe: admission.uniformShoe,
    notes: admission.notes,
  };

  // ── Histórico (só eventos gravados) ─────────────────────────────────────────────────
  const typeName = new Map(documentTypes.map((d) => [d.id, d.name]));
  const historyItems = buildAdmissionHistory({
    createdAt: admission.createdAt,
    createdByName: userName(admission.createdById),
    digitalFormSubmittedAt: admission.digitalFormSubmittedAt,
    attachments: attachments.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      uploadedByName: a.uploadedByName ?? null,
      label: (a.documentTypeId && typeName.get(a.documentTypeId)) || a.fileName,
    })),
    logs: logs.map((l) => ({ ...l, userName: userName(l.userId) })),
  });
  const events: TimelineEvent[] = historyItems.map((h) => ({
    id: h.id,
    at: h.at,
    title: h.title,
    description: h.description,
    icon: ACTIVITY_ICONS[h.icon],
    tone: h.tone,
  }));

  const data: AdmissionWorkspaceData = {
    id,
    record,
    saved: {
      positionName: admission.position?.name ?? null,
      companyName: admission.company?.name ?? null,
      branchName: admission.branch?.name ?? null,
      stageName: admission.stage?.name ?? null,
      stageColor: admission.stage?.color ?? null,
      stageIsFinal: isFinal,
      responsibleName: userName(admission.responsibleId),
    },
    today,
    createdAt: new Date(admission.createdAt).toISOString(),
    updatedAt: new Date(admission.updatedAt).toISOString(),
    form: {
      state: formState,
      submittedAt: admission.digitalFormSubmittedAt,
      expiresAt: admission.digitalFormExpiresAt,
      lastSentAt: lastSent ? new Date(lastSent.createdAt).toISOString() : null,
      currentUrl:
        canManage && formState === "WAITING" && admission.digitalFormToken
          ? `${getAppBaseUrl()}/admissao/${admission.digitalFormToken}`
          : null,
      expiryDays: DIGITAL_FORM_EXPIRY_DAYS,
    },
    answers: {
      needsTransportVoucher: admission.needsTransportVoucher,
      transportVoucherDetails: admission.transportVoucherDetails,
      hasItauAccount: admission.hasItauAccount,
      noOperationalUniform: admission.noOperationalUniform,
      labels: {
        needsTransportVoucher: formConfig.labels.needsTransportVoucher,
        transportVoucherDetails: formConfig.labels.transportVoucherDetails,
        hasItauAccount: formConfig.labels.hasItauAccount,
      },
    },
    origin: {
      job,
      candidateHref:
        admission.sourceApplicationId && admission.sourceJobId
          ? `/vagas/${admission.sourceJobId}/candidatos?candidato=${admission.sourceApplicationId}`
          : null,
    },
    docs: {
      requiredTotal: requiredTypes.length,
      requiredDone: requiredTypes.length - missingRequired.length,
      attention: missingRequired.length + docsToReview.length,
    },
    pendencies: admissionPendencies(
      {
        isFinal,
        hasStage: !!admission.stageId,
        startDate: admission.startDate,
        medicalExamDate: admission.medicalExamDate,
        cpf: admission.cpf,
        formState,
        missingRequiredDocs: missingRequired.map((d) => d.name),
        docsToReview: docsAiFlagged.map((d) => d.name),
        docsRejected: docsRejected.map((d) => d.name),
      },
      todayFrom(today)
    ),
    historyCount: events.length,
  };

  const formAnswers = admission.digitalFormSubmittedAt ? (
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
        formExtras: admission.formExtras,
        submittedAt: admission.digitalFormSubmittedAt,
      }}
    />
  ) : (
    <div className="rounded-card border border-wg-border-lighter bg-white">
      <EmptyState
        icon={ClipboardList}
        compact
        title="O candidato ainda não enviou o formulário de admissão"
        description="As respostas completas (estado civil, vale-transporte, dados bancários, uniforme) aparecem aqui assim que o formulário for enviado. Gere ou copie o link na lateral."
      />
    </div>
  );

  return (
    <AdmissionWorkspace
      data={data}
      options={config}
      canManage={canManage}
      initialTab={parseAdmissionTab(aba)}
      startEditing={editar === "1"}
      documents={<AdmissionAttachments admissionId={id} canManage={canManage} attachments={attachments} documentTypes={documentTypes} />}
      formAnswers={formAnswers}
      recentActivity={<ActivityTimeline events={events} limit={4} />}
      history={
        <section className="rounded-card border border-wg-border-lighter bg-white p-5">
          <ActivityTimeline events={events} />
          <p className="mt-5 flex items-center gap-1.5 border-t border-wg-border-lighter pt-3 text-meta text-wg-ink-muted">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Criação, formulário, documentos, mudanças de etapa, ASO e edições registradas. As mesmas ações aparecem em
            Admissões → Atividades.
          </p>
        </section>
      }
    />
  );
}
