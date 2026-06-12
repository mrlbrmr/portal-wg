"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUS_LABELS } from "@/lib/utils";
import { ApplicationStatus } from "@prisma/client";
import { Loader2, Check } from "lucide-react";

interface Props {
  applicationId: string;
  currentStatus: ApplicationStatus;
}

const ALL_STATUSES = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];

export default function StatusChangeForm({ applicationId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (status === currentStatus) return;
    setIsLoading(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });

      if (res.ok) {
        setSaved(true);
        setNote("");
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value as ApplicationStatus); setSaved(false); }}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {APPLICATION_STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      {status !== currentStatus && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)..."
          rows={2}
          maxLength={500}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
        />
      )}

      <button
        onClick={handleSave}
        disabled={isLoading || status === currentStatus}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
        ) : saved ? (
          <><Check className="w-4 h-4" /> Salvo!</>
        ) : (
          "Salvar status"
        )}
      </button>
    </div>
  );
}
