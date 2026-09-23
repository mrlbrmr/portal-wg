"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Linkedin, CheckCircle2, Link2Off, PlugZap } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { disconnectLinkedInAction } from "@/lib/distribution/connection-actions";

interface Props {
  configured: boolean;
  connected: boolean;
  orgName: string | null;
  expiresAt: string | null; // ISO
}

export function LinkedInConnection({ configured, connected, orgName, expiresAt }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  function disconnect() {
    setConfirming(false);
    startTransition(async () => {
      const res = await disconnectLinkedInAction();
      if (res.ok) {
        notify("success", "LinkedIn desconectado.");
        router.refresh();
      } else {
        notify("error", res.error);
      }
    });
  }

  return (
    <section className="rounded-card border border-wg-border-lighter bg-white p-5" aria-labelledby="linkedin-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-[#E8F1FA] text-[#0a66c2]">
            <Linkedin className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 id="linkedin-title" className="text-record-title text-wg-ink">
              Página da empresa no LinkedIn
            </h2>
            <p className="mt-0.5 text-meta text-wg-ink-muted">
              Com a página conectada, as vagas podem ser publicadas no feed da empresa.
            </p>
          </div>
        </div>
        {configured &&
          (connected ? (
            <StatusBadge tone="success">Conectado</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Não conectado</StatusBadge>
          ))}
      </div>

      <div className="mt-4 border-t border-wg-border-lighter pt-4">
        {!configured ? (
          <div className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-meta text-warning-fg">
            <PlugZap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            A integração com o LinkedIn ainda não foi habilitada neste ambiente. Fale com o responsável
            técnico para ativá-la.
          </div>
        ) : connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-body text-wg-ink-secondary">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg" aria-hidden />
              <span>
                {orgName ?? "Página conectada"}
                {expiresLabel && <span className="text-wg-ink-muted"> · conexão válida até {expiresLabel}</span>}
              </span>
            </p>
            <Button variant="danger" icon={Link2Off} loading={isPending} onClick={() => setConfirming(true)}>
              Desconectar
            </Button>
          </div>
        ) : (
          <a
            href="/api/distribution/linkedin/connect"
            className="inline-flex h-9 items-center gap-2 rounded-control bg-[#0a66c2] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#004182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a66c2]/50"
          >
            <Linkedin className="h-4 w-4" aria-hidden /> Conectar LinkedIn
          </a>
        )}
      </div>

      <ConfirmModal
        isOpen={confirming}
        title="Desconectar o LinkedIn?"
        message="As vagas deixarão de ser publicadas na página da empresa até que ela seja conectada de novo. As publicações já feitas continuam no LinkedIn."
        confirmLabel="Desconectar"
        onConfirm={disconnect}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
