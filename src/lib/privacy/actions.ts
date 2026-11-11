"use server";

// Server actions de privacidade (LGPD) — só ADMIN_RH. Casca fina sobre retention-service.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logConfigChange } from "@/lib/settings/audit";
import { requireTalentoWrite } from "@/lib/talentos/permissions";
import { normalizeRetentionMonths } from "./retention";
import { anonymizeTalent, getRetentionMonths, setRetentionHold } from "./retention-service";

export type PrivacyResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function admin() {
  const a = await requireTalentoWrite();
  if (!a.ok) {
    return { ok: false as const, error: a.status === 401 ? "Sessão expirada. Entre novamente." : "Apenas o RH administrador pode fazer isso." };
  }
  return {
    ok: true as const,
    session: a.session,
    actor: { id: a.userId, name: a.session.user.name ?? a.session.user.email ?? "Equipe de RH" },
  };
}

export async function saveRetentionMonthsAction(months: number): Promise<PrivacyResult<{ months: number }>> {
  const a = await admin();
  if (!a.ok) return { ok: false, error: a.error };
  const value = normalizeRetentionMonths(months);
  const supabase = await createClient();
  const { error } = await supabase
    .from("retention_settings")
    .update({ months: value, updatedAt: new Date().toISOString(), updatedByName: a.actor.name })
    .eq("id", 1);
  if (error) return { ok: false, error: "Não foi possível salvar o prazo." };
  await logConfigChange(a.session, "privacidade", `Prazo de retenção: ${value} meses`);
  revalidatePath("/configuracoes/privacidade");
  return { ok: true, months: value };
}

const idsSchema = z.array(z.string().min(1).max(64)).min(1).max(200);

/** Anonimiza em lote os talentos escolhidos pelo RH. Cada um é reavaliado no servidor. */
export async function anonymizeTalentsAction(
  ids: string[]
): Promise<PrivacyResult<{ done: number; failed: number; skipped: number }>> {
  const a = await admin();
  if (!a.ok) return { ok: false, error: a.error };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Seleção inválida." };

  const client = createAdminClient();
  const months = await getRetentionMonths(client);
  let done = 0, failed = 0, skipped = 0;
  for (const id of parsed.data) {
    const r = await anonymizeTalent(client, id, a.actor, { months, reason: "RETENCAO" });
    if (r.ok) done++;
    else if (r.code === "NAO_ELEGIVEL") skipped++;
    else failed++;
  }
  revalidatePath("/configuracoes/privacidade");
  revalidatePath("/talentos");
  return { ok: true, done, failed, skipped };
}

/** Pedido do titular: anonimiza já, sem esperar o prazo (nunca com processo aberto/contratação/bloqueio). */
export async function anonymizeOnRequestAction(id: string): Promise<PrivacyResult> {
  const a = await admin();
  if (!a.ok) return { ok: false, error: a.error };
  const client = createAdminClient();
  const months = await getRetentionMonths(client);
  const r = await anonymizeTalent(client, id, a.actor, { months, force: true, reason: "PEDIDO_TITULAR" });
  if (!r.ok) return { ok: false, error: r.message };
  revalidatePath(`/talentos/${id}`);
  revalidatePath("/talentos");
  return { ok: true };
}

export async function setRetentionHoldAction(id: string, motivo: string | null): Promise<PrivacyResult> {
  const a = await admin();
  if (!a.ok) return { ok: false, error: a.error };
  const text = motivo?.trim() ?? "";
  if (motivo !== null && text.length < 5) return { ok: false, error: "Informe o motivo do bloqueio (mín. 5 caracteres)." };
  const r = await setRetentionHold(createAdminClient(), id, a.actor, motivo === null ? null : { motivo: text });
  if (!r.ok) return { ok: false, error: r.message };
  revalidatePath(`/talentos/${id}`);
  revalidatePath("/configuracoes/privacidade");
  return { ok: true };
}
