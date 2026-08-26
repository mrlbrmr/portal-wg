"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface Props {
  status?: string;
}

export function ExportCsvButton({ status }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/jobs/export?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) return;
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      title="Exportar lista de vagas como CSV"
      className="flex items-center gap-1.5 text-sm bg-white border border-slate-300 text-slate-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      <span className="hidden sm:inline">Exportar CSV</span>
    </button>
  );
}
