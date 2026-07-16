"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "rich-editor min-h-[120px] px-3 py-2.5 text-sm text-gray-900 focus:outline-none leading-relaxed",
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isBulletList: ctx.editor?.isActive("bulletList") ?? false,
      isOrderedList: ctx.editor?.isActive("orderedList") ?? false,
    }),
  });

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg bg-white min-h-[164px]" />
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-wg-green/40 focus-within:border-wg-green">
      <div className="flex items-center gap-0.5 border-b border-gray-200 px-2 py-1.5 bg-gray-50 rounded-t-lg">
        <ToolbarButton
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          active={state?.isBold ?? false}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          active={state?.isItalic ?? false}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <ToolbarButton
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          active={state?.isBulletList ?? false}
          title="Lista com marcadores"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          active={state?.isOrderedList ?? false}
          title="Lista numerada"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  onMouseDown,
  active,
  title,
  children,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-wg-green/20 text-wg-green-dark"
          : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
