"use client";

import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { DataRow, Section } from "./Section";
import {
  candidateLocation,
  formatCurrencyBRL,
  formatDateAtTime,
  formatPhoneMask,
  type CandidateDetail,
} from "./types";

/** "Dados da candidatura": linhas compactas, só com o que foi informado. */
export function ApplicationData({
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
      title="Dados da candidatura"
      action={
        canManage && (
          <Button size="sm" variant="tertiary" icon={Pencil} onClick={onEdit}>
            Editar dados
          </Button>
        )
      }
    >
      <dl className="divide-y divide-wg-border-lighter/70">
        {location && <DataRow label="Localização">{location}</DataRow>}
        {data.salaryExpectation !== null && (
          <DataRow label="Pretensão salarial">
            <span className="tabular-nums">{formatCurrencyBRL(data.salaryExpectation)}</span>
          </DataRow>
        )}
        {data.availablePresential !== null && (
          <DataRow label="Trabalho presencial">{data.availablePresential ? "Disponível" : "Não disponível"}</DataRow>
        )}
        <DataRow label="Origem">
          {source}
          {data.addedBy && <span className="text-wg-ink-muted"> · cadastrado por {data.addedBy}</span>}
        </DataRow>
        <DataRow label="Candidatura">
          <span className="tabular-nums">{formatDateAtTime(data.createdAt)}</span>
        </DataRow>
        {data.country && <DataRow label="País">{data.country}</DataRow>}
      </dl>
    </Section>
  );
}

/** "Contato": valor clicável (mailto/tel) + copiar com rótulo acessível. */
export function CandidateContact({
  data,
  onCopy,
}: {
  data: CandidateDetail;
  onCopy: (label: "E-mail" | "Telefone", value: string) => void;
}) {
  const phoneDigits = data.phone.replace(/\D/g, "");
  const rows = [
    data.email && {
      label: "E-mail" as const,
      display: data.email,
      href: `mailto:${data.email}`,
      copy: data.email,
    },
    phoneDigits && {
      label: "Telefone" as const,
      display: formatPhoneMask(data.phone),
      href: `tel:+55${phoneDigits}`,
      copy: formatPhoneMask(data.phone),
    },
  ].filter(Boolean) as Array<{ label: "E-mail" | "Telefone"; display: string; href: string; copy: string }>;

  return (
    <Section title="Contato">
      {rows.length === 0 ? (
        <p className="text-body text-wg-ink-muted">Nenhum contato informado.</p>
      ) : (
        <dl className="divide-y divide-wg-border-lighter/70">
          {rows.map((r) => (
            <DataRow key={r.label} label={r.label}>
              <span className="flex items-center gap-1">
                <a
                  href={r.href}
                  className="min-w-0 truncate text-wg-ink underline-offset-2 hover:text-wg-green-dark hover:underline"
                >
                  {r.display}
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(r.label, r.copy)}
                  aria-label={`Copiar ${r.label.toLowerCase()}`}
                  title={`Copiar ${r.label.toLowerCase()}`}
                  className="shrink-0 rounded-control p-1 text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </DataRow>
          ))}
        </dl>
      )}
    </Section>
  );
}
