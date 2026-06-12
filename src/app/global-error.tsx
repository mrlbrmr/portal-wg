"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", background: "#f9fafb", margin: 0, padding: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#111", marginBottom: "8px" }}>
              Erro crítico
            </h2>
            <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
              Ocorreu um erro inesperado no sistema. Tente recarregar.
            </p>
            <button
              onClick={reset}
              style={{ background: "#f97316", color: "white", border: "none", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
            >
              Recarregar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
