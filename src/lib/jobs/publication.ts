// Publicação da vaga — módulo PURO e client-safe. Única fonte da regra
//
//   aparece num canal  ⇔  processo apto (status aberto)
//                         + canal habilitado pela publicação (jobs.visibility)
//                         + inscrições no prazo (closingDate), quando houver.
//
// Status e publicação são dimensões DIFERENTES: uma vaga pode estar Aberta e propositalmente
// "Não publicar" (NONE) — o processo segue no painel (candidatos, pipeline, posições), mas
// ela não aparece no Portal, na Intranet, na página pelo link, no sitemap, nos feeds
// (Google/Indeed) nem na API pública.
//
// Consultas ao banco usam os helpers de src/lib/jobs-query.ts, que leem as listas abaixo; a
// RLS pública (jobs_public_select) repete a exclusão de NONE como defesa em profundidade.

import { PUBLIC_JOB_STATUSES, isPublicJobStatus } from "@/lib/utils";
import type { JobVisibility } from "@/types/domain";

export type PublicationMode = JobVisibility;

/** Canais em que uma vaga pode aparecer. */
export type PublicationChannel =
  /** Lista do Portal de Carreiras (home), sitemap e busca. */
  | "PORTAL"
  /** Vagas Internas da Intranet WG Conecta (GET /api/intranet/jobs). */
  | "INTRANET"
  /** Integrações externas: feeds Google for Jobs / Indeed, JSON-LD, LinkedIn. */
  | "EXTERNAL"
  /** Página /vagas/[slug] pelo link direto (é nela que se envia a candidatura). */
  | "LINK";

export const PUBLICATION_MODES: readonly PublicationMode[] = ["NONE", "BOTH", "PUBLIC", "INTERNAL"];

/** Opções da tela "Onde esta vaga deve ser exibida?" (na ordem exibida). */
export const PUBLICATION_OPTIONS: ReadonlyArray<{ value: PublicationMode; label: string; description: string }> = [
  {
    value: "NONE",
    label: "Não publicar",
    description: "Somente o RH verá esta vaga no painel. Não aparece no Portal de Carreiras, Intranet, Google ou Indeed.",
  },
  {
    value: "BOTH",
    label: "Portal de Carreiras + Intranet",
    description: "Aparece para candidatos externos e para colaboradores em Vagas Internas.",
  },
  {
    value: "PUBLIC",
    label: "Somente Portal de Carreiras",
    description: "Visível para candidatos externos. Não aparece na Intranet.",
  },
  {
    value: "INTERNAL",
    label: "Somente Intranet",
    description: "Somente colaboradores veem. Não aparece no Portal de Carreiras nem em integrações externas.",
  },
];

export const PUBLICATION_LABELS: Record<string, string> = Object.fromEntries(
  PUBLICATION_OPTIONS.map((o) => [o.value, o.label])
);

const CHANNELS_BY_MODE: Record<PublicationMode, Record<PublicationChannel, boolean>> = {
  NONE: { PORTAL: false, INTRANET: false, EXTERNAL: false, LINK: false },
  BOTH: { PORTAL: true, INTRANET: true, EXTERNAL: true, LINK: true },
  PUBLIC: { PORTAL: true, INTRANET: false, EXTERNAL: true, LINK: true },
  // "Somente Intranet": fora da lista pública e dos feeds, mas a página abre pelo link da
  // Intranet (noindex) — é nela que o colaborador se candidata.
  INTERNAL: { PORTAL: false, INTRANET: true, EXTERNAL: false, LINK: true },
};

function modeOf(visibility: string | null | undefined): PublicationMode {
  // Sem valor (linha antiga lida sem a coluna) = padrão do banco.
  if (!visibility) return "BOTH";
  return (PUBLICATION_MODES as readonly string[]).includes(visibility) ? (visibility as PublicationMode) : "NONE";
}

/** Canais habilitados pela publicação — sem olhar status nem prazo. */
export function publicationChannels(visibility: string | null | undefined): Record<PublicationChannel, boolean> {
  return { ...CHANNELS_BY_MODE[modeOf(visibility)] };
}

/** Modos de publicação que habilitam um canal (para filtros `.in("visibility", …)`). */
export function visibilitiesFor(channel: PublicationChannel): PublicationMode[] {
  return PUBLICATION_MODES.filter((m) => CHANNELS_BY_MODE[m][channel]);
}

/** Lista do portal, sitemap, feeds Google/Indeed e JSON-LD. */
export const PORTAL_LISTED_VISIBILITIES = visibilitiesFor("PORTAL");
/** Vagas Internas (Intranet). */
export const INTRANET_VISIBILITIES = visibilitiesFor("INTRANET");
/** Integrações externas (feeds, Google for Jobs, Indeed, LinkedIn). */
export const EXTERNAL_VISIBILITIES = visibilitiesFor("EXTERNAL");
/** Página /vagas/[slug] e candidatura pelo link. */
export const LINK_VISIBILITIES = visibilitiesFor("LINK");

/** Status em que o processo está apto a ser publicado (aberto). */
export const PUBLISHABLE_STATUSES = PUBLIC_JOB_STATUSES;

export function isPublishableStatus(status: string): boolean {
  return isPublicJobStatus(status);
}

/** Vaga "Somente Intranet": fora da lista pública, sitemap e feeds (a página abre pelo link). */
export function isInternalOnlyJob(visibility: string | null | undefined): boolean {
  return visibility === "INTERNAL";
}

export function isUnpublished(visibility: string | null | undefined): boolean {
  return modeOf(visibility) === "NONE";
}

export interface PublicationInput {
  status: string;
  visibility: string | null | undefined;
  closingDate?: string | Date | null;
}

/** Inscrições no prazo (sem data = sem prazo). */
export function inscriptionsOpen(closingDate: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!closingDate) return true;
  const t = new Date(closingDate).getTime();
  return Number.isNaN(t) || t >= now.getTime();
}

export interface PublicationState {
  /** Processo aberto (apto a publicar). */
  publishable: boolean;
  /** Publicação escolhida pelo RH. */
  mode: PublicationMode;
  /** Aparece em ALGUM canal agora (status aberto + modo ≠ NONE). */
  published: boolean;
  /** Canal a canal, considerando status (e prazo, para listas/feeds). */
  channels: Record<PublicationChannel, boolean>;
  /** Aceita candidatura pelo portal agora (link aberto + inscrições no prazo). */
  acceptsApplications: boolean;
}

/**
 * Estado de publicação da vaga num instante. Listas (Portal/Intranet) e feeds externos
 * exigem inscrições no prazo; a página pelo link continua abrindo depois do prazo (mostra
 * "inscrições encerradas"), mas não aceita candidatura.
 */
export function publicationState(job: PublicationInput, now: Date = new Date()): PublicationState {
  const mode = modeOf(job.visibility);
  const publishable = isPublishableStatus(job.status);
  const inPeriod = inscriptionsOpen(job.closingDate, now);
  const enabled = CHANNELS_BY_MODE[mode];
  const channels: Record<PublicationChannel, boolean> = {
    PORTAL: publishable && inPeriod && enabled.PORTAL,
    INTRANET: publishable && inPeriod && enabled.INTRANET,
    EXTERNAL: publishable && inPeriod && enabled.EXTERNAL,
    LINK: publishable && enabled.LINK,
  };
  return {
    publishable,
    mode,
    published: publishable && mode !== "NONE",
    channels,
    acceptsApplications: channels.LINK && inPeriod,
  };
}

export function isVisibleOn(job: PublicationInput, channel: PublicationChannel, now: Date = new Date()): boolean {
  return publicationState(job, now).channels[channel];
}

/**
 * Indicador de publicação para o painel — só faz sentido com o processo aberto
 * ("Aberta • Publicada" / "Aberta • Não publicada"). Rascunho, Pausada e Encerrada já dizem
 * por si que a vaga está fora do ar.
 */
export function publicationIndicator(job: Pick<PublicationInput, "status" | "visibility">): {
  label: "Publicada" | "Não publicada";
  hint: string;
} | null {
  if (!isPublishableStatus(job.status)) return null;
  if (modeOf(job.visibility) === "NONE") {
    return {
      label: "Não publicada",
      hint: "Processo seletivo aberto, sem divulgação — só o RH vê no painel.",
    };
  }
  return { label: "Publicada", hint: PUBLICATION_LABELS[modeOf(job.visibility)] };
}

/**
 * Por que a vaga não está nos canais externos (Google/Indeed/LinkedIn) — texto para a aba
 * Divulgação. null = está.
 */
export function externalBlockReason(job: Pick<PublicationInput, "status" | "visibility">): string | null {
  if (!isPublishableStatus(job.status)) {
    return "O processo seletivo não está aberto. Mude o status para Recebendo candidaturas para habilitar a divulgação.";
  }
  const mode = modeOf(job.visibility);
  if (mode === "NONE") {
    return "A publicação está como Não publicar. Escolha onde exibir a vaga em Visão geral › Gestão do processo.";
  }
  if (mode === "INTERNAL") {
    return "A vaga está como Somente Intranet — não vai para o Portal nem para integrações externas.";
  }
  return null;
}
