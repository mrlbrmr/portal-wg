"use client";

import { useRef } from "react";
import { Download, Eye, FileText, MoreHorizontal, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

interface Props {
  applicationId: string;
  resumeName: string | null;
  canManage: boolean;
  uploading: boolean;
  onReplace: (file: File) => void;
}

/**
 * Currículo numa linha: "Currículo" em destaque, formato e nome físico como metadado,
 * "Visualizar currículo" como ação principal e Baixar como secundária. Substituir fica no
 * "•••". Número de páginas não é exibido: exigiria baixar e ler o arquivo a cada abertura.
 */
export function ResumeCard({ applicationId, resumeName, canManage, uploading, onReplace }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const href = `/api/applications/${applicationId}/resume`;
  const ext = resumeName?.includes(".") ? resumeName.split(".").pop()?.toUpperCase() : null;

  return (
    <section aria-label="Currículo" className="pt-5 first:pt-0">
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-wg-sidebar text-wg-green-dark">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-wg-ink">Currículo</h3>
            <p className="truncate text-[12px] text-wg-ink-muted" title={resumeName ?? undefined}>
              {uploading
                ? "Enviando novo arquivo…"
                : resumeName
                ? [ext, resumeName].filter(Boolean).join(" · ")
                : "Nenhum currículo anexado."}
            </p>
          </div>
        </div>

        {resumeName ? (
          <div className="flex items-center gap-1">
            <a href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Eye aria-hidden />
              Visualizar currículo
              <span className="sr-only">(abre em nova aba)</span>
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
        ) : (
          canManage && (
            <Button size="sm" variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
              Anexar currículo
            </Button>
          )
        )}
      </div>
    </section>
  );
}
