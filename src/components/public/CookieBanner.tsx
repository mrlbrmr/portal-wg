"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "wg_cookie_consent";
const VERSION = "1.0";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      /* localStorage indisponível (modo privado restrito) */
    }
  }, []);

  function save(analytics: boolean) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ analytics, version: VERSION, at: new Date().toISOString() })
      );
    } catch {
      /* silenciar */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      aria-live="polite"
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-xs text-gray-600 leading-relaxed">
          Usamos cookies essenciais para o funcionamento do portal e, com seu consentimento,
          cookies de analytics para medir o desempenho das páginas.{" "}
          <Link
            href="/termos#cookies"
            className="text-wg-green underline hover:text-wg-green-dark whitespace-nowrap"
          >
            Saiba mais
          </Link>
          .
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => save(false)}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            Apenas essenciais
          </button>
          <button
            onClick={() => save(true)}
            className="px-4 py-2 text-xs font-medium text-black bg-wg-green hover:bg-wg-green-bright rounded-full transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
