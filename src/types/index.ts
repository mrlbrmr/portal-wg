import type {
  Job,
  Candidate,
  Application,
  AiReview,
  StatusHistory,
  User,
  AuditLog,
  JobStatus,
  ApplicationStatus,
  Modality,
  ContractType,
  UserRole,
} from "@prisma/client";

// Re-exportar enums do Prisma para uso no frontend
export type {
  Job,
  Candidate,
  Application,
  AiReview,
  StatusHistory,
  User,
  AuditLog,
  JobStatus,
  ApplicationStatus,
  Modality,
  ContractType,
  UserRole,
};

// Tipos compostos para o painel interno
export type ApplicationWithDetails = Application & {
  candidate: Candidate;
  job: Pick<Job, "id" | "title" | "city" | "state">;
  aiReview: AiReview | null;
  statusHistory: StatusHistory[];
};

export type JobWithApplicationCount = Job & {
  _count: { applications: number };
};

// Tipos de formulários (validados com Zod nas API routes)
export interface ApplicationFormData {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  jobId: string;
  notes?: string;
  privacyAcceptance: boolean;
  talentPoolAcceptance: boolean;
}

export interface JobFormData {
  title: string;
  department?: string;
  city: string;
  state: string;
  modality: Modality;
  contractType: ContractType;
  description: string;
  responsibilities: string;
  requiredRequirements: string;
  desiredRequirements?: string;
  benefits?: string;
  workSchedule?: string;
  closingDate?: string;
  status: JobStatus;
}

// Extensão do tipo de sessão do NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
    };
  }
}
