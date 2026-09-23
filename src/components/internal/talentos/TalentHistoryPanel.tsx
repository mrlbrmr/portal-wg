"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  Flag,
  LogIn,
  Send,
  SlidersHorizontal,
  Tag,
  UserPlus,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";
import { ActivityTimeline, type TimelineEvent } from "@/components/ui/ActivityTimeline";
import { StageBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { buildTalentTimeline, type TalentEventKind } from "@/lib/talentos/timeline";
import type { TalentProfileData } from "@/lib/talentos/profile";

const ICONS: Record<TalentEventKind, ElementType> = {
  JOINED: LogIn,
  CREATED: UserPlus,
  APPLIED: Send,
  ADDED_BY_HR: UserPlus,
  ADDED_FROM_BANK: BriefcaseBusiness,
  STAGE: Flag,
  HIRED: CheckCircle2,
  CLOSED: XCircle,
  ASSESSMENT: ClipboardCheck,
  TAGS: Tag,
  STATUS: SlidersHorizontal,
  ARCHIVED: Archive,
  RESTORED: ArchiveRestore,
  EDITED: FilePen,
};

export const candidateHref = (jobId: string, applicationId: string) => `/vagas/${jobId}/candidatos?candidato=${applicationId}`;

/** Processos seletivos do talento + linha do tempo do relacionamento (somente leitura). */
export function TalentHistoryPanel({ profile }: { profile: TalentProfileData }) {
  const events = useMemo<TimelineEvent[]>(
    () =>
      buildTalentTimeline(profile).map((e) => ({
        id: e.id,
        at: e.at,
        icon: ICONS[e.kind],
        tone: e.tone,
        title: e.title,
        description:
          e.detail || e.actor || e.applicationId ? (
            <span className="flex flex-wrap items-center gap-x-2">
              {e.detail && <span>{e.detail}</span>}
              {e.actor && <span>por {e.actor}</span>}
              {e.applicationId && e.jobId && (e.kind === "APPLIED" || e.kind === "ADDED_BY_HR" || e.kind === "ADDED_FROM_BANK") && (
                <Link href={candidateHref(e.jobId, e.applicationId)} className="font-semibold text-wg-green-dark hover:underline">
                  Abrir candidatura
                </Link>
              )}
            </span>
          ) : undefined,
      })),
    [profile]
  );

  return (
    <div className="space-y-6">
      <section aria-labelledby="th-processos">
        <h3 id="th-processos" className="mb-2 font-inter text-label uppercase tracking-wide text-wg-ink-muted">
          Processos seletivos ({profile.applications.length})
        </h3>
        {profile.applications.length === 0 ? (
          <p className="text-body text-wg-ink-muted">Ainda não participou de processo seletivo.</p>
        ) : (
          <ul className="divide-y divide-wg-border-lighter rounded-card border border-wg-border-lighter bg-white">
            {profile.applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-wg-ink">
                    {a.jobTitle}
                    {a.jobCode && <span className="ml-1.5 text-meta font-normal text-wg-ink-muted">{a.jobCode}</span>}
                  </p>
                  <p className="text-meta text-wg-ink-muted">
                    {a.isOpen ? "Em andamento" : "Encerrado"} · desde {formatDate(a.createdAt)}
                  </p>
                </div>
                <StageBadge color={a.stageColor ?? undefined} hint="Etapa atual da candidatura">
                  {a.stageName}
                </StageBadge>
                <Link href={candidateHref(a.jobId, a.id)} className="shrink-0 text-meta font-semibold text-wg-green-dark hover:underline">
                  Abrir candidatura
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="th-timeline">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="th-timeline" className="font-inter text-label uppercase tracking-wide text-wg-ink-muted">
            Linha do tempo
          </h3>
          <p className="text-[11.5px] text-wg-ink-muted">Registrada automaticamente — não pode ser editada.</p>
        </div>
        <ActivityTimeline events={events} emptyText="Nenhum evento registrado ainda." />
      </section>
    </div>
  );
}
