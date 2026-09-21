import type { SupabaseClient } from "@supabase/supabase-js";

// Visão operacional das admissões: progresso na jornada (etapas configuradas), documentos
// obrigatórios, estado do formulário digital e última movimentação. Compartilhada pelo
// Dashboard e pela lista de Admissões para que pendências e números coincidam.

export type DigitalFormState = "NOT_SENT" | "WAITING" | "EXPIRED" | "SUBMITTED";

export const DIGITAL_FORM_META: Record<DigitalFormState, { label: string; tone: "neutral" | "warning" | "danger" | "success" }> = {
  NOT_SENT: { label: "Formulário não enviado", tone: "neutral" },
  WAITING: { label: "Aguardando candidato", tone: "warning" },
  EXPIRED: { label: "Link expirado", tone: "danger" },
  SUBMITTED: { label: "Formulário recebido", tone: "success" },
};

export function digitalFormState(
  a: { digitalFormToken?: string | null; digitalFormExpiresAt?: string | null; digitalFormSubmittedAt?: string | null },
  now: Date = new Date()
): DigitalFormState {
  if (a.digitalFormSubmittedAt) return "SUBMITTED";
  if (!a.digitalFormToken) return "NOT_SENT";
  if (a.digitalFormExpiresAt && new Date(a.digitalFormExpiresAt) < now) return "EXPIRED";
  return "WAITING";
}

export interface AdmissionOverviewRow {
  id: string;
  fullName: string;
  cpf: string | null;
  positionName: string | null;
  companyId: string | null;
  companyName: string | null;
  branchName: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  isFinal: boolean;
  /** Posição da etapa atual na jornada configurada (1-based); null se sem etapa. */
  stageIndex: number | null;
  stageTotal: number;
  responsibleName: string | null;
  startDateISO: string | null; // YYYY-MM-DD
  createdAt: string; // ISO
  updatedAt: string; // ISO
  requiredDocsTotal: number;
  requiredDocsDone: number;
  digitalForm: DigitalFormState;
}

export async function loadAdmissionRows(
  supabase: SupabaseClient,
  config: { stages: Array<{ id: string }>; users: Array<{ id: string; name: string }> }
): Promise<AdmissionOverviewRow[]> {
  const [admissionsRes, docTypesRes, attachmentsRes] = await Promise.all([
    supabase
      .from("admissions")
      .select(
        `id, fullName, cpf, stageId, startDate, createdAt, updatedAt, companyId, responsibleId,
         digitalFormToken, digitalFormExpiresAt, digitalFormSubmittedAt,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name),
         stage:admission_stages(id, name, color, isFinal)`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(300),
    supabase.from("admission_document_types").select("id").eq("required", true),
    supabase
      .from("admission_attachments")
      .select("admissionId, documentTypeId")
      .not("documentTypeId", "is", null)
      .limit(20000),
  ]);

  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    cpf: string | null;
    stageId: string | null;
    startDate: string | null;
    createdAt: string;
    updatedAt: string;
    companyId: string | null;
    responsibleId: string | null;
    digitalFormToken: string | null;
    digitalFormExpiresAt: string | null;
    digitalFormSubmittedAt: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { id: string; name: string; color: string; isFinal: boolean } | null;
  }>;

  const requiredIds = new Set(((docTypesRes.data ?? []) as Array<{ id: string }>).map((d) => d.id));
  const docsByAdmission = new Map<string, Set<string>>();
  for (const a of (attachmentsRes.data ?? []) as Array<{ admissionId: string; documentTypeId: string }>) {
    if (!requiredIds.has(a.documentTypeId)) continue;
    let set = docsByAdmission.get(a.admissionId);
    if (!set) docsByAdmission.set(a.admissionId, (set = new Set()));
    set.add(a.documentTypeId);
  }

  const userMap = new Map(config.users.map((u) => [u.id, u.name]));
  const stageOrder = config.stages.map((s) => s.id);
  const now = new Date();

  return admissions.map((a) => {
    const idx = a.stageId ? stageOrder.indexOf(a.stageId) : -1;
    return {
      id: a.id,
      fullName: a.fullName,
      cpf: a.cpf,
      positionName: a.position?.name ?? null,
      companyId: a.companyId,
      companyName: a.company?.name ?? null,
      branchName: a.branch?.name ?? null,
      stageId: a.stage?.id ?? null,
      stageName: a.stage?.name ?? null,
      stageColor: a.stage?.color ?? null,
      isFinal: !!a.stage?.isFinal,
      stageIndex: idx >= 0 ? idx + 1 : null,
      stageTotal: stageOrder.length,
      responsibleName: a.responsibleId ? (userMap.get(a.responsibleId) ?? null) : null,
      startDateISO: a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : null,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
      requiredDocsTotal: requiredIds.size,
      requiredDocsDone: docsByAdmission.get(a.id)?.size ?? 0,
      digitalForm: digitalFormState(a, now),
    };
  });
}

/** Dias corridos até o início (negativo = já passou). Datas "YYYY-MM-DD" em horário local. */
export function daysUntilStart(startDateISO: string, today: Date = new Date()): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const start = new Date(startDateISO + "T00:00:00");
  return Math.round((start.getTime() - t.getTime()) / 86_400_000);
}

/** Pendências operacionais de uma admissão em aberto (usadas em filtros e contagens). */
export function admissionFlags(r: AdmissionOverviewRow, today: Date = new Date()) {
  const days = r.startDateISO ? daysUntilStart(r.startDateISO, today) : null;
  return {
    late: !r.isFinal && days !== null && days < 0,
    upcoming: !r.isFinal && days !== null && days >= 0 && days <= 7,
    missingDocs: !r.isFinal && r.requiredDocsDone < r.requiredDocsTotal,
    waitingForm: !r.isFinal && (r.digitalForm === "WAITING" || r.digitalForm === "EXPIRED"),
  };
}
