// Autorização do módulo de Admissões.
//
// No app antigo (Supabase) a autorização era feita por RLS. Aqui é feita em
// app code, a partir da sessão do NextAuth. Fonte única de verdade das regras:
//
//   • Ler admissões ............... qualquer usuário interno autenticado
//   • Operar admissões (criar/editar/checklist/anexos) .. qualquer interno (*)
//   • Configuração (categorias, modelos de checklist) ... apenas ADMIN_RH
//   • Excluir admissão (soft-delete/hard-delete) ........ apenas ADMIN_RH
//
// (*) DECISÃO A REVISAR: hoje o portal só tem ADMIN_RH e VIEWER_RH, e VIEWER_RH
// é "somente leitura" para VAGAS. Optamos por deixar a OPERAÇÃO de admissões
// liberada a qualquer interno (espelha o antigo papel gente_gestao). Se quiser
// que VIEWER_RH seja read-only também aqui, basta trocar canWriteAdmissions()
// para `role === ADMIN_ROLE`. Um papel dedicado pode ser introduzido depois.

import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export const ADMIN_ROLE = "ADMIN_RH";

export function canWriteAdmissions(_role?: string | null): boolean {
  // Qualquer usuário interno autenticado. Ver nota acima sobre VIEWER_RH.
  return true;
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
