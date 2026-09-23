"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { TagItem } from "@/lib/talentos/service";
import { TalentWorkspace } from "./TalentWorkspace";
import { useTalentProfile, useTalentTags, type ProfilePayload } from "./useTalentData";

/** Página completa do talento: mesmo workspace do drawer, em layout de página. */
export function TalentProfileView({ initial, tags: initialTags }: { initial: ProfilePayload; tags: TagItem[] }) {
  const router = useRouter();
  const { data, reload } = useTalentProfile(initial.profile.id, initial);
  const { tags, createTag } = useTalentTags(initialTags);
  const payload = data ?? initial;

  return (
    <div>
      <Link
        href="/talentos"
        className="mb-4 inline-flex items-center gap-1 rounded text-meta font-medium text-wg-ink-muted hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Banco de Talentos
      </Link>
      <div className="overflow-hidden rounded-card border border-wg-border-lighter bg-white">
        <TalentWorkspace
          profile={payload.profile}
          canManage={payload.canManage}
          currentUserId={payload.currentUserId}
          variant="page"
          tags={tags}
          onCreateTag={createTag}
          onRefresh={reload}
          onOpenTalent={(id) => router.push(`/talentos/${id}`)}
        />
      </div>
    </div>
  );
}
