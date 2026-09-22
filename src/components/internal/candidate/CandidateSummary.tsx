"use client";

import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { DataRow, Missing, Section } from "./Section";
import { candidateLocation, formatDateAtTime, formatPhoneMask, type CandidateDetail } from "./types";

/** "Contato": valor clicável (mailto/tel) + copiar com rótulo acessível. */
export function CandidateContact({
  data,
  onCopy,
}: {
  data: CandidateDetail;
  onCopy: (label: "E-mail" | "Telefone", value: string) => void;
}) {
  const phoneDigits = data.phone.replace(/\D/g, "");
  const rows: Array<{ label: "E-mail" | "Telefone"; display: string; href: string; copy: string } | null> = [
    data.email ? { label: "E-mail", display: data.email, href: `mailto:${data.email}`, copy: data.email } : null,
    phoneDigits
      ? { label: "Telefone", display: formatPhoneMask(data.phone), href: `tel:+55${phoneDigits}`, copy: formatPhoneMask(data.phone) }
      : null,
  ];

  return (
    <Section title="Contato">
      <dl className="divide-y divide-wg-border-lighter/70">
        {rows.map((r, i) =>
          r ? (
            <DataRow key={r.label} label={r.label}>
              <span className="flex min-w-0 items-center gap-1">
                <a href={r.href} className="min-w-0 truncate text-wg-ink underline-offset-2 hover:text-wg-green-dark hover:underline">
                  {r.display}
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(r.label, r.copy)}
                  aria-label={`Copiar ${r.label.toLowerCase()}`}
                  title={`Copiar ${r.label.toLowerCase()}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </DataRow>
          ) : (
            <DataRow key={i} label={i === 0 ? "E-mail" : "Telefone"}>
              <Missing />
            </DataRow>
          )
        )}
      </dl>
    </Section>
  );
}

/** "Detalhes da candidatura": dados administrativos, em grade compacta. */
export function ApplicationDetails({
  data,
  canManage,
  onEdit,
}: {
  data: CandidateDetail;
  canManage: boolean;
  onEdit: () => void;
}) {
  const location = candidateLocation(data);
  const source = APPLICATION_SOURCE_LABELS[data.source] ?? data.source;

  return (
    <Section
      title="Detalhes da candidatura"
      action={
        canManage && (
          <Button size="sm" variant="tertiary" icon={Pencil} onClick={onEdit}>
            Editar dados
          </Button>
        )
      }
    >
      <dl className="divide-y divide-wg-border-lighter/70">
        <DataRow label="Localização">{location ?? <Missing />}</DataRow>
        <DataRow label="Origem">
          {source}
          {data.addedBy && <span className="text-wg-ink-muted"> · cadastrado por {data.addedBy}</span>}
        </DataRow>
        <DataRow label="Candidatura">
          <span className="tabular-nums">{formatDateAtTime(data.createdAt)}</span>
        </DataRow>
        <DataRow label="País">{data.country ?? <Missing />}</DataRow>
      </dl>
    </Section>
  );
}
