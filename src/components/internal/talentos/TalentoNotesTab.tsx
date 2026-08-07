"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import type { TalentoNote } from "@/lib/talentos/types";

interface Props {
  notas:     TalentoNote[];
  talentoId: string;
  isAdmin:   boolean;
}

export default function TalentoNotesTab({ notas: initialNotas, talentoId, isAdmin }: Props) {
  const router              = useRouter();
  const [notas, setNotas]   = useState<TalentoNote[]>(initialNotas);
  const [conteudo, setC]    = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function addNote() {
    if (!conteudo.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/talentos/${talentoId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo }),
    });
    setSaving(false);
    if (!res.ok) { setError("Erro ao salvar nota."); return; }
    const created = await res.json() as TalentoNote;
    setNotas((prev) => [created, ...prev]);
    setC("");
    router.refresh();
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/talentos/${talentoId}/notes/${noteId}`, { method: "DELETE" });
    if (!res.ok) return;
    setNotas((prev) => prev.filter((n) => n.id !== noteId));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Formulário de nova nota */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-wg-ink-muted mb-2">Nova nota</div>
        <textarea
          value={conteudo}
          onChange={(e) => { setC(e.target.value); setError(""); }}
          rows={3}
          placeholder="Registre uma observação sobre este talento…"
          className="w-full rounded-lg border border-wg-border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-wg-green/40"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            onClick={addNote}
            disabled={saving || !conteudo.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-wg-green text-white hover:bg-wg-green-dark disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {saving ? "Salvando…" : "Adicionar nota"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      {notas.length === 0 ? (
        <div className="py-8 text-center text-wg-ink-muted text-sm">Nenhuma nota ainda.</div>
      ) : (
        <div className="space-y-3">
          {notas.map((nota) => (
            <div key={nota.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-wg-ink">{nota.autorNome ?? "Usuário"}</span>
                  <span className="text-[11px] text-wg-ink-muted">
                    {new Date(nota.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => deleteNote(nota.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Excluir nota"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-wg-ink-secondary whitespace-pre-wrap leading-relaxed">
                {nota.conteudo}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
