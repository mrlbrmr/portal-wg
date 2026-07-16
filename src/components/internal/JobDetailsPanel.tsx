"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { sanitizeRichText } from "@/lib/sanitize";
import { CONTRACT_TYPE_LABELS, formatDate } from "@/lib/utils";

interface JobDetail {
  description: string;
  responsibilities: string;
  requiredRequirements: string;
  desiredRequirements: string | null;
  benefits: string | null;
  salaryRange: string | null;
  workSchedule: string | null;
  openings: number | null;
  company: string | null;
  contractType: string;
  closingDate: string | null;
  hiringDeadline: string | null;
}

/**
 * Detalhes expandidos de uma vaga na lista. Busca sob demanda em
 * GET /api/jobs/[id] (só monta quando o card é expandido), evitando carregar
 * os campos Text pesados de todas as vagas no payload inicial. Mostra um
 * skeleton enquanto carrega e reusa o mesmo render rich-text do portal.
 */
export function JobDetailsPanel({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    fetch(`/api/jobs/${jobId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  if (error) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-red-600">
        Não foi possível carregar os detalhes da vaga.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-28" />
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const facts: { label: string; value: string }[] = [
    { label: "Contrato", value: CONTRACT_TYPE_LABELS[data.contractType] ?? data.contractType },
    ...(data.salaryRange ? [{ label: "Salário", value: data.salaryRange }] : []),
    ...(data.openings ? [{ label: "Vagas", value: String(data.openings) }] : []),
    ...(data.workSchedule ? [{ label: "Horário", value: data.workSchedule }] : []),
    ...(data.company ? [{ label: "Empresa", value: data.company }] : []),
    ...(data.hiringDeadline
      ? [{ label: "Prazo p/ contratar", value: formatDate(data.hiringDeadline) }]
      : []),
    ...(data.closingDate
      ? [{ label: "Encerramento", value: formatDate(data.closingDate) }]
      : []),
  ];

  const sections = [
    { title: "Sobre a vaga", content: data.description },
    { title: "Responsabilidades", content: data.responsibilities },
    { title: "Requisitos obrigatórios", content: data.requiredRequirements },
    ...(data.desiredRequirements
      ? [{ title: "Requisitos desejáveis", content: data.desiredRequirements }]
      : []),
    ...(data.benefits ? [{ title: "Benefícios", content: data.benefits }] : []),
  ];

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {/* Fatos rápidos */}
      <div className="mb-4 flex flex-wrap gap-2">
        {facts.map((f) => (
          <span
            key={f.label}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-gray-500">{f.label}:</span>
            <span className="text-gray-800">{f.value}</span>
          </span>
        ))}
      </div>

      {/* Seções rich-text */}
      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.title}>
            <h3 className="mb-1.5 text-sm font-semibold text-gray-900">{s.title}</h3>
            <div
              className="rich-text text-sm leading-relaxed text-gray-600"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(s.content) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
