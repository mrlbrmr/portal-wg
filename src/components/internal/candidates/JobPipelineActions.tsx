"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Settings2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { JobStageConfigButton, type StageOption } from "@/components/internal/JobStageConfigButton";

interface Props {
  jobId: string;
  allStages: StageOption[];
  activeStageIds: string[];
}

/**
 * Ações de configuração da vaga (etapas do funil, edição) num menu secundário, para não
 * competir com o CTA "Novo candidato".
 */
export function JobPipelineActions({ jobId, allStages, activeStageIds }: Props) {
  const [stagesOpen, setStagesOpen] = useState(false);
  const isCustom = activeStageIds.length > 0;

  return (
    <>
      <DropdownMenu
        ariaLabel="Mais ações da vaga"
        title="Mais ações"
        trigger={<MoreHorizontal aria-hidden />}
        triggerClassName={buttonVariants({ variant: "secondary", size: "icon" })}
        items={[
          {
            label: "Configurar etapas",
            icon: Settings2,
            hint: isCustom ? "personalizadas" : undefined,
            onSelect: () => setStagesOpen(true),
          },
          { label: "Editar vaga", icon: Pencil, href: `/vagas/${jobId}/editar` },
        ]}
      />
      <JobStageConfigButton
        jobId={jobId}
        allStages={allStages}
        activeStageIds={activeStageIds}
        open={stagesOpen}
        onOpenChange={setStagesOpen}
      />
    </>
  );
}
