import Link from "next/link";
import { MapPin, Briefcase, ArrowRight } from "lucide-react";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { Job } from "@prisma/client";

interface Props {
  job: Job;
}

export default function JobCard({ job }: Props) {
  return (
    <Link
      href={`/vagas/${job.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
            {job.title}
          </h3>
          {job.department && (
            <p className="text-sm text-gray-500 mt-0.5">{job.department}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              {job.city} / {job.state}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              {MODALITY_LABELS[job.modality]}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{CONTRACT_TYPE_LABELS[job.contractType]}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-orange-500 text-sm font-medium flex-shrink-0">
          Ver vaga
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
