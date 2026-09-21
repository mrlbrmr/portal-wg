"use client";

import { useRef } from "react";
import { Download, Eye, FileText, MoreHorizontal, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Section } from "./Section";

interface Props {
  applicationId: string;
  resumeName: string | null;
  canManage: boolean;
  uploading: boolean;
  onReplace: (file: File) => void;
}

/**
 * Currículo em uma linha: nome + Visualizar (abre em nova aba) + Baixar. Substituir fica
 * no "•••" para não competir com a leitura. Renomear/Excluir não existem na API — não
 * aparecem.
 */
export function ResumeCard({ applicationId, resumeName, canManage, uploading, onReplace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const href = `/api/applications/${applicationId}/resume`;
  const ext = resumeName?.split(".").pop()?.toUpperCase();

  return (
    <Section title="Currículo">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onReplace(file);
          e.target.value = "";
        }}
      />

      {resumeName ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-wg-sidebar text-wg-green-dark">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-wg-ink" title={resumeName}>
                {resumeName}
              </p>
              <p className="text-meta text-wg-ink-muted">
                {uploading ? "Enviando novo arquivo…" : ext ? `Arquivo ${ext}` : "Arquivo anexado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <a href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Eye aria-hidden />
              Visualizar
            </a>
            <a href={`${href}?download=1`} className={buttonVariants({ variant: "tertiary", size: "sm" })}>
              <Download aria-hidden />
              Baixar
            </a>
            {canManage && (
              <DropdownMenu
                ariaLabel="Mais ações do currículo"
                title="Mais ações do currículo"
                disabled={uploading}
                triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                trigger={<MoreHorizontal aria-hidden />}
                items={[{ label: "Substituir arquivo…", icon: Upload, onSelect: () => fileRef.current?.click() }]}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body text-wg-ink-muted">Nenhum currículo anexado.</p>
          {canManage && (
            <Button size="sm" variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
              Anexar currículo
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}
