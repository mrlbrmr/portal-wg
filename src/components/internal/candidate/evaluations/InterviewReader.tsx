"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download, FileDown, MoreHorizontal, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { formatDate } from "@/lib/utils";
import { interviewTypeLabel } from "@/lib/recruitment/evaluations/catalog";
import { interviewDoc, isReportDoc } from "@/lib/recruitment/evaluations/document";
import { formatDateAtTime, type AssessmentItem } from "../types";
import { RecommendationLabel } from "./RecommendationLabel";
import { ReportDocument } from "./ReportDocument";

interface Props {
  item: AssessmentItem;
  applicationId: string;
  candidateName: string;
  jobTitle?: string | null;
  canManage: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Leitura do parecer, como documento: cabeçalho com quem/qual vaga/tipo/data/autor/
 * recomendação e o conteúdo formatado. Editar é uma ação explícita; "Exportar PDF" usa a
 * impressão do navegador (o banco continua sendo a fonte — o PDF é só uma saída).
 */
export function InterviewReader({ item, applicationId, candidateName, jobTitle, canManage, onBack, onEdit, onDelete }: Props) {
  const doc = useMemo(() => interviewDoc(item), [item]);
  const legacy = !isReportDoc(item.content);
  const [printing, setPrinting] = useState(false);
  const typeLabel = interviewTypeLabel(item.interviewType);
  const title = item.title?.trim() || typeLabel;
  const day = item.occurredAt ? formatDate(item.occurredAt) : null;

  // Imprime só o documento: marca o <html>, deixa o React montar a cópia e chama print().
  useEffect(() => {
    if (!printing) return;
    const root = document.documentElement;
    root.dataset.printingReport = "";
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
      delete root.dataset.printingReport;
    };
  }, [printing]);

  const meta: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Candidato", value: candidateName },
    ...(jobTitle ? [{ label: "Vaga", value: jobTitle }] : []),
    { label: "Entrevista", value: typeLabel },
    { label: "Data", value: day ?? "—" },
    { label: "Entrevistador", value: item.evaluator || item.createdBy || "—" },
    { label: "Recomendação", value: <RecommendationLabel code={item.recommendation} /> },
  ];

  const header = (
    <header>
      <h2 className="font-sora text-[22px] font-semibold leading-tight text-wg-ink">{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {meta.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="text-[11.5px] font-medium uppercase tracking-wide text-wg-ink-muted">{m.label}</dt>
            <dd className="mt-0.5 truncate text-body text-wg-ink">{m.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );

  const authorship = (
    <p className="text-[12px] text-wg-ink-muted">
      Registrado por {item.createdBy ?? "—"} em {formatDateAtTime(item.createdAt)}
      {item.updatedByName && item.updatedAt && ` · Última alteração por ${item.updatedByName} em ${formatDateAtTime(item.updatedAt)}`}
    </p>
  );

  return (
    <article aria-label={`Parecer: ${title}`} className="mx-auto max-w-[760px]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-meta font-medium text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Avaliações
        </button>
        <div className="flex items-center gap-1">
          {canManage && (
            <Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit}>
              Editar
            </Button>
          )}
          <DropdownMenu
            trigger={<MoreHorizontal aria-hidden />}
            triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
            ariaLabel="Mais ações do parecer"
            items={[
              { label: "Exportar PDF", icon: FileDown, onSelect: () => setPrinting(true) },
              ...(canManage ? [{ type: "separator" as const }, { label: "Excluir", icon: Trash2, danger: true, onSelect: onDelete }] : []),
            ]}
          />
        </div>
      </div>

      {header}

      <div className="mt-6 border-t border-wg-border-lighter pt-6">
        {legacy && (
          <p className="mb-4 text-[12px] text-wg-ink-muted">
            Registro anterior ao editor de pareceres
            {item.score !== null && ` · nota registrada na época: ${Math.round(item.score)}/100`}
          </p>
        )}
        {doc.content.length > 0 ? <ReportDocument doc={doc} /> : <p className="text-body text-wg-ink-muted">Sem parecer escrito.</p>}
        {item.attachmentName && (
          <a
            href={`/api/applications/${applicationId}/assessments/${item.id}/file`}
            className="mt-5 inline-flex items-center gap-1.5 text-meta font-medium text-wg-green-dark hover:underline"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {item.attachmentName}
            <Download className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      <footer className="mt-8 border-t border-wg-border-lighter pt-3">{authorship}</footer>

      {printing &&
        createPortal(
          <div data-report-print>
            <p className="mb-4 text-[11px] uppercase tracking-wide text-gray-500">WG Baterias · Parecer de entrevista · Confidencial</p>
            {header}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <ReportDocument doc={doc} />
            </div>
            <div className="mt-8 border-t border-gray-200 pt-3">{authorship}</div>
          </div>,
          document.body
        )}
    </article>
  );
}
