"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Linkedin, Loader2, CheckCircle2, Link2Off } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
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

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  function disconnect() {
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
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Linkedin className="w-4 h-4 text-[#0a66c2]" />
        <h2 className="text-sm font-semibold text-gray-900">LinkedIn — página da empresa</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Conecte a página para publicar vagas automaticamente no feed da empresa.
      </p>

      {!configured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          Integração ainda não configurada no servidor. Defina{" "}
          <code className="font-mono">LINKEDIN_CLIENT_ID</code> e{" "}
          <code className="font-mono">LINKEDIN_CLIENT_SECRET</code> nas variáveis de ambiente.
        </div>
      ) : connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-wg-green-dark" />
            <span>
              Conectado{orgName ? ` — ${orgName}` : ""}
              {expiresLabel && (
                <span className="text-gray-400"> · sessão válida até {expiresLabel}</span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
            Desconectar
          </button>
        </div>
      ) : (
        <a
          href="/api/distribution/linkedin/connect"
          className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
        >
          <Linkedin className="w-4 h-4" /> Conectar LinkedIn
        </a>
      )}
    </div>
  );
}
