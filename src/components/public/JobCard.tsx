import Link from "next/link";
import { MapPin, ArrowRight, Clock, Building2, Wallet, Star, Users, Sparkles } from "lucide-react";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { Job } from "@/types/domain";
import type { HomepageConfigData } from "@/lib/homepage-config";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  job: Job;
  config: HomepageConfigData;
}

export default function JobCard({ job, config }: Props) {
  const isNew = Date.now() - new Date(job.createdAt as Date | string).getTime() < SEVEN_DAYS_MS;

  return (
    <Link
      href={`/vagas/${job.slug ?? job.id}`}
      className="block bg-wg-card border border-wg-border rounded-2xl p-5
        hover:border-wg-green hover:-translate-y-1
        hover:shadow-[0_8px_32px_rgba(144,203,70,0.13)]
        transition-all duration-200 ease-spring group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Cargo + badge Nova */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white group-hover:text-wg-green transition-colors duration-200 line-clamp-2">
              {job.title}
            </h3>
            {isNew && (
              <span className="inline-flex items-center gap-0.5 bg-wg-green text-black text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                <Sparkles className="w-2.5 h-2.5" />
                Nova
              </span>
            )}
          </div>

          {/* Área / departamento */}
          {config.showDepartment && job.department && (
            <p className="text-sm text-wg-gray mt-0.5">{job.department}</p>
          )}

          {/* Empresa / unidade */}
          {config.showCompany && job.company && (
            <p className="flex items-center gap-1 text-xs text-wg-gray mt-0.5">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              {job.company}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Cidade / UF */}
            {config.showLocation && (
              <span className="flex items-center gap-1 text-xs text-wg-gray">
                <MapPin className="w-3.5 h-3.5 text-wg-green flex-shrink-0" />
                {job.city} / {job.state}
              </span>
            )}

            {/* Modalidade */}
            {config.showModality && (
              <span className="inline-flex items-center bg-wg-green/10 text-wg-green text-xs font-medium px-2.5 py-0.5 rounded-full">
                {MODALITY_LABELS[job.modality]}
              </span>
            )}

            {/* Tipo de contrato */}
            {config.showContractType && (
              <span className="inline-flex items-center bg-wg-card-2 border border-wg-border text-wg-gray text-xs px-2.5 py-0.5 rounded-full">
                {CONTRACT_TYPE_LABELS[job.contractType]}
              </span>
            )}

            {/* Jornada / horário */}
            {config.showWorkSchedule && job.workSchedule && (
              <span className="flex items-center gap-1 text-xs text-wg-gray">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {job.workSchedule}
              </span>
            )}

            {/* Salário */}
            {config.showSalary && job.salaryRange && (
              <span className="flex items-center gap-1 text-xs text-wg-gray">
                <Wallet className="w-3 h-3 flex-shrink-0" />
                {job.salaryRange}
              </span>
            )}

            {/* Benefício destaque */}
            {config.showHighlightBenefit && job.highlightBenefit && (
              <span className="flex items-center gap-1 text-xs text-wg-gray">
                <Star className="w-3 h-3 flex-shrink-0 text-wg-green" />
                {job.highlightBenefit}
              </span>
            )}

            {/* Quantidade de vagas */}
            {config.showOpenings && job.openings && job.openings > 0 && (
              <span className="flex items-center gap-1 text-xs text-wg-gray">
                <Users className="w-3 h-3 flex-shrink-0" />
                {job.openings} {job.openings === 1 ? "vaga" : "vagas"}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 mt-0.5">
          <span className="inline-flex items-center gap-1.5 bg-wg-green text-black text-sm font-bold px-4 py-2 rounded-full
            group-hover:bg-wg-green-bright group-hover:shadow-[0_4px_14px_rgba(144,203,70,0.45)]
            transition-all duration-200 whitespace-nowrap">
            Ver vaga
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
