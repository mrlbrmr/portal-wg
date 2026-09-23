"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TagItem } from "@/lib/talentos/service";
import { TalentWorkspace, type TalentTab } from "./TalentWorkspace";
import { useTalentProfile } from "./useTalentData";

interface Props {
  talentId: string | null;
  initialTab?: TalentTab;
  /** Abre já com um diálogo (ex.: "Editar dados" no menu da linha). */
  initialAction?: "edit" | null;
  tags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem | null>;
  onClose: () => void;
  onOpenTalent: (id: string) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Drawer do talento: consulta rápida sem sair da lista. Painel à direita (tela cheia no
 * celular), foco preso dentro, Esc fecha e o foco volta para quem abriu. "Abrir perfil
 * completo" leva à página /talentos/[id], que usa o mesmo conteúdo.
 */
export function TalentDrawer({ talentId, initialTab, initialAction, tags, onCreateTag, onClose, onOpenTalent }: Props) {
  const open = talentId !== null;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  const { data, loading, error, reload, retry } = useTalentProfile(talentId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      // Diálogo aberto por cima (confirmar, adicionar à vaga…): as teclas são dele.
      if (e.defaultPrevented || document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (previous?.isConnected) previous.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const closeButton = (
    <button
      ref={closeRef}
      type="button"
      onClick={onClose}
      aria-label="Fechar perfil"
      className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-control text-wg-ink-muted transition-colors hover:bg-wg-hover-light hover:text-wg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-[#1A2213]/40 animate-fade-in [animation-duration:150ms]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-[760px] flex-col bg-white shadow-[-12px_0_40px_rgba(26,34,19,.18)] animate-panel-in sm:border-l sm:border-wg-border-lighter"
      >
        {data && data.profile.id === talentId ? (
          <TalentWorkspace
            key={data.profile.id}
            profile={data.profile}
            canManage={data.canManage}
            currentUserId={data.currentUserId}
            variant="drawer"
            tags={tags}
            onCreateTag={onCreateTag}
            onRefresh={reload}
            onOpenTalent={onOpenTalent}
            initialTab={initialTab}
            initialDialog={initialAction ?? null}
            titleId={titleId}
            closeButton={closeButton}
          />
        ) : error && !loading ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-wg-border-lighter px-5 py-4">
              <h2 id={titleId} className="font-sora text-lg font-semibold text-wg-ink">
                Perfil do talento
              </h2>
              {closeButton}
            </div>
            <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-body text-wg-ink">{error}</p>
              <Button variant="secondary" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : (
          <DrawerSkeleton titleId={titleId} closeButton={closeButton} />
        )}
      </div>
    </div>,
    document.body
  );
}

function DrawerSkeleton({ titleId, closeButton }: { titleId: string; closeButton: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="border-b border-wg-border-lighter px-5 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <h2 id={titleId} className="sr-only">
              Carregando perfil do talento
            </h2>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          {closeButton}
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="flex-1 space-y-3 bg-wg-bg px-5 py-4">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-44 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </div>
  );
}
