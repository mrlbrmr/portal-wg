"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { createTalentTag } from "@/lib/talentos/actions";
import type { TalentProfileData } from "@/lib/talentos/profile";
import type { TagItem } from "@/lib/talentos/service";

export interface ProfilePayload {
  profile: TalentProfileData;
  currentUserId: string;
  canManage: boolean;
}

/**
 * Perfil do talento via /api/talentos/[id]. `reload` mantém os dados na tela enquanto
 * busca (sem piscar); o carregamento inicial mostra skeleton.
 */
export function useTalentProfile(id: string | null, initial?: ProfilePayload | null) {
  const [data, setData] = useState<ProfilePayload | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial && Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) return;
      const mine = ++seq.current;
      if (!opts.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/talentos/${id}`, { credentials: "same-origin", cache: "no-store" });
        const j = await res.json().catch(() => null);
        if (mine !== seq.current) return;
        if (!res.ok || !j?.profile) {
          setError(res.status === 404 ? "Talento não encontrado." : "Não foi possível carregar o perfil.");
          return;
        }
        setData(j as ProfilePayload);
      } catch {
        if (mine === seq.current) setError("Não foi possível carregar o perfil. Verifique sua conexão.");
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    if (initial && initial.profile.id === id) return;
    setData((d) => (d?.profile.id === id ? d : null));
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { data, loading, error, reload: () => load({ silent: true }), retry: () => load() };
}

/** Lista de tags do cadastro central + criação sem duplicar (Excel = excel). */
export function useTalentTags(initial: TagItem[]) {
  const { notify } = useToast();
  const [tags, setTags] = useState(initial);

  useEffect(() => setTags(initial), [initial]);

  const createTag = useCallback(
    async (name: string): Promise<TagItem | null> => {
      try {
        const r = await createTalentTag(name);
        if (!r.ok) {
          notify("error", r.error);
          return null;
        }
        setTags((list) =>
          list.some((t) => t.id === r.tag.id) ? list : [...list, r.tag].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        );
        if (!r.created) notify("info", `A tag "${r.tag.name}" já existia e foi reaproveitada.`);
        return r.tag;
      } catch {
        notify("error", "Não foi possível criar a tag. Tente novamente.");
        return null;
      }
    },
    [notify]
  );

  return { tags, createTag };
}
