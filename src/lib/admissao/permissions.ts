// Autorização do módulo de Admissões.
//
// No app antigo (Supabase) a autorização era feita por RLS. Aqui é feita em
// app code, a partir da sessão do NextAuth. Fonte única de verdade das regras:
//
//   • Ler admissões ............... qualquer usuário interno autenticado
//   • Operar admissões (criar/editar/checklist/anexos) .. apenas ADMIN_RH
//   • Configuração (categorias, modelos de checklist) ... apenas ADMIN_RH
//   • Excluir admissão (soft-delete/hard-delete) ........ apenas ADMIN_RH
//
// VIEWER_RH é "somente leitura" — coerente com o comportamento nas VAGAS.
// Só ADMIN_RH escreve. Se no futuro houver um papel operacional dedicado
// (equivalente ao antigo gente_gestao), ampliar canWriteAdmissions() aqui.

import { auth } from "@/lib/auth";
import type { Session } from "@/lib/auth";

export const ADMIN_ROLE = "ADMIN_RH";

export function canWriteAdmissions(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export function canManageAdmissionConfig(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export function canDeleteAdmission(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

// ─── Guardas para route handlers / server actions ─────────────────────────────

export type AdmissionAccess =
  | { ok: true; session: Session; role: string; userId: string }
  | { ok: false; status: 401 | 403 };

/** Exige sessão interna autenticada (qualquer role). */
export async function requireAdmissionSession(): Promise<AdmissionAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401 };
  return { ok: true, session, role: session.user.role, userId: session.user.id };
}

/** Exige permissão de escrita (operação de admissões). */
export async function requireAdmissionWrite(): Promise<AdmissionAccess> {
  const res = await requireAdmissionSession();
  if (!res.ok) return res;
  if (!canWriteAdmissions(res.role)) return { ok: false, status: 403 };
  return res;
}

/** Exige permissão de configuração/exclusão (ADMIN_RH). */
export async function requireAdmissionConfig(): Promise<AdmissionAccess> {
  const res = await requireAdmissionSession();
  if (!res.ok) return res;
  if (!canManageAdmissionConfig(res.role)) return { ok: false, status: 403 };
  return res;
}
