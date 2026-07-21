"use server";

// Server actions da camada de distribuição — divulgar/retirar uma vaga por
// canal. Escrita = ADMIN_RH (mesma regra das vagas). O trabalho pesado (chamar
// adapters, registrar JobPublication) fica em ./dispatch.

import { revalidatePath } from "next/cache";
import type { DistributionChannel } from "@/types/domain";
import { auth } from "@/lib/auth";
import { publishJobToChannel, removeJobFromChannel } from "./dispatch";

export type DistActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return "Não autenticado.";
  if (session.user.role !== "ADMIN_RH") return "Sem permissão.";
  return null;
}

export async function publishChannelAction(
  jobId: string,
  channel: DistributionChannel
): Promise<DistActionResult> {
  const err = await requireAdmin();
  if (err) return { ok: false, error: err };

  const res = await publishJobToChannel(jobId, channel);
  revalidatePath(`/vagas/${jobId}/editar`);
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Falha ao divulgar." };
}

export async function unpublishChannelAction(
  jobId: string,
  channel: DistributionChannel
): Promise<DistActionResult> {
  const err = await requireAdmin();
  if (err) return { ok: false, error: err };

  await removeJobFromChannel(jobId, channel);
  revalidatePath(`/vagas/${jobId}/editar`);
  return { ok: true };
}
