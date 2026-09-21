"use client";

import { useEffect, useRef } from "react";

/**
 * Espelha o estado dos filtros na query string (history.replaceState — sem navegação nem
 * nova requisição ao servidor). Assim o filtro sobrevive a F5, ao "voltar" do navegador e
 * pode ser compartilhado por link. Valores vazios são omitidos da URL.
 */
export function useSyncQueryString(params: Record<string, string | undefined | null>) {
  const serialized = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))
  ).toString();
  const first = useRef(true);

  useEffect(() => {
    // Na montagem a URL já reflete o estado inicial (veio dela).
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${window.location.pathname}${serialized ? `?${serialized}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
  }, [serialized]);
}

/** Lê uma lista separada por vírgula de um parâmetro de URL. */
export function parseList(raw: string | undefined | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
