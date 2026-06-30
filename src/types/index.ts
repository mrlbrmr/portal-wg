import type {
  Job,
  User,
  JobStatus,
  Modality,
  ContractType,
  UserRole,
} from "@prisma/client";

export type { Job, User, JobStatus, Modality, ContractType, UserRole };

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
  tallyFormUrl?: string;
  status: JobStatus;
}

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
