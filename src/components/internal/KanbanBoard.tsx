"use client";

import { useState } from "react";
import { Download, Mail, Phone, Trash2, GripVertical } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { formatDate } from "@/lib/utils";

export interface KanbanApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  resumeName: string | null;
  stage: string;
  createdAt: string; // ISO
}

interface Props {
  applications: KanbanApplication[];
  canManage: boolean;
}

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "NEW", label: "Novo", dot: "bg-blue-400" },
  { key: "SCREENING", label: "Triagem", dot: "bg-amber-400" },
  { key: "INTERVIEW", label: "Entrevista", dot: "bg-purple-400" },
  { key: "OFFER", label: "Proposta", dot: "bg-cyan-400" },
  { key: "HIRED", label: "Contratado", dot: "bg-wg-green" },
  { key: "REJECTED", label: "Reprovado", dot: "bg-red-400" },
];

export function KanbanBoard({ applications, canManage }: Props) {
  const [apps, setApps] = useState(applications);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function moveTo(appId: string, stage: string) {
    const app = apps.find((a) => a.id === appId);
    if (!app || app.stage === stage) return;

    const prev = apps;
    setApps((list) => list.map((a) => (a.id === appId ? { ...a, stage } : a)));
    setError(null);

    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        setApps(prev); // reverte
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao mover candidatura.");
      }
    } catch {
      setApps(prev);
      setError("Erro de conexão. Tente novamente.");
    }
  }

  async function remove(appId: string) {
    const prev = apps;
    setApps((list) => list.filter((a) => a.id !== appId));
    setError(null);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setApps(prev);
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao excluir candidatura.");
      }
    } catch {
      setApps(prev);
      setError("Erro de conexão. Tente novamente.");
    }
  }

  const deleting = apps.find((a) => a.id === deleteId);

  return (
    <>
      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((col) => {
          const cards = apps.filter((a) => a.stage === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!canManage || !dragId) return;
                e.preventDefault();
                setOverStage(col.key);
              }}
              onDragLeave={() => setOverStage((s) => (s === col.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                if (canManage && dragId) moveTo(dragId, col.key);
                setDragId(null);
              }}
              className={`shrink-0 w-72 rounded-xl border transition-colors ${
                overStage === col.key
                  ? "border-wg-green bg-wg-green/5"
                  : "border-wg-border bg-wg-card"
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-wg-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                </div>
                <span className="text-xs text-wg-gray bg-wg-card-2 rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>

              <div className="p-2 flex flex-col gap-2 min-h-[120px]">
                {cards.length === 0 && (
                  <p className="text-xs text-wg-gray text-center py-6">Nenhuma candidatura</p>
                )}

                {cards.map((a) => (
                  <div
                    key={a.id}
                    draggable={canManage}
                    onDragStart={() => setDragId(a.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`group bg-wg-card-2 border border-wg-border rounded-lg p-3 ${
                      canManage ? "cursor-grab active:cursor-grabbing" : ""
                    } ${dragId === a.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.fullName}</p>
                        <p className="text-[11px] text-wg-gray mt-0.5">
                          {formatDate(a.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <GripVertical className="w-4 h-4 text-wg-gray/50 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-col gap-1">
                      <a
                        href={`mailto:${a.email}`}
                        className="flex items-center gap-1.5 text-xs text-wg-gray hover:text-wg-green transition-colors truncate"
                      >
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{a.email}</span>
                      </a>
                      <a
                        href={`tel:${a.phone.replace(/\D/g, "")}`}
                        className="flex items-center gap-1.5 text-xs text-wg-gray hover:text-wg-green transition-colors"
                      >
                        <Phone className="w-3 h-3 shrink-0" />
                        {a.phone}
                      </a>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {a.resumeName ? (
                        <a
                          href={`/api/applications/${a.id}/resume`}
                          className="inline-flex items-center gap-1 text-xs text-wg-green hover:text-wg-green-bright transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Currículo
                        </a>
                      ) : (
                        <span className="text-xs text-wg-gray/60">Sem currículo</span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setDeleteId(a.id)}
                          title="Excluir candidatura"
                          className="p-1 text-wg-gray/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Excluir candidatura?"
        message={
          deleting
            ? `A candidatura de "${deleting.fullName}" e o currículo serão removidos permanentemente (LGPD). Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => {
          if (deleteId) remove(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
