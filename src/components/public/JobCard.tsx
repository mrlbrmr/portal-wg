import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { Job } from "@prisma/client";

interface Props {
  job: Job;
}

export default function JobCard({ job }: Props) {
  return (
    <Link
      href={`/vagas/${job.id}`}
      className="block bg-wg-card border border-wg-border rounded-2xl p-5
        hover:border-wg-green hover:-translate-y-1
        hover:shadow-[0_8px_32px_rgba(144,203,70,0.13)]
        transition-all duration-200 ease-spring group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white group-hover:text-wg-green transition-colors duration-200 truncate">
            {job.title}
          </h3>
          {job.department && (
            <p className="text-sm text-wg-gray mt-0.5">{job.department}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="flex items-center gap-1 text-xs text-wg-gray">
              <MapPin className="w-3.5 h-3.5 text-wg-green flex-shrink-0" />
              {job.city} / {job.state}
            </span>
            <span className="inline-flex items-center bg-wg-green/10 text-wg-green text-xs font-medium px-2.5 py-0.5 rounded-full">
              {MODALITY_LABELS[job.modality]}
            </span>
            <span className="inline-flex items-center bg-wg-card-2 border border-wg-border text-wg-gray text-xs px-2.5 py-0.5 rounded-full">
              {CONTRACT_TYPE_LABELS[job.contractType]}
            </span>
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
