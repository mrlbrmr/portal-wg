import { prisma } from "@/lib/prisma";
import type { DistributionChannel, PublicationStatus, Prisma } from "@prisma/client";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { ChannelAdapter, JobForDistribution, PublishResult } from "./types";
import { manualAdapter } from "./adapters/manual";

// Registro de adapters. Canais ainda não implementados simplesmente não estão
// aqui — o dispatch trata a ausência como "canal indisponível".
const ADAPTERS: Partial<Record<DistributionChannel, ChannelAdapter>> = {
  MANUAL: manualAdapter,
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br";

export function jobPublicUrl(slugOrId: string): string {
  return `${APP_URL}/vagas/${slugOrId}`;
}

export async function loadJobForDistribution(jobId: string): Promise<JobForDistribution | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      state: true,
      department: true,
      company: true,
      modality: true,
      contractType: true,
      salaryRange: true,
      highlightBenefit: true,
    },
  });
  if (!job) return null;
  return { ...job, url: jobPublicUrl(job.slug ?? job.id) };
}

async function upsertPublication(
  jobId: string,
  channel: DistributionChannel,
  data: Partial<{
    status: PublicationStatus;
    externalId: string | null;
    externalUrl: string | null;
    lastError: string | null;
    postedAt: Date | null;
  }>
) {
  const update: Prisma.JobPublicationUpdateInput = { ...data };
  await prisma.jobPublication.upsert({
    where: { jobId_channel: { jobId, channel } },
    create: {
      jobId,
      channel,
      status: data.status ?? "PENDING",
      externalId: data.externalId ?? null,
      externalUrl: data.externalUrl ?? null,
      lastError: data.lastError ?? null,
      postedAt: data.postedAt ?? null,
    },
    update,
  });
}

/** Publica/divulga a vaga num canal e registra o resultado em JobPublication. */
export async function publishJobToChannel(
  jobId: string,
  channel: DistributionChannel
): Promise<PublishResult> {
  const adapter = ADAPTERS[channel];
  if (!adapter) return { ok: false, error: "Canal ainda não disponível." };

  const job = await loadJobForDistribution(jobId);
  if (!job) return { ok: false, error: "Vaga não encontrada." };

  await upsertPublication(jobId, channel, { status: "PENDING", lastError: null });

  let res: PublishResult;
  try {
    res = await adapter.publish(job);
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : "Falha ao publicar." };
  }

  await upsertPublication(
    jobId,
    channel,
    res.ok
      ? {
          status: "PUBLISHED",
          externalId: res.externalId ?? null,
          externalUrl: res.externalUrl ?? null,
          postedAt: new Date(),
          lastError: null,
        }
      : { status: "FAILED", lastError: res.error ?? "Falha desconhecida." }
  );

  return res;
}

/** Retira a divulgação de um canal (ex.: vaga encerrada) e marca como REMOVED. */
export async function removeJobFromChannel(
  jobId: string,
  channel: DistributionChannel
): Promise<PublishResult> {
  const adapter = ADAPTERS[channel];
  const existing = await prisma.jobPublication.findUnique({
    where: { jobId_channel: { jobId, channel } },
  });

  if (adapter?.remove && existing) {
    const job = await loadJobForDistribution(jobId);
    if (job) {
      try {
        await adapter.remove(job, existing.externalId);
      } catch {
        // Segue marcando como removido no nosso lado mesmo se o canal falhar.
      }
    }
  }

  await upsertPublication(jobId, channel, {
    status: "REMOVED",
    externalUrl: null,
    postedAt: null,
    lastError: null,
  });
  return { ok: true };
}

/** Texto pronto de divulgação (usado no canal manual — copiar e colar). */
export function buildAnnouncementText(job: JobForDistribution): string {
  const lines: string[] = [];
  lines.push(`🚀 Vaga: ${job.title}`);
  const loc = `📍 ${job.city}/${job.state} · ${MODALITY_LABELS[job.modality] ?? job.modality}`;
  lines.push(loc);
  lines.push(`📄 ${CONTRACT_TYPE_LABELS[job.contractType] ?? job.contractType}`);
  if (job.salaryRange) lines.push(`💰 ${job.salaryRange}`);
  if (job.highlightBenefit) lines.push(`✨ ${job.highlightBenefit}`);
  lines.push("");
  lines.push(`Candidate-se: ${job.url}`);
  lines.push("");
  lines.push("#vagas #carreiras #WG");
  return lines.join("\n");
}
