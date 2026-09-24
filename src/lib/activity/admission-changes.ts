import type { SupabaseClient } from "@supabase/supabase-js";
import { diffFields, logActivity } from "./log";
import { maskPhone } from "@/lib/admissao/workspace";

// Registro das mudanças de uma admissão (etapa, ASO, dados principais). O chamador tira
// um retrato ANTES e outro DEPOIS da gravação; aqui viram eventos de Atividades:
//   • STAGE_CHANGED / ADMISSION_COMPLETED — etapa anterior → nova
//   • EXAM_DATE_UPDATED                   — data do ASO anterior → nova
//   • ADMISSION_UPDATED                   — demais campos acompanhados (lista de-para)

export interface AdmissionSnapshot {
  fullName: string;
  stageId: string | null;
  stageName: string | null;
  stageIsFinal: boolean;
  fields: Record<string, string | null>;
}

const TRACKED_LABELS: Record<string, string> = {
  fullName: "Nome",
  position: "Cargo",
  company: "Empresa",
  branch: "Filial",
  responsible: "Responsável",
  startDate: "Data de início",
  managerName: "Gestor",
  shift: "Turno",
  // Dados pessoais (em geral informados pelo candidato): corrigir precisa deixar rastro.
  cpf: "CPF",
  email: "E-mail",
  phone: "Telefone",
  birthDate: "Data de nascimento",
  salary: "Salário",
  uniformShirt: "Camiseta",
  uniformPants: "Calça",
  uniformShoe: "Sapato",
};

/** CPF no log só com os 5 últimos dígitos — o histórico não precisa do número inteiro. */
function maskedCpf(v: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.length === 11 ? `***.***.${d.slice(6, 9)}-${d.slice(9)}` : "***";
}

function brl(v: number | string | null): string | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n).replace(/\s/g, " ") : String(v);
}

function br(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export async function snapshotAdmission(supabase: SupabaseClient, id: string): Promise<AdmissionSnapshot | null> {
  const { data } = await supabase
    .from("admissions")
    .select(
      `fullName, stageId, startDate, medicalExamDate, responsibleId, managerName, shift,
       cpf, email, phone, birthDate, salary, uniformShirt, uniformPants, uniformShoe,
       position:admission_positions(name), company:admission_companies(name),
       branch:admission_branches(name), stage:admission_stages(name, isFinal)`
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const a = data as unknown as {
    fullName: string;
    stageId: string | null;
    startDate: string | null;
    medicalExamDate: string | null;
    responsibleId: string | null;
    managerName: string | null;
    shift: string | null;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    salary: number | string | null;
    uniformShirt: string | null;
    uniformPants: string | null;
    uniformShoe: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { name: string; isFinal: boolean } | null;
  };
  let responsible: string | null = null;
  if (a.responsibleId) {
    const { data: u } = await supabase.from("users").select("name").eq("id", a.responsibleId).maybeSingle();
    responsible = (u as { name?: string } | null)?.name ?? null;
  }
  return {
    fullName: a.fullName,
    stageId: a.stageId,
    stageName: a.stage?.name ?? null,
    stageIsFinal: !!a.stage?.isFinal,
    fields: {
      fullName: a.fullName,
      position: a.position?.name ?? null,
      company: a.company?.name ?? null,
      branch: a.branch?.name ?? null,
      responsible,
      startDate: br(a.startDate),
      medicalExamDate: br(a.medicalExamDate),
      managerName: a.managerName,
      shift: a.shift,
      // Normalizados (dígitos → máscara) para não acusar mudança só de formatação.
      cpf: maskedCpf(a.cpf),
      email: a.email,
      phone: a.phone ? maskPhone(a.phone) || null : null,
      birthDate: br(a.birthDate),
      salary: brl(a.salary),
      uniformShirt: a.uniformShirt,
      uniformPants: a.uniformPants,
      uniformShoe: a.uniformShoe,
    },
  };
}

export async function logAdmissionChanges(
  supabase: SupabaseClient,
  input: { admissionId: string; userId: string; before: AdmissionSnapshot | null; after: AdmissionSnapshot | null; source?: "form" | "kanban" }
): Promise<void> {
  const { admissionId, userId, before, after } = input;
  if (!before || !after) return;
  const base = { entity: "ADMISSION" as const, entityId: admissionId, admissionId, userId };

  if ((before.stageId ?? "") !== (after.stageId ?? "")) {
    const completed = after.stageIsFinal && !before.stageIsFinal;
    await logActivity(supabase, {
      ...base,
      action: completed ? "ADMISSION_COMPLETED" : "STAGE_CHANGED",
      description: `${before.stageName ?? "Sem etapa"} → ${after.stageName ?? "Sem etapa"}`,
      metadata: { from: before.stageName ?? "Sem etapa", to: after.stageName ?? "Sem etapa", subjectName: after.fullName },
    });
  }

  const examFrom = before.fields.medicalExamDate;
  const examTo = after.fields.medicalExamDate;
  if ((examFrom ?? "") !== (examTo ?? "")) {
    await logActivity(supabase, {
      ...base,
      action: "EXAM_DATE_UPDATED",
      description: examTo ? `ASO ${examFrom ? "reagendado" : "agendado"} para ${examTo}` : "Data do ASO removida",
      metadata: { from: examFrom ?? "Sem data", to: examTo ?? "Sem data", subjectName: after.fullName },
    });
  }

  if (input.source === "kanban") return;
  const changes = diffFields(before.fields, after.fields, TRACKED_LABELS);
  // Só etapa/ASO mudaram: os eventos acima já contam a história.
  const stageOrExamLogged = (before.stageId ?? "") !== (after.stageId ?? "") || (examFrom ?? "") !== (examTo ?? "");
  if (changes.length === 0 && stageOrExamLogged) return;
  await logActivity(supabase, {
    ...base,
    action: "ADMISSION_UPDATED",
    description:
      changes.length === 0
        ? "Dados da admissão salvos"
        : changes.length === 1
          ? `${changes[0].label} alterado`
          : `${changes.length} campos alterados`,
    metadata: { changes, subjectName: after.fullName },
  });
}
