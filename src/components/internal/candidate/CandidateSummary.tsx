"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APPLICATION_SOURCE_LABELS } from "@/lib/application-schema";
import { DataRow, Missing, Section } from "./Section";
import { candidateLocation, formatDateAtTime, formatPhoneMask, whatsappUrl, type CandidateDetail } from "./types";

const iconAction =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50";

/** Copiar com confirmação no próprio botão ("Copiado") — o toast do painel confirma também. */
function CopyButton({ label, onCopy }: { label: string; onCopy: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await onCopy())) return;
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
      aria-label={copied ? "Copiado" : `Copiar ${label}`}
      title={copied ? "Copiado" : `Copiar ${label}`}
      className={iconAction}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

/** "Contato": e-mail (mailto) e telefone (tel) clicáveis, copiar e WhatsApp quando o número é válido. */
export function CandidateContact({
  data,
  onCopy,
}: {
  data: CandidateDetail;
  onCopy: (label: "E-mail" | "Telefone", value: string) => Promise<boolean>;
}) {
  const phoneDigits = data.phone.replace(/\D/g, "");
  const phone = formatPhoneMask(data.phone);
  const wa = whatsappUrl(data.phone);
  const link = "min-w-0 truncate rounded text-wg-ink underline-offset-2 hover:text-wg-green-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50";

  return (
    <Section title="Contato">
      <dl>
        <DataRow label="E-mail">
          {data.email ? (
            <span className="flex min-w-0 items-center gap-0.5">
              <a href={`mailto:${data.email}`} className={link} title={`Escrever para ${data.email}`}>
                {data.email}
              </a>
              <CopyButton label="e-mail" onCopy={() => onCopy("E-mail", data.email)} />
            </span>
          ) : (
            <Missing />
          )}
        </DataRow>
        <DataRow label="Telefone">
          {phoneDigits ? (
            <span className="flex min-w-0 items-center gap-0.5">
              <a href={`tel:+55${phoneDigits}`} className={link} title={`Ligar para ${phone}`}>
                {phone}
              </a>
              <CopyButton label="telefone" onCopy={() => onCopy("Telefone", phone)} />
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp" title="WhatsApp" className={iconAction}>
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </span>
          ) : (
            <Missing />
          )}
        </DataRow>
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
      <dl>
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
