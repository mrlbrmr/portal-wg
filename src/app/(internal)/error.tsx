"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { isStaleDeploymentError } from "@/lib/action-errors";

export default function InternalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Página aberta antes de um deploy: só recarregar resolve (o "tentar de novo" reusa o
  // código antigo da página).
  const stale = isStaleDeploymentError(error);
  // Detalhe para o suporte: mensagem do erro no navegador ou o código (digest) do servidor.
  const detail = error.digest ? `Código: ${error.digest}` : error.message;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{stale ? "O sistema foi atualizado" : "Algo deu errado"}</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        {stale
          ? "Esta página foi aberta antes da atualização. Recarregue para continuar — nada foi salvo."
          : "Ocorreu um erro inesperado. Os dados não foram alterados. Tente novamente."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => (stale ? window.location.reload() : reset())}
          className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {stale ? "Recarregar página" : "Tentar novamente"}
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Ir ao dashboard
        </Link>
      </div>
      {!stale && detail && (
        <p className="mt-6 max-w-md break-words font-mono text-[11px] text-gray-400">Detalhe técnico: {detail}</p>
      )}
    </div>
  );
}
