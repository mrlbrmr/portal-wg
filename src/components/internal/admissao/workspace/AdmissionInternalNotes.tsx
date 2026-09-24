"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmissionWorkspace } from "./context";
import { EditableSection, fieldA11y, inputClass } from "./fields";

const NOTES_MAX = 5000;
/** Acima disso a leitura começa recolhida. */
const COLLAPSE_AT = 480;

/**
 * Notas internas da admissão (coluna admissions.notes). Só usuários internos leem —
 * a rota pública do formulário não seleciona esta coluna.
 */
export function AdmissionInternalNotes() {
  const { draft, saved, patch, isEditing } = useAdmissionWorkspace();
  const editing = isEditing("notas");
  const [expanded, setExpanded] = useState(false);
  const long = draft.notes.length > COLLAPSE_AT;

  return (
    <EditableSection
      section="notas"
      title="Notas internas"
      meta={
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" aria-hidden /> Visível somente para usuários internos do RH.
        </span>
      }
      editLabel={draft.notes ? "Editar" : "Adicionar nota"}
    >
      {editing ? (
        <div>
          <label htmlFor="adm-notes" className="sr-only">
            Notas internas
          </label>
          <textarea
            {...fieldA11y("adm-notes")}
            rows={6}
            value={draft.notes}
            maxLength={NOTES_MAX}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Combinados, observações do exame, pendências com o gestor…"
            className={cn(inputClass, "h-auto resize-y py-2 leading-relaxed")}
          />
          <p className="mt-1 text-right text-[12px] tabular-nums text-wg-ink-muted">
            {draft.notes.length.toLocaleString("pt-BR")} / {NOTES_MAX.toLocaleString("pt-BR")}
          </p>
        </div>
      ) : draft.notes ? (
        <div>
          <p className={cn("whitespace-pre-wrap break-words text-body text-wg-ink", long && !expanded && "line-clamp-6")}>{draft.notes}</p>
          {draft.notes !== saved.notes && <p className="mt-2 text-meta font-medium text-warning-fg">Alteração ainda não salva.</p>}
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 rounded-sm text-meta font-semibold text-wg-green-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50"
            >
              {expanded ? "Mostrar menos" : "Mostrar tudo"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-body text-wg-ink-muted">Nenhuma nota registrada.</p>
      )}
    </EditableSection>
  );
}
