"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

interface Props {
  status?: string;
}

/** Botão secundário "Exportar CSV" da lista de vagas. */
export function ExportCsvButton({ status }: Props) {
  const [loading, setLoading] = useState(false);
  const { notify } = useToast();

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/jobs/export?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        notify("error", "Não foi possível exportar as vagas. Tente novamente.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `vagas-wg-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      notify("error", "Erro de conexão ao exportar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      icon={Download}
      loading={loading}
      onClick={handleExport}
      title="Baixar a lista de vagas em CSV"
      aria-label="Exportar vagas em CSV"
    >
      <span className="hidden sm:inline">Exportar CSV</span>
    </Button>
  );
}
