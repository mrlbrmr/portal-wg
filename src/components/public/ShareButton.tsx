"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface Props {
  url: string;
}

export function ShareButton({ url }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select input
    }
  }

  return (
    <button
      onClick={copy}
      title="Copiar link desta vaga"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3.5 py-1.5 rounded-full transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-wg-green" />
          Link copiado!
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5" />
          Compartilhar
        </>
      )}
    </button>
  );
}
