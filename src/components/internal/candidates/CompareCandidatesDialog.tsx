"use client";

import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { StageBadge } from "@/components/ui/StatusBadge";
import { DialogShell } from "@/components/internal/candidate/DialogShell";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import {
  formatCandidateLocation,
  formatDaysShort,
  formatExperience,
  relativeDay,
  type CandidateSignal,
} from "@/lib/recruitment/candidate-presentation";
import { CandidateAvatar } from "./CandidateAvatar";
import { MatchScore } from "./MatchScore";
import { CandidateSignalBadges } from "./CandidateSignalBadges";
import type { PipelineCandidate, PipelineStage } from "./types";

export interface CompareEntry {
  candidate: PipelineCandidate;
  score: number | undefined;
  signals: CandidateSignal[];
}

interface Props {
  open: boolean;
  entries: CompareEntry[];
  stageById: Map<string, PipelineStage>;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Comparação lado a lado dos candidatos selecionados, só com dados que já estão no
 * pipeline (sem nova consulta): etapa, aderência, tempo no processo, perfil do currículo.
 */
export function CompareCandidatesDialog({ open, entries, stageById, onClose, onOpen, onRemove }: Props) {
  const rows: Array<{ label: string; render: (e: CompareEntry) => ReactNode }> = [
    {
      label: "Etapa",
      render: ({ candidate: c }) => {
        const s = stageById.get(c.stageId);
        return s ? <StageBadge color={s.color}>{s.name}</StageBadge> : <Empty />;
      },
    },
    {
      label: "Aderência ao perfil",
      render: ({ score }) => (score !== undefined ? <MatchScore score={score} variant="inline" /> : <Empty>Não calculada</Empty>),
    },
    { label: "Candidatura", render: ({ candidate: c }) => cap(relativeDay(c.createdAt)) },
    {
      label: "Tempo na etapa",
      render: ({ candidate: c }) => (c.enteredStageAt ? cap(formatDaysShort(c.enteredStageAt)) : <Empty />),
    },
    { label: "Localização", render: ({ candidate: c }) => formatCandidateLocation(c.city, c.state) ?? <Empty /> },
    { label: "Cargo mais recente", render: ({ candidate: c }) => c.lastPosition ?? <Empty /> },
    { label: "Experiência", render: ({ candidate: c }) => formatExperience(c.experienceYears) ?? <Empty /> },
    { label: "Formação", render: ({ candidate: c }) => c.education ?? <Empty /> },
    {
      label: "Competências",
      render: ({ candidate: c }) =>
        c.skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {c.skills.slice(0, 6).map((s) => (
              <li key={s} className="rounded-md bg-neutral-bg px-1.5 py-0.5 text-[11.5px] text-neutral-fg">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        ),
    },
    { label: "Origem", render: ({ candidate: c }) => APPLICATION_SOURCE_LABELS[c.source] ?? c.source },
    {
      label: "Avaliações",
      render: ({ candidate: c }) =>
        c.assessmentCount > 0 ? `${c.assessmentCount} ${c.assessmentCount === 1 ? "registrada" : "registradas"}` : <Empty>Nenhuma</Empty>,
    },
    {
      label: "Sinais",
      render: ({ signals }) => (signals.length > 0 ? <CandidateSignalBadges signals={signals} max={3} /> : <Empty />),
    },
    {
      label: "Currículo",
      render: ({ candidate: c }) =>
        c.resumeName ? (
          <a
            href={`/api/applications/${c.id}/resume`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-wg-green-dark hover:underline"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Abrir
          </a>
        ) : (
          <Empty>Sem currículo</Empty>
        ),
    },
  ];

  return (
    <DialogShell
      open={open}
      size="wide"
      title={`Comparar ${entries.length} candidatos`}
      description="Dados do pipeline lado a lado. A aderência é um apoio à triagem, não uma classificação."
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-[13px]">
          <colgroup>
            <col className="w-[150px]" />
            {entries.map((e) => (
              <col key={e.candidate.id} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="pb-3 align-bottom">
                <span className="sr-only">Atributo</span>
              </th>
              {entries.map(({ candidate: c }) => (
                <th key={c.id} scope="col" className="px-3 pb-3 align-top font-normal">
                  <div className="flex items-start gap-2">
                    <CandidateAvatar name={c.fullName} seed={c.id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-wg-ink" title={c.fullName}>
                        {c.fullName}
                      </p>
                      <div className="mt-0.5 flex gap-2 text-[12px]">
                        <button type="button" onClick={() => onOpen(c.id)} className="font-medium text-wg-green-dark hover:underline">
                          Abrir ficha
                        </button>
                        {entries.length > 2 && (
                          <button type="button" onClick={() => onRemove(c.id)} className="text-wg-ink-muted hover:text-wg-ink hover:underline">
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-wg-border-lighter">
                <th scope="row" className="py-2.5 pr-3 align-top text-[12px] font-medium text-wg-ink-muted">
                  {row.label}
                </th>
                {entries.map((e) => (
                  <td key={e.candidate.id} className="break-words px-3 py-2.5 align-top text-wg-ink-secondary">
                    {row.render(e)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DialogShell>
  );
}

function Empty({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-wg-ink-muted/70">{children}</span>;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
