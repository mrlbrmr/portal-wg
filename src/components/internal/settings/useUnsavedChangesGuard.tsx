"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * Impede que o usuário perca alterações não salvas:
 *  • recarregar/fechar a aba → aviso nativo do navegador (beforeunload);
 *  • clicar em um link interno (sidebar, breadcrumb, abas) → confirmação no painel.
 *
 * O App Router não expõe eventos de navegação, então os cliques em <a> são
 * interceptados na fase de captura, antes do next/link agir.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nova aba: nada se perde
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const cancel = useCallback(() => setPendingHref(null), []);
  const confirm = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    dirtyRef.current = false;
    if (href) router.push(href);
  }, [pendingHref, router]);

  const dialog = (
    <ConfirmModal
      isOpen={pendingHref !== null}
      variant="warning"
      title="Sair sem salvar?"
      message="Você tem alterações não salvas nesta página. Se sair agora, elas serão perdidas."
      confirmLabel="Sair sem salvar"
      onConfirm={confirm}
      onCancel={cancel}
    />
  );

  return { dialog };
}
