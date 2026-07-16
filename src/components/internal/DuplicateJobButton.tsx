"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";

interface Props {
  jobId: string;
  jobTitle: string;
}

export function DuplicateJobButton({ jobId, jobTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDuplicate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/duplicate`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao duplicar.");
        return;
      }
      const newJob = await res.json();
      router.push(`/vagas/${newJob.id}/editar`);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDuplicate}
        disabled={loading}
        title={`Duplicar "${jobTitle}"`}
        className="p-1.5 text-gray-500 hover:text-wg-green-dark hover:bg-wg-green/10 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
