// Tipos e enums de domínio — antes vinham do cliente gerado do Prisma
// (`@prisma/client`). Com a migração para supabase-js (Fase 4-6), o Prisma saiu;
// estas definições passam a ser a fonte de verdade dos tipos de domínio no app.
//
// Os enums seguem o MESMO padrão que o Prisma gerava — objeto `const` + tipo
// união de literais de string de mesmo nome. Isso preserva 1:1 os usos:
// `z.nativeEnum(X)`, `Object.values(X)`, `X.VALOR` E a atribuição direta de um
// literal de string (`status: "PENDING"`), que um `enum` real não permitiria.
//
// Os tipos de linha (Job, User, ...) usam `Date` nos timestamps (como o Prisma).
// O supabase-js retorna strings ISO — os call sites já castam os dados
// (`as unknown as Job[]`) e normalizam com `new Date(x)` onde necessário.

export const UserRole = {
  ADMIN_RH: "ADMIN_RH",
  VIEWER_RH: "VIEWER_RH",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const JobStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SCREENING: "SCREENING",
  INTERVIEW: "INTERVIEW",
  ADMISSION: "ADMISSION",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const Modality = {
  PRESENTIAL: "PRESENTIAL",
  REMOTE: "REMOTE",
  HYBRID: "HYBRID",
} as const;
export type Modality = (typeof Modality)[keyof typeof Modality];

export const ContractType = {
  CLT: "CLT",
  PJ: "PJ",
  INTERNSHIP: "INTERNSHIP",
  APPRENTICE: "APPRENTICE",
  TEMPORARY: "TEMPORARY",
  OTHER: "OTHER",
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

export const JobPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type JobPriority = (typeof JobPriority)[keyof typeof JobPriority];

export const ApplicationStage = {
  NEW: "NEW",
  SCREENING: "SCREENING",
  INTERVIEW: "INTERVIEW",
  OFFER: "OFFER",
  HIRED: "HIRED",
  REJECTED: "REJECTED",
} as const;
export type ApplicationStage = (typeof ApplicationStage)[keyof typeof ApplicationStage];

export const ChecklistItemStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;
export type ChecklistItemStatus = (typeof ChecklistItemStatus)[keyof typeof ChecklistItemStatus];

export const DistributionChannel = {
  MANUAL: "MANUAL",
  GOOGLE_JOBS: "GOOGLE_JOBS",
  INDEED: "INDEED",
  LINKEDIN_PAGE: "LINKEDIN_PAGE",
  LINKEDIN_NATIVE: "LINKEDIN_NATIVE",
} as const;
export type DistributionChannel = (typeof DistributionChannel)[keyof typeof DistributionChannel];

export const PublicationStatus = {
  NOT_PUBLISHED: "NOT_PUBLISHED",
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  REMOVED: "REMOVED",
} as const;
export type PublicationStatus = (typeof PublicationStatus)[keyof typeof PublicationStatus];

// ─── Tipos de linha (mapeiam as tabelas; timestamps como Date, igual ao Prisma) ─

export interface Job {
  id: string;
  title: string;
  department: string | null;
  company: string | null;
  city: string;
  state: string;
  modality: Modality;
  contractType: ContractType;
  description: string;
  responsibilities: string;
  requiredRequirements: string;
  desiredRequirements: string | null;
  benefits: string | null;
  workSchedule: string | null;
  salaryRange: string | null;
  openings: number | null;
  highlightBenefit: string | null;
  responsible: string | null;
  slug: string | null;
  closingDate: Date | null;
  hiringDeadline: Date | null;
  priority: JobPriority;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobStatusHistory {
  id: string;
  jobId: string;
  status: JobStatus;
  changedBy: string;
  changedAt: Date;
}

export interface JobPublication {
  id: string;
  jobId: string;
  channel: DistributionChannel;
  status: PublicationStatus;
  externalId: string | null;
  externalUrl: string | null;
  lastError: string | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HomepageConfig {
  id: string;
  showDepartment: boolean;
  showLocation: boolean;
  showModality: boolean;
  showContractType: boolean;
  showCompany: boolean;
  showWorkSchedule: boolean;
  showSalary: boolean;
  showHighlightBenefit: boolean;
  showOpenings: boolean;
  showFilters: boolean;
  showJobCounter: boolean;
  jobsSectionTitle: string;
  jobsSectionSubtitle: string;
  updatedAt: Date;
}
