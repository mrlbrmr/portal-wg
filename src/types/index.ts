import type {
  Job,
  User,
  JobStatus,
  Modality,
  ContractType,
  UserRole,
} from "@/types/domain";

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
  status: JobStatus;
}
