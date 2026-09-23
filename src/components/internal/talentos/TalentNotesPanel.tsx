"use client";

import { useState } from "react";
import { Lock, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { settingsInputClass } from "@/components/internal/settings/fields";
import { createTalentNote, deleteTalentNote, updateTalentNote } from "@/lib/talentos/actions";
import { fullDateTime } from "@/lib/talentos/crm";
import type { TalentNote } from "@/lib/talentos/profile";

interface Props {
  talentoId: string;
  notes: TalentNote[];
  canManage: boolean;
  currentUserId: string;
  onChanged: () => void;
}

const EDIT_GRACE_MS = 2000;

/**
 * Anotações internas do RH sobre o PERFIL (valem para qualquer vaga). Autor e data/hora
 * sempre visíveis; só o autor edita; autor ou administrador exclui (hoje, todo autor é
 * administrador — o RLS garante as duas regras no banco).
 */
export function TalentNotesPanel({ talentoId, notes: initialNotes, canManage, currentUserId, onChanged }: Props) {
  const { notify } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Mantém em sincronia quando o perfil é recarregado.
  const [synced, setSynced] = useState(initialNotes);
  if (synced !== initialNotes) {
    setSynced(initialNotes);
    setNotes(initialNotes);
  }

  const add = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const r = await createTalentNote(talentoId, draft);
      if (!r.ok) {
        notify("error", r.error);
        return;
      }
      setNotes((n) => [r.note, ...n]);
      setDraft("");
      notify("success", "Anotação salva.");
      onChanged();
    } catch {
      notify("error", "Não foi possível salvar a anotação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.text.trim()) return;
    setEditSaving(true);
    try {
      const r = await updateTalentNote(editing.id, editing.text);
      if (!r.ok) {
        notify("error", r.error);
        return;
      }
      setNotes((n) => n.map((x) => (x.id === r.note.id ? r.note : x)));
      setEditing(null);
      notify("success", "Anotação atualizada.");
    } catch {
      notify("error", "Não foi possível salvar a anotação. Tente novamente.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    const before = notes;
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      const r = await deleteTalentNote(id);
      if (!r.ok) {
        setNotes(before);
        notify("error", r.error);
        return;
      }
      notify("success", "Anotação excluída.");
      onChanged();
    } catch {
      setNotes(before);
      notify("error", "Não foi possível excluir a anotação.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-meta text-wg-ink-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Visível apenas para usuários internos autorizados.
      </p>

      {canManage && (
        <div className="rounded-card border border-wg-border-lighter bg-white p-3">
          <label htmlFor="talent-note-new" className="sr-only">
            Nova anotação
          </label>
          <textarea
            id="talent-note-new"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void add();
            }}
            placeholder="Ex.: Bom perfil comportamental. Reconsiderar para futuras oportunidades administrativas."
            className={settingsInputClass}
            maxLength={5000}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-wg-ink-muted">Ctrl + Enter para salvar</span>
            <Button size="sm" variant="primary" icon={MessageSquarePlus} onClick={add} loading={saving} disabled={!draft.trim()}>
              Adicionar anotação
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-body text-wg-ink-muted">Nenhuma anotação sobre este talento ainda.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const mine = n.autorId === currentUserId;
            const edited = new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > EDIT_GRACE_MS;
            const isEditing = editing?.id === n.id;
            return (
              <li key={n.id} className="rounded-card border border-wg-border-lighter bg-white p-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-meta">
                    <span className="font-semibold text-wg-ink">{n.autorNome ?? "Equipe de RH"}</span>
                    <span className="ml-2 text-wg-ink-muted" title={edited ? `Editada em ${fullDateTime(n.updatedAt)}` : undefined}>
                      {fullDateTime(n.createdAt)}
                      {edited && " · editada"}
                    </span>
                  </p>
                  {canManage && !isEditing && (
                    <div className="flex items-center gap-0.5">
                      {mine && (
                        <Button size="icon-sm" variant="tertiary" aria-label="Editar anotação" title="Editar" onClick={() => setEditing({ id: n.id, text: n.conteudo })}>
                          <Pencil aria-hidden />
                        </Button>
                      )}
                      <Button size="icon-sm" variant="tertiary" aria-label="Excluir anotação" title="Excluir" onClick={() => setDeleting(n.id)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <label htmlFor={`note-edit-${n.id}`} className="sr-only">
                      Editar anotação
                    </label>
                    <textarea
                      id={`note-edit-${n.id}`}
                      rows={3}
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ id: n.id, text: e.target.value })}
                      className={settingsInputClass}
                      maxLength={5000}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)} disabled={editSaving}>
                        Cancelar
                      </Button>
                      <Button size="sm" variant="primary" onClick={saveEdit} loading={editSaving} disabled={!editing.text.trim()}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-body text-wg-ink-secondary">{n.conteudo}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        title="Excluir anotação?"
        message="A anotação será removida do perfil. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
