"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Settings2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { JobProcessDialog, type ProcessTemplateOption } from "@/components/internal/funnel/JobProcessDialog";
import type { EditorStage } from "@/components/internal/funnel/ProcessStageEditor";

interface Props {
  jobId: string;
  catalog: EditorStage[];
  currentStageIds: string[];
  isCustom: boolean;
  templateId: string | null;
  templates: ProcessTemplateOption[];
  counts: Record<string, number>;
}

/**
 * Ações de configuração da vaga (processo seletivo, edição) num menu secundário, para não
 * competir com o CTA "Novo candidato".
 */
export function JobPipelineActions({ jobId, ...process }: Props) {
  const [processOpen, setProcessOpen] = useState(false);

  return (
    <>
      <DropdownMenu
        ariaLabel="Mais ações da vaga"
        title="Mais ações"
        trigger={<MoreHorizontal aria-hidden />}
        triggerClassName={buttonVariants({ variant: "secondary", size: "icon" })}
        items={[
          {
            label: "Processo seletivo",
            icon: Settings2,
            hint: process.isCustom ? "personalizado" : undefined,
            onSelect: () => setProcessOpen(true),
          },
          { label: "Editar vaga", icon: Pencil, href: `/vagas/${jobId}/editar` },
        ]}
      />
      <JobProcessDialog open={processOpen} onClose={() => setProcessOpen(false)} jobId={jobId} {...process} />
    </>
  );
}
