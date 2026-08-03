import { memo } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Clock, Building2, Wallet, Star, Users, Sparkles, Globe } from "lucide-react";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { Job } from "@/types/domain";
import type { HomepageConfigData } from "@/lib/homepage-config";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  job: Job;
  config: HomepageConfigData;
}

export default memo(function JobCard({ job, config }: Props) {
  const isNew = Date.now() - new Date(job.createdAt as Date | string).getTime() < SEVEN_DAYS_MS;
  const hasLocation = Boolean(job.city && job.state);

  return (
    <Link
      href={`/vagas/${job.slug ?? job.id}`}
      className="block bg-wg-card border border-wg-border rounded-[20px] p-6 md:p-7
        hover:border-wg-green hover:-translate-y-1
        hover:shadow-[0_8px_32px_rgba(144,203,70,0.13)]
        transition-all duration-200 ease-spring group"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Cargo + badge Nova */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <h3 className="text-[18px] font-bold text-white group-hover:text-wg-green transition-colors duration-200 line-clamp-2 font-sora">
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
            <p className="text-sm text-wg-gray mb-2">{job.department}</p>
          )}

          {/* Empresa / unidade */}
          {config.showCompany && job.company && (
            <p className="flex items-center gap-1 text-xs text-wg-gray mb-2">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              {job.company}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Localização: pin ou globo */}
            {config.showLocation && (
              <span className="flex items-center gap-1.5 text-[14px] text-[#B8B8B8]">
                {hasLocation ? (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-wg-green flex-shrink-0" />
                    {job.city} / {job.state}
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-[#9A9A9A] flex-shrink-0" />
                    Diversas localidades
                  </>
                )}
              </span>
            )}

            {/* Modalidade */}
            {config.showModality && (
              <span className="inline-flex items-center text-[13px] font-semibold px-3.5 py-1 rounded-full"
                style={{
                  background: "rgba(144,203,70,0.16)",
                  border: "1px solid rgba(144,203,70,0.4)",
                  color: "#98DB55",
                }}>
                {MODALITY_LABELS[job.modality]}
              </span>
            )}

            {/* Tipo de contrato */}
            {config.showContractType && (
              <span className="inline-flex items-center text-[13px] font-semibold px-3.5 py-1 rounded-full"
                style={{ background: "#2A2A2A", border: "1px solid #3A3A3A", color: "#E5E5E5" }}>
                {CONTRACT_TYPE_LABELS[job.contractType]}
              </span>
            )}

            {/* Jornada */}
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

        {/* CTA */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-2 text-[14px] font-bold px-6 py-3 rounded-full whitespace-nowrap
            group-hover:shadow-[0_4px_14px_rgba(144,203,70,0.45)]
            transition-all duration-200"
            style={{ background: "#90CB46", color: "#0C0D0C" }}>
            Ver vaga
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
});
