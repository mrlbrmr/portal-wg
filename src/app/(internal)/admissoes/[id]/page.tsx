import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  CalendarDays,
  FilePlus2,
  FileCheck2,
  FileText,
  UserPlus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import { loadFormConfig } from "@/lib/admissao/form-config-loader";
import { DIGITAL_FORM_EXPIRY_DAYS } from "@/lib/admissao/form-config";
import { digitalFormState, daysUntilStart } from "@/lib/admissao/overview";
import { sectionStatus } from "@/lib/admissao/document-status";
import { getAppBaseUrl } from "@/lib/app-url";
import { formatRelativeTime } from "@/lib/utils";
import {
  AdmissionAttachments,
  type AttachmentView,
} from "@/components/internal/admissao/AdmissionAttachments";
import { DigitalAdmissionCard } from "@/components/internal/admissao/DigitalAdmissionCard";
import { AdmissionDetailTabs } from "@/components/internal/admissao/AdmissionDetailTabs";
import { AdmissionJourney } from "@/components/internal/admissao/AdmissionJourney";
import { DigitalFormViewer } from "@/components/internal/admissao/DigitalFormViewer";
import { ActivityTimeline, type TimelineEvent } from "@/components/ui/ActivityTimeline";
import { StatusBadge, StageBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("admissions").select("fullName").eq("id", id).single();
  return { title: data?.fullName ? `${data.fullName} — Admissão — RH` : "Ficha da admissão — RH" };
}

function fmtDate(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null;
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
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  stageId: string | null;
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
  }>;
}

export default async function AdmissaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams]);

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
         attachments:admission_attachments(id, fileName, mimeType, sizeBytes, createdAt, documentTypeId, uploadedById, aiStatus, aiReason)`
      )
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle(),
    supabase.from("admission_document_types").select("id, name, required").order("sortOrder", { ascending: true }),
    getAdmissionConfig(),
    loadFormConfig(),
    supabase
      .from("admission_activity_log")
      .select("id, userId, action, description, createdAt")
      .eq("admissionId", id)
      .order("createdAt", { ascending: false })
      .limit(50),
  ]);

  const admission = admissionRes.data as unknown as AdmissionDetail | null;
  if (!admission) notFound();

  const documentTypes = (documentTypesRes.data ?? []) as Array<{ id: string; name: string; required: boolean }>;
  const canManage = session?.user.role === "ADMIN_RH";
  const userMap = new Map(config.users.map((u) => [u.id, u.name]));
  const now = new Date();

  const extraFieldDefs = formConfig.documents.flatMap((d) => d.extraFields ?? []);
  const extraRows = admission.formExtras
    ? Object.entries(admission.formExtras)
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
      aiStatus: a.aiStatus,
      aiReason: a.aiReason,
      uploadedByName: a.uploadedById ? (userMap.get(a.uploadedById) ?? null) : null,
    }));

  // ── Progresso ───────────────────────────────────────────────────────────────
  const stageIdx = admission.stageId ? config.stages.findIndex((s) => s.id === admission.stageId) : -1;
  const stagePct = stageIdx >= 0 && config.stages.length ? Math.round(((stageIdx + 1) / config.stages.length) * 100) : 0;
  const requiredTypes = documentTypes.filter((d) => d.required);
  const missingRequired = requiredTypes.filter((dt) => !attachments.some((a) => a.documentTypeId === dt.id));
  // Documento "a revisar" = o arquivo MAIS RECENTE da categoria foi sinalizado pela IA.
  const docsToReview = documentTypes.filter((dt) => {
    const st = sectionStatus(attachments.filter((a) => a.documentTypeId === dt.id), dt.required);
    return st === "NEEDS_REVIEW" || st === "AI_REJECTED";
  });
  const formState = digitalFormState(admission, now);
  const startDays = admission.startDate ? daysUntilStart(admission.startDate.slice(0, 10), now) : null;
  const isFinal = !!admission.stage?.isFinal;

  const responsibleName = admission.responsibleId ? (userMap.get(admission.responsibleId) ?? null) : null;
  const salaryFmt =
    admission.salary != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(admission.salary))
      : null;
  const initials = admission.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  // ── Pendências (só fatos reais) ─────────────────────────────────────────────
  const pendencies: Array<{ key: string; tone: "danger" | "warning" | "info"; text: string; href?: string }> = [];
  if (!isFinal) {
    if (startDays !== null && startDays < 0)
      pendencies.push({ key: "late", tone: "danger", text: `A data de início passou há ${-startDays} ${-startDays === 1 ? "dia" : "dias"} e a admissão não foi concluída.` });
    if (missingRequired.length > 0)
      pendencies.push({
        key: "docs",
        tone: "warning",
        text: `${missingRequired.length} ${missingRequired.length === 1 ? "documento obrigatório pendente" : "documentos obrigatórios pendentes"}: ${missingRequired.map((d) => d.name).join(", ")}.`,
        href: "?aba=documentos",
      });
    if (docsToReview.length > 0)
      pendencies.push({
        key: "review",
        tone: "warning",
        text: `${docsToReview.map((d) => d.name).join(", ")}: ${docsToReview.length === 1 ? "precisa" : "precisam"} de revisão após a validação automática.`,
        href: "?aba=documentos",
      });
    if (formState === "WAITING") pendencies.push({ key: "form", tone: "info", text: "Formulário admissional enviado ao candidato, aguardando preenchimento." });
    if (formState === "EXPIRED") pendencies.push({ key: "form", tone: "warning", text: "O link do formulário expirou sem resposta do candidato." });
    if (formState === "NOT_SENT") pendencies.push({ key: "form", tone: "info", text: "O formulário admissional ainda não foi enviado ao candidato." });
    if (!admission.startDate) pendencies.push({ key: "start", tone: "info", text: "Data de início ainda não definida." });
    if (!admission.medicalExamDate) pendencies.push({ key: "exam", tone: "info", text: "Data do exame admissional ainda não registrada." });
  }

  // ── Histórico: apenas eventos registrados no banco ──────────────────────────
  const events: TimelineEvent[] = [
    {
      id: "created",
      at: new Date(admission.createdAt).toISOString(),
      title: (
        <>
          Admissão criada
          {admission.createdById && userMap.get(admission.createdById) ? ` por ${userMap.get(admission.createdById)}` : ""}
        </>
      ),
      icon: UserPlus,
      tone: "success",
    },
  ];
  if (admission.digitalFormSubmittedAt) {
    events.push({
      id: "form",
      at: new Date(admission.digitalFormSubmittedAt).toISOString(),
      title: "Candidato enviou o formulário admissional",
      icon: FileCheck2,
      tone: "success",
    });
  }
  // Anexos enviados juntos (mesma pessoa, até 10 min de diferença) viram um único evento.
  const byTime = [...attachments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const typeName = new Map(documentTypes.map((d) => [d.id, d.name]));
  let group: AttachmentView[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const who = group[0].uploadedByName;
    const names = group.map((g) => (g.documentTypeId && typeName.get(g.documentTypeId)) || g.fileName);
    events.push({
      id: `att-${group[0].id}`,
      at: group[group.length - 1].createdAt,
      title: who
        ? `${who} enviou ${group.length === 1 ? "1 documento" : `${group.length} documentos`}`
        : group.length === 1
          ? "1 documento recebido"
          : `${group.length} documentos recebidos`,
      description: names.join(", "),
      icon: FilePlus2,
      tone: "info",
    });
    group = [];
  };
  for (const a of byTime) {
    const prev = group[group.length - 1];
    if (prev && (prev.uploadedByName !== a.uploadedByName || new Date(a.createdAt).getTime() - new Date(prev.createdAt).getTime() > 10 * 60_000)) {
      flush();
    }
    group.push(a);
  }
  flush();
  for (const log of (activityRes.data ?? []) as Array<{ id: number; userId: string | null; action: string; description: string | null; createdAt: string }>) {
    events.push({
      id: `log-${log.id}`,
      at: new Date(log.createdAt).toISOString(),
      title: log.description ?? log.action,
      description: log.userId && userMap.get(log.userId) ? `Por ${userMap.get(log.userId)}` : undefined,
      icon: Activity,
      tone: "neutral",
    });
  }

  const formViewerNode = admission.digitalFormSubmittedAt ? (
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
        title="O candidato ainda não enviou o formulário admissional"
        description="Os dados cadastrais aparecem aqui assim que o formulário digital for preenchido. Gere ou copie o link no card Admissão digital."
      />
    </div>
  );

  const hasUniform = !!(admission.uniformShirt || admission.uniformPants || admission.uniformShoe);

  const overview = (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="pend-title" className="rounded-card border border-wg-border-lighter bg-white p-5">
        <h2 id="pend-title" className="mb-3 font-sora text-section-title text-wg-ink">
          Pendências
        </h2>
        {pendencies.length === 0 ? (
          <p className="flex items-center gap-2 text-body text-success-fg">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {isFinal ? "Admissão concluída." : "Nenhuma pendência registrada para esta admissão."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendencies.map((p) => (
              <li key={p.key} className="flex items-start gap-2 text-body text-wg-ink">
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${p.tone === "danger" ? "text-danger" : p.tone === "warning" ? "text-warning" : "text-info"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  {p.text}
                  {p.href && (
                    <Link href={p.href} scroll={false} className="ml-1.5 font-semibold text-wg-green-dark hover:underline">
                      Ver documentos
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-title" className="rounded-card border border-wg-border-lighter bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="recent-title" className="font-sora text-section-title text-wg-ink">
            Atividade recente
          </h2>
          {events.length > 4 && (
            <Link href="?aba=historico" scroll={false} className="text-meta font-semibold text-wg-green-dark hover:underline">
              Ver histórico completo
            </Link>
          )}
        </div>
        <ActivityTimeline events={events} limit={4} />
      </section>

      {(hasUniform || extraRows.length > 0 || admission.notes) && (
        <section aria-labelledby="op-title" className="rounded-card border border-wg-border-lighter bg-white p-5">
          <h2 id="op-title" className="mb-3 font-sora text-section-title text-wg-ink">
            Dados operacionais
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {hasUniform && (
              <>
                <InfoRow label="Camiseta" value={admission.uniformShirt ?? "—"} />
                <InfoRow label="Calça" value={admission.uniformPants ?? "—"} />
                <InfoRow label="Sapato" value={admission.uniformShoe ?? "—"} />
              </>
            )}
            {extraRows.map((r) => (
              <InfoRow key={r.label} label={r.label} value={r.value} />
            ))}
          </dl>
          {admission.notes && (
            <div className="mt-4 border-t border-wg-border-lighter pt-3">
              <p className="mb-1 text-label text-wg-ink-muted">Observações</p>
              <p className="whitespace-pre-wrap text-body text-wg-ink">{admission.notes}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );

  const pendingDocsBadge = missingRequired.length + docsToReview.length;

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Barra superior */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/admissoes"
          className="inline-flex items-center gap-1.5 rounded-md px-1 text-meta font-semibold text-wg-ink-muted transition-colors hover:text-wg-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Admissões
        </Link>
        {canManage && (
          <ButtonLink href={`/admissoes/${id}/editar`} variant="secondary" icon={Pencil}>
            Editar admissão
          </ButtonLink>
        )}
      </div>

      {/* Cabeçalho: quem, onde, status e progresso */}
      <header className="mb-5 rounded-card border border-wg-border-lighter bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-wg-border-light font-sora text-[17px] font-semibold text-[#2E4319]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-sora text-2xl font-semibold tracking-tight text-wg-ink">{admission.fullName}</h1>
            <p className="mt-0.5 text-body text-wg-ink-secondary">
              {[admission.position?.name ?? "Cargo não definido", admission.company?.name, admission.branch?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {admission.stage ? (
                <StageBadge color={admission.stage.color} hint="Etapa atual">
                  {admission.stage.name}
                </StageBadge>
              ) : (
                <StageBadge>Sem etapa</StageBadge>
              )}
              {isFinal && <StatusBadge tone="success">Concluída</StatusBadge>}
              {!isFinal && startDays !== null && startDays < 0 && <StatusBadge tone="danger">Início vencido</StatusBadge>}
              <span className="text-meta text-wg-ink-muted">Atualizada {formatRelativeTime(admission.updatedAt, now)}</span>
            </div>
          </div>
          <div className="w-full min-w-[220px] sm:w-auto sm:max-w-[260px] sm:flex-1">
            <div className="mb-1 flex items-baseline justify-between text-meta">
              <span className="text-wg-ink-secondary">
                {stageIdx >= 0 ? `Etapa ${stageIdx + 1} de ${config.stages.length}` : "Jornada não iniciada"}
              </span>
              <span className="font-semibold tabular-nums text-wg-ink">{stagePct}%</span>
            </div>
            <ProgressBar value={stagePct} label="Progresso geral da admissão" />
            {requiredTypes.length > 0 && (
              <p className="mt-1.5 text-meta text-wg-ink-muted">
                {requiredTypes.length - missingRequired.length} de {requiredTypes.length} documentos obrigatórios
              </p>
            )}
          </div>
        </div>

        {config.stages.length > 0 && (
          <div className="mt-5 border-t border-wg-border-lighter pt-4">
            <AdmissionJourney stages={config.stages} currentStageId={admission.stageId} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Resumo */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section aria-labelledby="resumo-title" className="rounded-card border border-wg-border-lighter bg-white p-5">
            <h2 id="resumo-title" className="sr-only">
              Resumo
            </h2>
            <div className="mb-4 flex items-center gap-3 rounded-control bg-wg-sidebar px-3 py-2.5">
              <CalendarDays className="h-5 w-5 shrink-0 text-wg-green-dark" aria-hidden />
              <div>
                <p className="text-label text-wg-ink-muted">Data de início</p>
                <p className="font-sora text-lg font-semibold tabular-nums text-wg-ink">
                  {fmtDate(admission.startDate) ?? "A definir"}
                </p>
                {startDays !== null && !isFinal && (
                  <p className={`text-[12px] ${startDays < 0 ? "text-danger-fg" : "text-wg-ink-muted"}`}>
                    {startDays === 0 ? "Hoje" : startDays > 0 ? `Em ${startDays} ${startDays === 1 ? "dia" : "dias"}` : `Há ${-startDays} ${-startDays === 1 ? "dia" : "dias"}`}
                  </p>
                )}
              </div>
            </div>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Cargo" value={admission.position?.name} />
              <InfoRow label="Empresa" value={admission.company?.name} />
              <InfoRow label="Filial" value={admission.branch?.name} />
              <InfoRow label="Responsável RH" value={responsibleName} />
              <InfoRow label="Gestor" value={admission.managerName} />
              <InfoRow label="Turno" value={admission.shift} />
              <InfoRow label="Salário" value={salaryFmt} />
              <InfoRow label="Exame admissional" value={fmtDate(admission.medicalExamDate)} />
            </dl>
            <div className="my-4 border-t border-wg-border-lighter" />
            <dl className="flex flex-col gap-3">
              <InfoRow label="E-mail" value={admission.email} />
              <InfoRow label="Telefone" value={fmtPhone(admission.phone)} />
              <InfoRow label="CPF" value={fmtCpf(admission.cpf)} />
              <InfoRow label="Nascimento" value={fmtDate(admission.birthDate)} />
            </dl>
          </section>

          {canManage && (
            <DigitalAdmissionCard
              admissionId={id}
              state={formState}
              submittedAt={admission.digitalFormSubmittedAt}
              tokenExpiresAt={admission.digitalFormExpiresAt}
              currentUrl={
                formState === "WAITING" && admission.digitalFormToken
                  ? `${getAppBaseUrl()}/admissao/${admission.digitalFormToken}`
                  : null
              }
              expiryDays={DIGITAL_FORM_EXPIRY_DAYS}
            />
          )}
        </aside>

        {/* Área principal */}
        <AdmissionDetailTabs
          key={aba ?? "visao-geral"}
          initialTab={aba}
          tabs={[
            {
              key: "visao-geral",
              label: "Visão geral",
              badge: pendencies.length > 0 ? { text: String(pendencies.length), tone: "warning" } : undefined,
              content: overview,
            },
            {
              key: "documentos",
              label: "Documentos",
              badge: pendingDocsBadge > 0 ? { text: `${pendingDocsBadge} pendente${pendingDocsBadge === 1 ? "" : "s"}`, tone: "warning" } : undefined,
              content: (
                <AdmissionAttachments
                  admissionId={id}
                  canManage={canManage}
                  attachments={attachments}
                  documentTypes={documentTypes}
                />
              ),
            },
            {
              key: "dados",
              label: "Dados cadastrais",
              badge: admission.digitalFormSubmittedAt ? undefined : { text: "Aguardando", tone: "neutral" },
              content: formViewerNode,
            },
            {
              key: "historico",
              label: "Histórico",
              content: (
                <section className="rounded-card border border-wg-border-lighter bg-white p-5">
                  <ActivityTimeline events={events} />
                  <p className="mt-5 flex items-center gap-1.5 border-t border-wg-border-lighter pt-3 text-meta text-wg-ink-muted">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    Mostra criação, envio do formulário, documentos e eventos registrados. Mudanças de etapa e edições
                    passam a aparecer aqui quando forem gravadas no log de atividades.
                  </p>
                </section>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-label text-wg-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-body text-wg-ink">{value}</dd>
    </div>
  );
}
