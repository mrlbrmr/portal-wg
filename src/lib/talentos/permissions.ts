import { auth } from "@/lib/auth";
import type { Session } from "@/lib/auth";

const ADMIN_ROLE  = "ADMIN_RH";
const VIEWER_ROLE = "VIEWER_RH";

export function canReadTalentos(role?: string | null): boolean {
  return role === ADMIN_ROLE || role === VIEWER_ROLE;
}

export function canWriteTalentos(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export function canWriteNotes(role?: string | null): boolean {
  return role === ADMIN_ROLE || role === VIEWER_ROLE;
}

export function canDeleteNotes(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export function canInvalidateSession(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export function canManageTags(role?: string | null): boolean {
  return role === ADMIN_ROLE;
}

export type TalentoAccess =
  | { ok: true; session: Session; role: string; userId: string }
  | { ok: false; status: 401 | 403 };

export async function requireTalentoRead(): Promise<TalentoAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401 };
  if (!canReadTalentos(session.user.role)) return { ok: false, status: 403 };
  return { ok: true, session, role: session.user.role, userId: session.user.id };
}

export async function requireTalentoWrite(): Promise<TalentoAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401 };
  if (!canWriteTalentos(session.user.role)) return { ok: false, status: 403 };
  return { ok: true, session, role: session.user.role, userId: session.user.id };
}
