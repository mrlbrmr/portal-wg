"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

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

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Algo deu errado</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        Ocorreu um erro inesperado. Os dados não foram alterados. Tente novamente.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Ir ao dashboard
        </Link>
      </div>
    </div>
  );
}
