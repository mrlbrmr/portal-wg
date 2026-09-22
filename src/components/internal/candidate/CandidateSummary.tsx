"use client";

import { Copy, Pencil } from "lucide-react";
import { formatExperience } from "@/lib/recruitment/candidate-presentation";
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

/**
 * "Experiência": perfil lido do currículo pela IA (cargo, tempo, formação, competências).
 * Não renderiza nada sem perfil — nunca mostra campos vazios de exemplo.
 */
export function CandidateExperience({ data }: { data: CandidateDetail }) {
  const p = data.cv_profile;
  const experience = formatExperience(p?.experienceYears);
  const skills = (p?.skills ?? []).filter((s) => typeof s === "string" && s.trim());
  if (!p || (!p.lastPosition && !experience && !p.education && skills.length === 0)) return null;

  return (
    <Section title="Experiência">
      <dl className="divide-y divide-wg-border-lighter/70">
        {p.lastPosition && <DataRow label="Cargo mais recente">{p.lastPosition}</DataRow>}
        {experience && <DataRow label="Tempo de experiência">{experience.replace(" de exp.", "")}</DataRow>}
        {p.education && <DataRow label="Formação">{p.education}</DataRow>}
      </dl>
      {skills.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Competências">
          {skills.map((s) => (
            <li key={s} className="rounded-md bg-neutral-bg px-2 py-0.5 text-[12px] text-neutral-fg">
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11.5px] text-wg-ink-muted">Extraído automaticamente do currículo — confira no arquivo.</p>
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
