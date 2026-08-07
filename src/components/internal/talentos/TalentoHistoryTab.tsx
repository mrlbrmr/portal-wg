"use client";

import Link from "next/link";
import { Briefcase, MapPin, Tag } from "lucide-react";
import type { CandidaturaHistorico } from "@/lib/talentos/types";

interface Props {
  candidaturas: CandidaturaHistorico[];
}

const KIND_LABELS: Record<string, string> = {
  APPLIED:    "Inscrito",
  SCREENING:  "Triagem",
  INTERVIEW:  "Entrevista",
  ASSESSMENT: "Avaliação",
  OFFER:      "Proposta",
  HIRED:      "Contratado",
  REJECTED:   "Recusado",
  WITHDRAWN:  "Desistiu",
};

export default function TalentoHistoryTab({ candidaturas }: Props) {
  if (candidaturas.length === 0) {
    return (
      <div className="py-12 text-center text-wg-ink-muted text-sm">
        Nenhuma candidatura registrada para este talento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {candidaturas.map((c) => (
        <div key={c.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-wg-green/10 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-wg-green-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/vagas/${c.jobId}/candidatos`}
              className="font-semibold text-wg-ink hover:text-wg-green transition-colors text-sm"
            >
              {c.jobTitle}
            </Link>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {c.jobCity && (
                <span className="flex items-center gap-1 text-[11px] text-wg-ink-muted">
                  <MapPin className="w-3 h-3" />
                  {c.jobCity}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-wg-ink-muted">
                <Tag className="w-3 h-3" />
                {KIND_LABELS[c.stageKind] ?? c.stageName}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-wg-ink-muted shrink-0">
            {new Date(c.createdAt).toLocaleDateString("pt-BR")}
          </div>
        </div>
      ))}
    </div>
  );
}
