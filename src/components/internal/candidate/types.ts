// Formato de GET /api/applications/[id] consumido pelo drawer do candidato.

export interface StageRef {
  name: string;
  color: string;
}

export interface StageHistoryEntry {
  id: string;
  stageId: string | null;
  stage: StageRef | null;
  changedBy: string;
  changedAt: string;
}

export interface CandidateDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stageId: string;
  stage: StageRef | null;
  source: string;
  addedBy: string | null;
  notes: string | null;
  createdAt: string;
  country: string | null;
  candidateCity: string | null;
  candidateState: string | null;
  availablePresential: boolean | null;
  salaryExpectation: number | null;
  /** Perfil extraído do currículo por IA (null = currículo ainda não lido). */
  cv_profile: {
    experienceYears?: number | null;
    education?: string | null;
    lastPosition?: string | null;
    skills?: string[];
  } | null;
  stageHistory: StageHistoryEntry[];
  /** Recrutador responsável pela VAGA (jobs.responsible) — não há responsável por candidatura. */
  jobResponsible: string | null;
  /** Requisitos obrigatórios da vaga, em lista (extraídos do HTML da vaga). */
  screeningCriteria: string[];
}

export interface LinkedAdmission {
  id: string;
  startDate: string | null;
  digitalFormSubmittedAt: string | null;
  stage: StageRef | null;
}

// ── Formatação ──────────────────────────────────────────────────────────────

export function formatPhoneMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** "21/09/2026 às 14:32" (fuso de São Paulo). */
export function formatDateAtTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

/** "Curitiba/PR", "Curitiba" ou null. */
export function candidateLocation(c: Pick<CandidateDetail, "candidateCity" | "candidateState">): string | null {
  const city = c.candidateCity?.trim();
  const uf = c.candidateState?.trim();
  if (city && uf) return `${city}/${uf.toUpperCase()}`;
  return city || uf?.toUpperCase() || null;
}

/** Link do WhatsApp (DDI 55) — só com telefone brasileiro plausível (10–11 dígitos). */
export function whatsappUrl(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `https://wa.me/55${d}` : null;
}
