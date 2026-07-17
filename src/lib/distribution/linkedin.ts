import { prisma } from "@/lib/prisma";
import type { ChannelConnection, Prisma } from "@prisma/client";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import type { JobForDistribution, PublishResult } from "./types";

// Integração com o LinkedIn (post na página da empresa via Community Management
// API). Fluxo: OAuth 3-legged → token + URN da organização guardados em
// ChannelConnection(LINKEDIN_PAGE) → POST /rest/posts como a organização.
//
// Requer, no LinkedIn Developers, um app com o produto "Community Management
// API" aprovado e a página da empresa verificada. Escopos usados abaixo.

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_BASE = "https://api.linkedin.com";
// Versão da API (YYYYMM). Fácil de atualizar quando o LinkedIn avançar a versão.
const LINKEDIN_VERSION = "202405";
const SCOPES = ["w_organization_social", "rw_organization_admin"];

export function isLinkedInConfigured(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export function linkedinRedirectUri(): string {
  // Remove barra(s) final(is) do base para nunca gerar "//api" (mismatch comum
  // com o valor registrado no app do LinkedIn).
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://carreiras.wgbaterias.com.br").replace(
    /\/+$/,
    ""
  );
  return `${base}/api/distribution/linkedin/callback`;
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: linkedinRedirectUri(),
    state,
    scope: SCOPES.join(" "),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // segundos (~60 dias)
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    redirect_uri: linkedinRedirectUri(),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter token do LinkedIn (${res.status}).`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao renovar token do LinkedIn (${res.status}).`);
  return (await res.json()) as TokenResponse;
}

/** Descobre a organização (página) que o usuário autenticado administra. */
export async function fetchAdministeredOrganization(
  accessToken: string
): Promise<{ urn: string; name: string } | null> {
  const url =
    `${API_BASE}/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` +
    `&projection=(elements*(organization~(localizedName)))`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    elements?: Array<{ organization: string; "organization~"?: { localizedName?: string } }>;
  };
  const first = data.elements?.[0];
  if (!first) return null;
  return {
    urn: first.organization,
    name: first["organization~"]?.localizedName ?? first.organization,
  };
}

// ─── Persistência da conexão (ChannelConnection LINKEDIN_PAGE) ─────────────────

interface LinkedInConfig {
  orgUrn?: string;
  orgName?: string;
}

export async function getLinkedInConnection(): Promise<ChannelConnection | null> {
  return prisma.channelConnection.findUnique({ where: { channel: "LINKEDIN_PAGE" } });
}

export async function saveLinkedInConnection(params: {
  accessToken: string;
  expiresInSec: number;
  refreshToken?: string | null;
  orgUrn: string;
  orgName: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + params.expiresInSec * 1000);
  const config = {
    orgUrn: params.orgUrn,
    orgName: params.orgName,
  } as Prisma.InputJsonObject;
  await prisma.channelConnection.upsert({
    where: { channel: "LINKEDIN_PAGE" },
    create: {
      channel: "LINKEDIN_PAGE",
      enabled: true,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiresAt,
      config,
    },
    update: {
      enabled: true,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiresAt,
      config,
    },
  });
}

export async function clearLinkedInConnection(): Promise<void> {
  await prisma.channelConnection.deleteMany({ where: { channel: "LINKEDIN_PAGE" } });
}

export function getLinkedInConfig(conn: ChannelConnection): LinkedInConfig {
  return (conn.config as LinkedInConfig | null) ?? {};
}

/** Garante um token válido, renovando se possível. Retorna o token ou null. */
async function ensureValidToken(conn: ChannelConnection): Promise<string | null> {
  const stillValid = conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid && conn.accessToken) return conn.accessToken;

  if (conn.refreshToken) {
    try {
      const t = await refreshAccessToken(conn.refreshToken);
      const cfg = getLinkedInConfig(conn);
      await saveLinkedInConnection({
        accessToken: t.access_token,
        expiresInSec: t.expires_in,
        refreshToken: t.refresh_token ?? conn.refreshToken,
        orgUrn: cfg.orgUrn ?? "",
        orgName: cfg.orgName ?? "",
      });
      return t.access_token;
    } catch {
      return null;
    }
  }
  return null;
}

/** Monta o texto do post (commentary). O card do link vem do content.article. */
function buildCommentary(job: JobForDistribution): string {
  const parts = [
    `🚀 Nova vaga: ${job.title}`,
    `📍 ${job.city}/${job.state} · ${MODALITY_LABELS[job.modality] ?? job.modality}`,
    `📄 ${CONTRACT_TYPE_LABELS[job.contractType] ?? job.contractType}`,
  ];
  if (job.salaryRange) parts.push(`💰 ${job.salaryRange}`);
  parts.push("", `Candidate-se: ${job.url}`, "", "#vagas #carreiras #WG");
  return parts.join("\n");
}

/** Publica um post na página da organização com o card da vaga. */
export async function createOrganizationPost(job: JobForDistribution): Promise<PublishResult> {
  if (!isLinkedInConfigured()) {
    return { ok: false, error: "LinkedIn não configurado (defina as variáveis de ambiente)." };
  }
  const conn = await getLinkedInConnection();
  if (!conn) {
    return { ok: false, error: "Conecte a página do LinkedIn em Configurações → Divulgação." };
  }
  const cfg = getLinkedInConfig(conn);
  if (!cfg.orgUrn) {
    return { ok: false, error: "Organização do LinkedIn não definida — reconecte." };
  }

  const token = await ensureValidToken(conn);
  if (!token) {
    return { ok: false, error: "Sessão do LinkedIn expirou — reconecte em Configurações → Divulgação." };
  }

  const payload = {
    author: cfg.orgUrn,
    commentary: buildCommentary(job),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      article: {
        source: job.url,
        title: job.title.slice(0, 200),
        description: `${job.city}/${job.state} · ${MODALITY_LABELS[job.modality] ?? job.modality}`.slice(
          0,
          256
        ),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) detail = j.message;
    } catch {
      /* mantém o status */
    }
    return { ok: false, error: `LinkedIn recusou o post: ${detail}` };
  }

  const postUrn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
  return {
    ok: true,
    externalId: postUrn,
    externalUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : null,
  };
}
