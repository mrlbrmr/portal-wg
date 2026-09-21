"use client";

import { Button } from "@/components/ui/Button";
import { Section } from "./Section";

interface Props {
  /** Texto salvo no banco (applications.notes). */
  saved: string;
  /** Rascunho em edição (controlado pelo drawer, que salva ao fechar). */
  draft: string;
  onDraftChange: (value: string) => void;
  canManage: boolean;
  saving: boolean;
  savedAt: Date | null;
  onSave: () => void;
}

/**
 * "Anotações da equipe". O backend guarda UM campo de texto por candidatura (sem autor
 * nem data por nota) — por isso é um bloco compartilhado, com o salvar colado ao campo.
 * Histórico de notas por autor exige tabela própria (dependência futura).
 */
export function TeamNotes({ saved, draft, onDraftChange, canManage, saving, savedAt, onSave }: Props) {
  const dirty = draft !== saved;

  if (!canManage) {
    return (
      <Section title="Anotações da equipe">
        {saved.trim() ? (
          <p className="whitespace-pre-wrap text-body text-wg-ink">{saved}</p>
        ) : (
          <p className="text-body text-wg-ink-muted">Nenhuma anotação da equipe.</p>
        )}
      </Section>
    );
  }

  return (
    <Section title="Anotações da equipe">
      <label htmlFor="candidate-notes" className="sr-only">
        Anotações da equipe
      </label>
      <textarea
        id="candidate-notes"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && dirty && !saving) {
            e.preventDefault();
            onSave();
          }
        }}
        rows={draft.split("\n").length > 4 ? 6 : 4}
        maxLength={5000}
        placeholder={saved.trim() ? "" : "Nenhuma anotação da equipe. Escreva aqui observações sobre o candidato…"}
        aria-describedby="candidate-notes-help"
        className="w-full resize-y rounded-control border border-wg-border-light bg-white px-3 py-2 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/70 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p id="candidate-notes-help" className="text-meta text-wg-ink-muted" aria-live="polite">
          {saving
            ? "Salvando…"
            : dirty
            ? "Alterações não salvas · Ctrl+Enter para salvar"
            : savedAt
            ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : "Visível só para a equipe de RH."}
        </p>
        <div className="flex gap-1.5">
          {dirty && !saving && (
            <Button size="sm" variant="tertiary" onClick={() => onDraftChange(saved)}>
              Descartar
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={onSave} disabled={!dirty} loading={saving}>
            Salvar anotação
          </Button>
        </div>
      </div>
    </Section>
  );
}
