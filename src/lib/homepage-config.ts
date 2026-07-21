import type { HomepageConfig } from "@/types/domain";

export type HomepageConfigData = Omit<HomepageConfig, "id" | "updatedAt">;

export const DEFAULT_CONFIG: HomepageConfigData = {
  showDepartment: true,
  showLocation: true,
  showModality: true,
  showContractType: true,
  showCompany: false,
  showWorkSchedule: false,
  showSalary: false,
  showHighlightBenefit: false,
  showOpenings: false,
  showFilters: true,
  showJobCounter: true,
  jobsSectionTitle: "Vagas abertas",
  jobsSectionSubtitle:
    "Encontre a oportunidade ideal para crescer com o Grupo WG.",
};
