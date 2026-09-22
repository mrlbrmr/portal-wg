"use client";

import { useState } from "react";
import { History, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { CandidateAvatar } from "@/components/internal/candidates/CandidateAvatar";
import { NOTE_MAX_LENGTH, type ApplicationNote } from "@/lib/application-notes";
import { ConfirmDialog } from "./DialogShell";
import { formatDateAtTime, formatRelativeDayTime, type Loadable } from "./types";

interface Props {
  applicationId: string;
  notes: Loadable<ApplicationNote>;
  currentUserId: string | null;
  canManage: boolean;
  /** Rascunho da nova anotação — mora no Quick View para sobreviver à troca de aba. */
  draft: string;
  onDraftChange: (value: string) => void;
  saving: boolean;
  onCreate: () => void;
  onNotesChange: (update: (items: ApplicationNote[]) => ApplicationNote[]) => void;
  onRetry: () => void;
  /** Campo único antigo (applications.notes) — inclui motivos de reprovação. */
  legacyNotes: string | null;
  onSaveLegacy: (value: string) => Promise<boolean>;
}

const textarea =
  "w-full resize-y rounded-control border border-wg-border-light bg-white px-3 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";

/**
 * Anotações da equipe: uma por registro, com autor e data. Quem escreveu pode editar e
 * excluir (a RLS garante o mesmo no banco). O campo único antigo continua visível como
 * "Anotações anteriores".
 */
export function CandidateNotes({
  applicationId,
  notes,
  currentUserId,
  canManage,
  draft,
  onDraftChange,
  saving,
  onCreate,
  onNotesChange,
  onRetry,
  legacyNotes,
  onSaveLegacy,
}: Props) {
  const { notify } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [toDelete, setToDelete] = useState<ApplicationNote | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveEdit = async (note: ApplicationNote) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes/${note.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editText }),
      });
      const j = (await res.json().catch(() => ({}))) as { note?: ApplicationNote; error?: string };
      if (!res.ok || !j.note) {
        notify("error", j.error ?? "Não foi possível salvar a anotação.");
        return;
      }
      onNotesChange((items) => items.map((n) => (n.id === note.id ? (j.note as ApplicationNote) : n)));
      setEditingId(null);
      notify("success", "Anotação atualizada.");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes/${toDelete.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        notify("error", j.error ?? "Não foi possível excluir a anotação.");
        return;
      }
      onNotesChange((items) => items.filter((n) => n.id !== toDelete.id));
      setToDelete(null);
      notify("success", "Anotação excluída.");
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  const items = notes.items;

  return (
    <div className="space-y-4">
      {canManage ? (
        <div>
          <label htmlFor="qv-new-note" className="sr-only">
            Nova anotação
          </label>
          <textarea
            id="qv-new-note"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && draft.trim() && !saving) {
                e.preventDefault();
                onCreate();
              }
            }}
            rows={draft.split("\n").length > 3 ? 5 : 3}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Adicionar anotação…"
            aria-describedby="qv-new-note-help"
            className={textarea}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p id="qv-new-note-help" className="inline-flex items-center gap-1.5 text-[12px] text-wg-ink-muted">
              <Lock className="h-3 w-3" aria-hidden />
              Visibilidade: Equipe de R&amp;S
              <span className="hidden sm:inline">· Ctrl+Enter para salvar</span>
            </p>
            <div className="flex gap-1.5">
              {draft.trim() && !saving && (
                <Button size="sm" variant="tertiary" onClick={() => onDraftChange("")}>
                  Descartar
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={onCreate} disabled={!draft.trim()} loading={saving}>
                Salvar anotação
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-meta text-wg-ink-muted">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Somente administradores de RH adicionam anotações.
        </p>
      )}

      {items === null ? (
        notes.error ? (
          <p className="text-body text-danger-fg">
            Não foi possível carregar as anotações.{" "}
            <button type="button" onClick={onRetry} className="font-semibold text-wg-green-dark hover:underline">
              Tentar novamente
            </button>
          </p>
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Carregando anotações">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : items.length === 0 && !legacyNotes?.trim() ? (
        <p className="text-meta text-wg-ink-muted">Nenhuma anotação adicionada.</p>
      ) : (
        <ol className="space-y-4" aria-label="Anotações">
          {items.map((n) => {
            const own = canManage && currentUserId !== null && n.authorId === currentUserId;
            const edited = new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 60_000;
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="flex gap-3">
                <CandidateAvatar name={n.authorName} seed={n.authorId} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 text-meta">
                      <span className="font-semibold text-wg-ink">{n.authorName}</span>
                      <span className="text-wg-ink-muted">
                        {" · "}
                        <time dateTime={n.createdAt} title={formatDateAtTime(n.createdAt)}>
                          {formatRelativeDayTime(n.createdAt)}
                        </time>
                        {edited && <span title={`Editada ${formatRelativeDayTime(n.updatedAt)}`}> · editada</span>}
                      </span>
                    </p>
                    {own && !isEditing && (
                      <DropdownMenu
                        ariaLabel="Ações da anotação"
                        title="Ações da anotação"
                        triggerClassName={buttonVariants({ variant: "tertiary", size: "icon-sm" })}
                        trigger={<MoreHorizontal aria-hidden />}
                        items={[
                          {
                            label: "Editar",
                            icon: Pencil,
                            onSelect: () => {
                              setEditingId(n.id);
                              setEditText(n.body);
                            },
                          },
                          { label: "Excluir…", icon: Trash2, danger: true, onSelect: () => setToDelete(n) },
                        ]}
                      />
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1.5">
                      <label htmlFor={`qv-edit-${n.id}`} className="sr-only">
                        Editar anotação
                      </label>
                      <textarea
                        id={`qv-edit-${n.id}`}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingId(null);
                          }
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            void saveEdit(n);
                          }
                        }}
                        rows={Math.min(8, Math.max(3, editText.split("\n").length))}
                        maxLength={NOTE_MAX_LENGTH}
                        autoFocus
                        className={textarea}
                      />
                      <div className="mt-1.5 flex justify-end gap-1.5">
                        <Button size="sm" variant="tertiary" onClick={() => setEditingId(null)} disabled={savingEdit}>
                          Cancelar
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => void saveEdit(n)} loading={savingEdit} disabled={!editText.trim()}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-body text-wg-ink-secondary">{n.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {legacyNotes?.trim() && <LegacyNotes value={legacyNotes} canManage={canManage} onSave={onSaveLegacy} />}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir anotação?"
        description="A anotação será removida para toda a equipe. Esta ação não pode ser desfeita."
        confirmLabel="Excluir anotação"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

/**
 * Campo único de anotações de antes (applications.notes): sem autor por trecho. Continua
 * editável por quem tem permissão — é onde o motivo de reprovação é registrado.
 */
function LegacyNotes({ value, canManage, onSave }: { value: string; canManage: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  return (
    <section className="border-t border-wg-border-lighter pt-4" aria-labelledby="qv-legacy-notes">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 id="qv-legacy-notes" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-wg-ink">
          <History className="h-3.5 w-3.5 text-wg-ink-muted" aria-hidden />
          Anotações anteriores
        </h3>
        {canManage && !editing && (
          <Button
            size="sm"
            variant="tertiary"
            icon={Pencil}
            onClick={() => {
              setText(value);
              setEditing(true);
            }}
          >
            Editar
          </Button>
        )}
      </div>
      <p className="mb-2 text-[12px] text-wg-ink-muted">Registro sem autor por trecho; inclui motivos de reprovação.</p>
      {editing ? (
        <>
          <label htmlFor="qv-legacy-edit" className="sr-only">
            Anotações anteriores
          </label>
          <textarea
            id="qv-legacy-edit"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={5000}
            className={textarea}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="sm" variant="tertiary" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              disabled={text === value}
              onClick={async () => {
                setSaving(true);
                const ok = await onSave(text);
                setSaving(false);
                if (ok) setEditing(false);
              }}
            >
              Salvar
            </Button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap break-words rounded-control bg-wg-bg/60 px-3 py-2 text-body text-wg-ink-secondary">{value}</p>
      )}
    </section>
  );
}
