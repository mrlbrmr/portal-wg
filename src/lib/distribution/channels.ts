import type { DistributionChannel } from "@prisma/client";

// Metadados dos canais de divulgação. `implemented` vira true quando a fase do
// respectivo canal entra no ar (ver plano [[distribuicao-vagas]]):
//   Fase 0 → MANUAL · Fase 1 → GOOGLE_JOBS · Fase 2 → INDEED
//   Fase 3 → LINKEDIN_PAGE · Fase 4 → LINKEDIN_NATIVE
// Client-safe (sem imports de servidor) para uso também no painel.

export type ChannelKind = "manual" | "feed" | "api";

export interface ChannelMeta {
  channel: DistributionChannel;
  label: string;
  description: string;
  kind: ChannelKind;
  implemented: boolean;
}

export const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
  manual: "Manual",
  feed: "Feed",
  api: "API",
};

export const CHANNELS: ChannelMeta[] = [
  {
    channel: "MANUAL",
    label: "Divulgação manual",
    description: "Texto pronto + link público para colar onde quiser (WhatsApp, grupos, etc.).",
    kind: "manual",
    implemented: true,
  },
  {
    channel: "GOOGLE_JOBS",
    label: "Google for Jobs",
    description: "Aparece na busca do Google via dados estruturados. Automático quando a vaga está pública.",
    kind: "feed",
    implemented: true,
  },
  {
    channel: "INDEED",
    label: "Indeed",
    description: "Listagem orgânica via feed XML. Automático quando a vaga está pública.",
    kind: "feed",
    implemented: true,
  },
  {
    channel: "LINKEDIN_PAGE",
    label: "LinkedIn — página",
    description: "Post na página da empresa com o link da vaga. Requer conexão em Configurações → Divulgação.",
    kind: "api",
    implemented: true,
  },
  {
    channel: "LINKEDIN_NATIVE",
    label: "LinkedIn Jobs (nativo)",
    description: "Listagem nativa no LinkedIn Jobs. Depende de parceria com o LinkedIn.",
    kind: "api",
    implemented: false,
  },
];

export function getChannelMeta(channel: DistributionChannel): ChannelMeta | undefined {
  return CHANNELS.find((c) => c.channel === channel);
}
