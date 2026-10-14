"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHref, type ReportDoc } from "@/lib/recruitment/evaluations/document";
import { looksLikeMarkdown, markdownToEditorHtml } from "@/lib/recruitment/evaluations/markdown";
import { reportExtensions } from "./report-extensions";

const IDLE = {
  h1: false,
  h2: false,
  h3: false,
  bold: false,
  italic: false,
  strike: false,
  bullet: false,
  ordered: false,
  quote: false,
  link: false,
  table: false,
  canUndo: false,
  canRedo: false,
};

interface Props {
  initialContent: ReportDoc;
  onChange: (doc: ReportDoc) => void;
  /** O dono do editor aplica modelos e Markdown colado por aqui. */
  onReady: (editor: Editor | null) => void;
  /** Ações à direita da barra (Usar modelo, Colar parecer…). */
  extraActions?: ReactNode;
}

/**
 * Editor do parecer (TipTap). Barra compacta com o essencial; atalhos do TipTap valem
 * (Ctrl+B/I, Ctrl+Z/Y, Ctrl+Alt+1..3, "## " vira título, "- " vira lista…). Colar texto
 * rico (do Claude/ChatGPT) preserva a formatação; colar texto puro que parece Markdown é
 * convertido na hora.
 */
export function ReportEditor({ initialContent, onChange, onReady, extraActions }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [...reportExtensions, Placeholder.configure({ placeholder: "Escreva ou cole o parecer da entrevista…" })],
    content: initialContent,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChangeRef.current(editor.getJSON() as ReportDoc);
    },
    editorProps: {
      attributes: {
        class: "report-prose min-h-[320px] px-1 py-2 focus:outline-none",
        "aria-label": "Conteúdo do parecer",
        role: "textbox",
        "aria-multiline": "true",
      },
      handlePaste(_view, event) {
        const data = event.clipboardData;
        if (!data || data.types.includes("text/html")) return false; // texto rico: o TipTap cuida
        const text = data.getData("text/plain");
        if (!text || !looksLikeMarkdown(text)) return false;
        const html = markdownToEditorHtml(text);
        if (!html || !editorRef.current) return false;
        editorRef.current.chain().focus().insertContent(html).run();
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  // O estado só é calculado a partir da 1ª transação — até lá vale o padrão (nada ativo).
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            table: e.isActive("table"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });
  const state = snapshot ?? IDLE;

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState(false);

  if (!editor) {
    return <div className="min-h-[360px]" aria-busy="true" />;
  }

  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();

  const openLink = () => {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(false);
    setLinkOpen(true);
  };
  const applyLink = () => {
    const raw = linkValue.trim();
    if (!raw) {
      run((c) => c.extendMarkRange("link").unsetLink());
      setLinkOpen(false);
      return;
    }
    const href = safeHref(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`);
    if (!href) {
      setLinkError(true);
      return;
    }
    run((c) => c.extendMarkRange("link").setLink({ href }));
    setLinkOpen(false);
  };

  return (
    <div className="report-editor flex min-h-0 flex-1 flex-col">
      <div
        role="toolbar"
        aria-label="Formatação do parecer"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-wg-border-lighter bg-white/95 py-1.5 backdrop-blur"
      >
        <Tool label="Desfazer (Ctrl+Z)" disabled={!state.canUndo} onClick={() => run((c) => c.undo())}>
          <Undo2 />
        </Tool>
        <Tool label="Refazer (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => run((c) => c.redo())}>
          <Redo2 />
        </Tool>
        <Divider />
        <Tool label="Título 1 (Ctrl+Alt+1)" active={state.h1} onClick={() => run((c) => c.toggleHeading({ level: 1 }))}>
          <Heading1 />
        </Tool>
        <Tool label="Título 2 (Ctrl+Alt+2)" active={state.h2} onClick={() => run((c) => c.toggleHeading({ level: 2 }))}>
          <Heading2 />
        </Tool>
        <Tool label="Título 3 (Ctrl+Alt+3)" active={state.h3} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}>
          <Heading3 />
        </Tool>
        <Divider />
        <Tool label="Negrito (Ctrl+B)" active={state.bold} onClick={() => run((c) => c.toggleBold())}>
          <Bold />
        </Tool>
        <Tool label="Itálico (Ctrl+I)" active={state.italic} onClick={() => run((c) => c.toggleItalic())}>
          <Italic />
        </Tool>
        <Tool label="Tachado (Ctrl+Shift+S)" active={state.strike} onClick={() => run((c) => c.toggleStrike())}>
          <Strikethrough />
        </Tool>
        <Tool label="Link (Ctrl+K)" active={state.link || linkOpen} onClick={openLink}>
          <Link2 />
        </Tool>
        <Divider />
        <Tool label="Lista com marcadores (Ctrl+Shift+8)" active={state.bullet} onClick={() => run((c) => c.toggleBulletList())}>
          <List />
        </Tool>
        <Tool label="Lista numerada (Ctrl+Shift+7)" active={state.ordered} onClick={() => run((c) => c.toggleOrderedList())}>
          <ListOrdered />
        </Tool>
        <Tool label="Citação / destaque (Ctrl+Shift+B)" active={state.quote} onClick={() => run((c) => c.toggleBlockquote())}>
          <Quote />
        </Tool>
        <Tool label="Divisor" onClick={() => run((c) => c.setHorizontalRule())}>
          <Minus />
        </Tool>
        <Tool
          label={state.table ? "Já está numa tabela" : "Inserir tabela (3 × 3)"}
          disabled={state.table}
          onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
        >
          <Table2 />
        </Tool>
        {state.table && (
          <>
            <Tool label="Adicionar linha abaixo" onClick={() => run((c) => c.addRowAfter())}>
              <Rows3 />
            </Tool>
            <Tool label="Adicionar coluna à direita" onClick={() => run((c) => c.addColumnAfter())}>
              <Columns3 />
            </Tool>
            <TableDelete editor={editor} />
          </>
        )}
        {extraActions && <div className="ml-auto flex items-center gap-1 pl-2">{extraActions}</div>}
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-wg-border-lighter py-2">
          <label htmlFor="report-link" className="text-[12px] font-medium text-wg-ink-muted">
            Link
          </label>
          <input
            id="report-link"
            autoFocus
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
                editor.commands.focus();
              }
            }}
            placeholder="https://"
            aria-invalid={linkError || undefined}
            aria-describedby={linkError ? "report-link-error" : undefined}
            className="h-8 min-w-0 flex-1 basis-56 rounded-control border border-wg-border-light px-2.5 text-body outline-none focus:border-wg-green focus:ring-2 focus:ring-wg-green/30"
          />
          <button type="button" onClick={applyLink} className="h-8 rounded-control px-2.5 text-[13px] font-semibold text-wg-green-dark hover:bg-wg-hover-light">
            Aplicar
          </button>
          {state.link && (
            <button
              type="button"
              onClick={() => {
                run((c) => c.extendMarkRange("link").unsetLink());
                setLinkOpen(false);
              }}
              className="h-8 rounded-control px-2.5 text-[13px] font-medium text-wg-ink-muted hover:bg-wg-hover-light"
            >
              Remover link
            </button>
          )}
          {linkError && (
            <p id="report-link-error" className="basis-full text-[12px] text-danger-fg">
              Use um endereço http(s) ou mailto.
            </p>
          )}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="flex-1 pt-3"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openLink();
          }
        }}
      />
    </div>
  );
}

function TableDelete({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <Tool label="Excluir da tabela…" onClick={() => setOpen((v) => !v)} active={open}>
        <Trash2 />
      </Tool>
      {open && (
        <span
          role="menu"
          className="absolute left-0 top-9 z-20 flex w-44 flex-col rounded-control border border-wg-border-lighter bg-white py-1 shadow-[0_8px_24px_rgba(26,34,19,.12)]"
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { label: "Excluir linha", fn: () => editor.chain().focus().deleteRow().run() },
            { label: "Excluir coluna", fn: () => editor.chain().focus().deleteColumn().run() },
            { label: "Excluir tabela", fn: () => editor.chain().focus().deleteTable().run() },
          ].map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                it.fn();
                setOpen(false);
              }}
              className="px-3 py-1.5 text-left text-[13px] text-wg-ink hover:bg-wg-hover-light"
            >
              {it.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-wg-border-light" aria-hidden />;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-control transition-colors [&_svg]:h-4 [&_svg]:w-4",
        "disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wg-green/50",
        active ? "bg-wg-hover-light text-wg-green-dark" : "text-wg-ink-muted hover:bg-wg-hover-light hover:text-wg-ink"
      )}
    >
      {children}
    </button>
  );
}
