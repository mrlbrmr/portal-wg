import type { DistributionChannel } from "@prisma/client";

// Resultado de uma tentativa de publicação/divulgação num canal.
export interface PublishResult {
  ok: boolean;
  externalId?: string | null;
  externalUrl?: string | null;
  error?: string;
}

// DTO mínimo da vaga que os adapters recebem — só dados públicos (nada de
// candidato). `url` é a URL pública absoluta da vaga.
export interface JobForDistribution {
  id: string;
  title: string;
  slug: string | null;
  city: string;
  state: string;
  department: string | null;
  company: string | null;
  modality: string;
  contractType: string;
  salaryRange: string | null;
  highlightBenefit: string | null;
  url: string;
}

// Contrato comum de todos os canais. `remove` é opcional (canais passivos e o
// manual não precisam de retirada ativa).
export interface ChannelAdapter {
  channel: DistributionChannel;
  publish(job: JobForDistribution): Promise<PublishResult>;
  remove?(job: JobForDistribution, externalId: string | null): Promise<PublishResult>;
}
