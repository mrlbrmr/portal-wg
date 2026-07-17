"use client";

import { useState, useTransition } from "react";
import type { DistributionChannel, PublicationStatus } from "@prisma/client";
import { Megaphone, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
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

const STATUS_LABEL: Record<PublicationStatus, string> = {
  NOT_PUBLISHED: "Não divulgado",
  PENDING: "Em andamento",
  PUBLISHED: "Divulgado",
  FAILED: "Falhou",
  REMOVED: "Retirado",
};

const STATUS_CLASS: Record<PublicationStatus, string> = {
  NOT_PUBLISHED: "bg-gray-100 text-gray-500",
  PENDING: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-wg-green/15 text-wg-green-dark",
  FAILED: "bg-red-100 text-red-700",
  REMOVED: "bg-gray-200 text-gray-600",
};

export function DistributionPanel({
  jobId,
  jobUrl,
  isPublic,
  publications,
  announcementText,
}: Props) {
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
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-4 h-4 text-wg-green-dark" />
        <h2 className="text-sm font-semibold text-gray-900">Divulgação</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Divulgue esta vaga nos canais externos. Cada canal mostra seu status.
      </p>

      {!isPublic && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Publique a vaga (status <strong>Ativa</strong>) para habilitar a divulgação.
        </div>
      )}

      <div className="space-y-2">
        {CHANNELS.map((c) => {
          const pub = byChannel.get(c.channel);
          const status: PublicationStatus = pub?.status ?? "NOT_PUBLISHED";
          const isBusy = busyChannel === c.channel && isPending;
          const isPublished = status === "PUBLISHED";
          // Canais de feed (Google/Indeed) são passivos: entram automaticamente
          // quando a vaga está pública, sem ação manual.
          const isFeed = c.kind === "feed" && c.implemented;
          const feedActive = isFeed && isPublic;

          return (
            <div
              key={c.channel}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gray-200 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{c.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                    {CHANNEL_KIND_LABEL[c.kind]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                {pub?.lastError && status === "FAILED" && (
                  <p className="text-xs text-red-600 mt-1">{pub.lastError}</p>
                )}
              </div>

              <span
                className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5 ${
                  isFeed
                    ? feedActive
                      ? STATUS_CLASS.PUBLISHED
                      : STATUS_CLASS.NOT_PUBLISHED
                    : STATUS_CLASS[status]
                }`}
              >
                {isFeed
                  ? feedActive
                    ? "Ativo (automático)"
                    : "Aguardando publicação"
                  : STATUS_LABEL[status]}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {!c.implemented ? (
                  <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
                    Em breve
                  </span>
                ) : isFeed ? (
                  c.channel === "INDEED" ? (
                    <a
                      href="/api/feed/indeed.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="Ver o feed XML enviado ao Indeed"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ver feed
                    </a>
                  ) : (
                    <a
                      href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(jobUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="Validar os dados estruturados no Google"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Testar
                    </a>
                  )
                ) : c.channel === "MANUAL" ? (
                  <>
                    <button
                      type="button"
                      onClick={copyText}
                      disabled={!isPublic}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar anúncio
                    </button>
                    {isPublished ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          runChannel(
                            c.channel,
                            () => unpublishChannelAction(jobId, c.channel),
                            "Marcado como não divulgado."
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Remover
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!isPublic || isBusy}
                        onClick={() =>
                          runChannel(
                            c.channel,
                            () => publishChannelAction(jobId, c.channel),
                            "Marcado como divulgado."
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-wg-green hover:bg-wg-green-bright disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Marcar divulgado
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!isPublic || isBusy}
                    onClick={() =>
                      runChannel(
                        c.channel,
                        () => publishChannelAction(jobId, c.channel),
                        "Divulgado."
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-wg-green hover:bg-wg-green-bright disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Divulgar
                  </button>
                )}

                {pub?.externalUrl && (
                  <a
                    href={pub.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-wg-green-dark rounded"
                    title="Abrir"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
