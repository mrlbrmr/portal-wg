"use server";

import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadActivityPage, parseActivityFilters, type ActivityCursor, type ActivityItem } from "@/lib/activity/feed";

const TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const ROW_ID = /^[a-z]{3}-[\w-]{1,64}$/;

/** Próxima página da timeline de Atividades (mesmos filtros da URL). Leitura: qualquer usuário interno. */
export async function loadMoreActivities(
  params: Record<string, string>,
  cursor: ActivityCursor
): Promise<{ ok: true; items: ActivityItem[]; nextCursor: ActivityCursor | null } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!cursor || typeof cursor.before !== "string" || !TS.test(cursor.before) || !Array.isArray(cursor.skip)) {
    return { ok: false, error: "Não foi possível continuar a lista." };
  }
  const safeCursor: ActivityCursor = {
    before: cursor.before,
    skip: cursor.skip.filter((s) => typeof s === "string" && ROW_ID.test(s)).slice(0, 200),
  };
  try {
    const supabase = await createClient();
    const page = await loadActivityPage(supabase, parseActivityFilters(params), safeCursor);
    return { ok: true, ...page };
  } catch (e) {
    console.error("[atividades] loadMore", e);
    return { ok: false, error: "Não foi possível carregar mais atividades. Tente novamente." };
  }
}
