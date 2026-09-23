"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { cn, normalizeText } from "@/lib/utils";
import { cleanTagName, sameTagName } from "@/lib/talentos/crm";
import type { TagItem } from "@/lib/talentos/service";

interface Props {
  tags: TagItem[];
  selectedIds: string[];
  onToggle: (tag: TagItem) => void;
  /** Cria no cadastro central (Configurações › Cadastros › Tags). Ausente = sem criação. */
  onCreate?: (name: string) => Promise<TagItem | null>;
  label?: string;
  autoFocus?: boolean;
}

/**
 * Seleção de tags do cadastro central. A busca ignora acentos e caixa; "Criar" só aparece
 * quando não há tag com o mesmo nome (Excel = excel = EXCEL), evitando duplicatas.
 */
export function TagPicker({ tags, selectedIds, onToggle, onCreate, label = "Buscar tag", autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q ? tags.filter((t) => normalizeText(t.name).includes(q)) : tags;
  }, [tags, query]);

  const clean = cleanTagName(query);
  const canCreate = Boolean(onCreate && clean && !tags.some((t) => sameTagName(t.name, clean)));
  const options = filtered.length + (canCreate ? 1 : 0);

  const create = async () => {
    if (!onCreate || !canCreate || creating) return;
    setCreating(true);
    const tag = await onCreate(clean);
    setCreating(false);
    if (tag) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  };

  const choose = (i: number) => {
    if (i < filtered.length) onToggle(filtered[i]);
    else void create();
  };

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wg-ink-muted" aria-hidden />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, Math.max(options - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (options > 0) choose(active);
            }
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options > 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder={onCreate ? "Buscar ou criar tag…" : "Buscar tag…"}
          className="h-9 w-full rounded-control border border-wg-border-light bg-white pl-8 pr-3 text-[13px] text-wg-ink placeholder:text-wg-ink-muted focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30"
        />
      </label>
      <ul
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Tags"
        className="mt-1.5 max-h-56 overflow-y-auto rounded-control border border-wg-border-lighter bg-white py-1"
      >
        {filtered.map((t, i) => {
          const selected = selectedIds.includes(t.id);
          return (
            <li
              key={t.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={selected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onToggle(t)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-wg-ink",
                i === active && "bg-wg-bg"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  selected ? "border-wg-green-dark bg-wg-green-dark text-white" : "border-wg-border-light bg-white"
                )}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
              <span className="truncate">{t.name}</span>
            </li>
          );
        })}
        {canCreate && (
          <li
            id={`${listId}-${filtered.length}`}
            role="option"
            aria-selected={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void create()}
            onMouseEnter={() => setActive(filtered.length)}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-wg-green-dark",
              active === filtered.length && "bg-wg-bg"
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {creating ? "Criando…" : `Criar tag "${clean}"`}
          </li>
        )}
        {options === 0 && (
          <li className="px-2.5 py-2 text-meta text-wg-ink-muted">
            {tags.length === 0 ? "Nenhuma tag cadastrada ainda." : "Nenhuma tag encontrada."}
          </li>
        )}
      </ul>
      {onCreate && (
        <p className="mt-1.5 text-[11.5px] text-wg-ink-muted">
          Tags novas entram no cadastro central (Configurações › Cadastros › Tags).
        </p>
      )}
    </div>
  );
}
