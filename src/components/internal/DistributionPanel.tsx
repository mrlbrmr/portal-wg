"use client";

import { useState, useTransition } from "react";
import type { DistributionChannel, PublicationStatus } from "@/types/domain";
import { Check, Copy, ExternalLink, FlaskConical, Rss, Send, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { Panel } from "@/components/ui/Panel";
import { Button, buttonVariants } from "@/components/ui/Button";
import { StatusBadge, type Tone } from "@/components/ui/StatusBadge";
import { CHANNELS, CHANNEL_KIND_LABEL } from "@/lib/distribution/channels";
import { publishChannelAction, unpublishChannelAction } from "@/lib/distribution/actions";

export interface PublicationView {
  channel: DistributionChannel;
  status: PublicationStatus;
  externalUrl: string | null;
  lastError: string | null;
  postedAt: string | null;
}

interface Props {
  jobId: string;
  jobUrl: string;
  isPublic: boolean;
  publications: PublicationView[];
  announcementText: string;
}

const STATUS_META: Record<PublicationStatus, { label: string; tone: Tone }> = {
  NOT_PUBLISHED: { label: "Não divulgado", tone: "neutral" },
  PENDING: { label: "Em andamento", tone: "warning" },
  PUBLISHED: { label: "Divulgado", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
  REMOVED: { label: "Retirado", tone: "neutral" },
};

const KIND_ICON = { manual: Share2, feed: Rss, api: Send } as const;

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Canais de divulgação da vaga. Cada linha mostra: nome, tipo de integração, status,
 * última ação (quando houver) e a ação possível. Feeds (Google/Indeed) são passivos:
 * entram sozinhos enquanto a vaga está publicada no portal.
 */
export function DistributionPanel({ jobId, jobUrl, isPublic, publications, announcementText }: Props) {
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [busyChannel, setBusyChannel] = useState<DistributionChannel | null>(null);

  const byChannel = new Map(publications.map((p) => [p.channel, p]));

  async function copyText() {
    try {
      await navigator.clipboard.writeText(announcementText);
      setCopied(true);
      notify("success", "Texto de divulgação copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("error", "Não foi possível copiar.");
    }
  }

  function runChannel(
    channel: DistributionChannel,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    okMsg: string
  ) {
    setBusyChannel(channel);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) notify("success", okMsg);
      else notify("error", res.error);
      setBusyChannel(null);
    });
  }

  return (
    <Panel
      title="Canais de divulgação"
      description="Onde esta vaga aparece além do portal. Feeds entram automaticamente enquanto a vaga está publicada."
      flush
    >
      {!isPublic && (
        <p className="mx-5 mb-3 rounded-control border border-warning-border bg-warning-bg px-3 py-2 text-meta text-warning-fg">
          A vaga não está publicada no portal. Mude o status para <strong>Recebendo candidaturas</strong> (ou outra etapa no portal) para
          habilitar a divulgação.
        </p>
      )}

      <ul className="divide-y divide-wg-border-lighter border-t border-wg-border-lighter">
        {CHANNELS.map((c) => {
          const pub = byChannel.get(c.channel);
          const status: PublicationStatus = pub?.status ?? "NOT_PUBLISHED";
          const isBusy = busyChannel === c.channel && isPending;
          const isPublished = status === "PUBLISHED";
          const isFeed = c.kind === "feed" && c.implemented;
          const feedActive = isFeed && isPublic;
          const KindIcon = KIND_ICON[c.kind];
          const badge = !c.implemented
            ? { label: "Em breve", tone: "neutral" as Tone }
            : isFeed
              ? feedActive
                ? { label: "Ativo automaticamente", tone: "success" as Tone }
                : { label: "Aguardando publicação", tone: "neutral" as Tone }
              : STATUS_META[status];
          const lastAction = formatWhen(pub?.postedAt ?? null);

          return (
            <li key={c.channel} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-wg-bg text-wg-ink-muted">
                <KindIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-wg-ink">{c.label}</span>
                  <span className="rounded bg-neutral-bg px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-neutral-fg">
                    {CHANNEL_KIND_LABEL[c.kind]}
                  </span>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>
                <p className="mt-0.5 text-meta text-wg-ink-muted">{c.description}</p>
                {lastAction && !isFeed && <p className="mt-0.5 text-meta text-wg-ink-muted">Última ação: {lastAction}</p>}
                {pub?.lastError && status === "FAILED" && <p className="mt-1 text-meta text-danger-fg">{pub.lastError}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {!c.implemented ? null : isFeed ? (
                  c.channel === "INDEED" ? (
                    <a
                      href="/api/feed/indeed.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      title="Ver o feed XML enviado ao Indeed"
                    >
                      <ExternalLink aria-hidden /> Ver feed
                    </a>
                  ) : (
                    <a
                      href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(jobUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      title="Validar os dados estruturados no Google"
                    >
                      <FlaskConical aria-hidden /> Testar
                    </a>
                  )
                ) : c.channel === "MANUAL" ? (
                  <>
                    <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copyText} disabled={!isPublic}>
                      Copiar anúncio
                    </Button>
                    {isPublished ? (
                      <Button
                        size="sm"
                        variant="tertiary"
                        loading={isBusy}
                        onClick={() => runChannel(c.channel, () => unpublishChannelAction(jobId, c.channel), "Marcado como não divulgado.")}
                      >
                        Remover
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={isBusy}
                        disabled={!isPublic}
                        onClick={() => runChannel(c.channel, () => publishChannelAction(jobId, c.channel), "Marcado como divulgado.")}
                      >
                        Marcar divulgado
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant={isPublished ? "secondary" : "primary"}
                    loading={isBusy}
                    disabled={!isPublic}
                    onClick={() =>
                      runChannel(c.channel, () => publishChannelAction(jobId, c.channel), isPublished ? "Republicado." : "Divulgado.")
                    }
                  >
                    {isPublished ? "Republicar" : "Divulgar"}
                  </Button>
                )}

                {pub?.externalUrl && (
                  <a
                    href={pub.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                    title="Abrir publicação"
                    aria-label={`Abrir publicação no ${c.label}`}
                  >
                    <ExternalLink aria-hidden />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
