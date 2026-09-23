// Registro simples de alterações das Configurações (tabela config_change_log).
//
// Não é versionamento: guarda quem alterou, quando e em qual módulo, para mostrar
// "Última alteração" no cabeçalho de cada página. Falha no log NUNCA impede o
// salvamento — a configuração é o que importa; o log é informativo.

import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth";

export interface ConfigChange {
  actorName: string;
  summary: string;
  createdAt: string;
}

export async function logConfigChange(
  session: Session,
  module: string,
  summary: string
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("config_change_log").insert({
      module,
      summary: summary.slice(0, 300),
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Usuário",
    });
    if (error) console.warn("[config-change-log]", module, error.message);
  } catch (e) {
    console.warn("[config-change-log]", module, e);
  }
}

/**
 * Última alteração de um módulo. Com `prefix`, considera também os submódulos
 * (ex.: "cadastros" cobre "cadastros.cargos", "cadastros.tags"…).
 */
export async function getLastConfigChange(
  module: string,
  { prefix = false }: { prefix?: boolean } = {}
): Promise<ConfigChange | null> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("config_change_log")
      .select("actorName, summary, createdAt")
      .order("createdAt", { ascending: false })
      .limit(1);
    query = prefix ? query.like("module", `${module}%`) : query.eq("module", module);
    const { data } = await query.maybeSingle();
    return (data as ConfigChange | null) ?? null;
  } catch {
    return null;
  }
}
