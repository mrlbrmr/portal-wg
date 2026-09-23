"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { addTagsToTalents, removeTagsFromTalents, type BulkTarget } from "@/lib/talentos/actions";
import type { TagItem } from "@/lib/talentos/service";
import { TagPicker } from "./TagPicker";
import { TagChip } from "./talent-ui";

interface Props {
  open: boolean;
  mode: "add" | "remove";
  onClose: () => void;
  target: BulkTarget;
  subject: string;
  tags: TagItem[];
  onCreateTag: (name: string) => Promise<TagItem | null>;
  onDone?: () => void;
}

/** Adicionar ou remover tags de um ou vários talentos de uma vez. */
export function TagBulkDialog({ open, mode, onClose, target, subject, tags, onCreateTag, onDone }: Props) {
  const { notify } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setError(null);
    }
  }, [open, mode]);

  const submit = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const r = mode === "add" ? await addTagsToTalents(target, selected) : await removeTagsFromTalents(target, selected);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      notify("success", mode === "add" ? "Tags adicionadas." : "Tags removidas.");
      onDone?.();
      onClose();
    } catch {
      setError(mode === "add" ? "Não foi possível adicionar as tags. Tente novamente." : "Não foi possível remover as tags. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const chosen = tags.filter((t) => selected.includes(t.id));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={mode === "add" ? `Adicionar tag — ${subject}` : `Remover tag — ${subject}`}
      description={mode === "add" ? "As tags vêm do cadastro central de Tags." : "Só a etiqueta sai do perfil; nenhum outro dado é alterado."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant={mode === "add" ? "primary" : "danger"} icon={Tag} onClick={submit} loading={saving} disabled={selected.length === 0}>
            {mode === "add" ? "Adicionar" : "Remover"}
            {selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </>
      }
    >
      {chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chosen.map((t) => (
            <TagChip key={t.id} name={t.name} color={t.color} onRemove={() => setSelected((s) => s.filter((x) => x !== t.id))} />
          ))}
        </div>
      )}
      <TagPicker
        autoFocus
        tags={tags}
        selectedIds={selected}
        onToggle={(t) => setSelected((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))}
        onCreate={
          mode === "add"
            ? async (name) => {
                const tag = await onCreateTag(name);
                if (tag) setSelected((s) => (s.includes(tag.id) ? s : [...s, tag.id]));
                return tag;
              }
            : undefined
        }
      />
      {error && (
        <p role="alert" className="mt-3 text-meta text-danger-fg">
          {error}
        </p>
      )}
    </Dialog>
  );
}
