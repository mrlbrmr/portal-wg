"use client";

import Link from "next/link";
import { ChevronLeft, MoreHorizontal, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { StageBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { initialsOf } from "@/components/ui/UserAvatar";
import { formatDateBR } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";

interface Props {
  menu: DropdownMenuItem[];
  /** "Editar dados" — abre a edição das seções. Ausente = sem permissão ou já editando. */
  onEdit?: () => void;
}

/** Quem é, para onde vai, em que etapa está, quando começa e quem conduz. */
export function AdmissionHeader({ menu, onEdit }: Props) {
  const { data } = useAdmissionWorkspace();
  const { record: r, saved: s } = data;
  const placement = [s.positionName ?? "Cargo não definido", s.companyName, s.branchName].filter(Boolean).join(" · ");

  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/admissoes"
        className="-ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 py-0.5 text-meta font-medium text-wg-ink-muted transition-colors hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Admissões
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            aria-hidden
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-card bg-wg-border-light font-sora text-[17px] font-semibold text-[#2E4319] sm:flex"
          >
            {initialsOf(r.fullName)}
          </div>
          <div className="min-w-0">
            <h1 className="break-words font-sora text-xl font-semibold tracking-tight text-wg-ink md:text-page-title">{r.fullName}</h1>
            <p className="mt-0.5 text-body text-wg-ink-secondary">{placement}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-wg-ink-muted">
              {s.stageName ? (
                <StageBadge color={s.stageColor ?? undefined} hint="Etapa atual">
                  {s.stageName}
                </StageBadge>
              ) : (
                <StageBadge>Sem etapa</StageBadge>
              )}
              {s.stageIsFinal && <StatusBadge tone="success">Concluída</StatusBadge>}
              <span>
                Início: <span className="font-medium tabular-nums text-wg-ink">{formatDateBR(r.startDate) ?? "a definir"}</span>
              </span>
              <span>
                Responsável: <span className="font-medium text-wg-ink">{s.responsibleName ?? "não definido"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onEdit && (
            <Button variant="secondary" icon={Pencil} onClick={onEdit}>
              Editar dados
            </Button>
          )}
          {menu.length > 0 && (
            <DropdownMenu
              trigger={<MoreHorizontal aria-hidden />}
              ariaLabel="Mais ações da admissão"
              title="Mais ações"
              triggerClassName={buttonVariants({ variant: "secondary", size: "icon" })}
              items={menu}
              align="right"
            />
          )}
        </div>
      </div>
    </header>
  );
}
