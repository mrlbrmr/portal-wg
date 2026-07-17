"use server";

// Server actions de conexão de canais (desconectar). Config = ADMIN_RH.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { clearLinkedInConnection } from "./linkedin";

export type DistActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return "Não autenticado.";
  if (session.user.role !== "ADMIN_RH") return "Sem permissão.";
  return null;
}

export async function disconnectLinkedInAction(): Promise<DistActionResult> {
  const err = await requireAdmin();
  if (err) return { ok: false, error: err };
  await clearLinkedInConnection();
  revalidatePath("/configuracoes/divulgacao");
  return { ok: true };
}
