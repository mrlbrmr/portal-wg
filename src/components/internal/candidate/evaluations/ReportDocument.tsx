"use client";

import { useLayoutEffect, useRef } from "react";
import { getSchema } from "@tiptap/react";
import { DOMSerializer, Node as PMNode, type Schema } from "@tiptap/pm/model";
import { cn } from "@/lib/utils";
import { docToPlainText, type ReportDoc } from "@/lib/recruitment/evaluations/document";
import { reportExtensions } from "./report-extensions";

let schemaCache: Schema | null = null;
const reportSchema = () => (schemaCache ??= getSchema(reportExtensions));

/**
 * Leitura do parecer: o JSON salvo é montado pelo schema do editor (ProseMirror) direto em
 * nós do DOM — sem innerHTML. Nó fora do schema não renderiza; se o documento estiver
 * corrompido, cai para o texto puro.
 */
export function ReportDocument({ doc, className }: { doc: ReportDoc; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const schema = reportSchema();
      const node = PMNode.fromJSON(schema, doc);
      node.check();
      const fragment = DOMSerializer.fromSchema(schema).serializeFragment(node.content);
      // Tabelas largas rolam dentro do documento, não a página inteira.
      fragment.querySelectorAll("table").forEach((table) => {
        const wrap = document.createElement("div");
        wrap.className = "tableWrapper";
        table.replaceWith(wrap);
        wrap.appendChild(table);
      });
      el.replaceChildren(fragment);
    } catch {
      const pre = document.createElement("p");
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = docToPlainText(doc);
      el.replaceChildren(pre);
    }
  }, [doc]);

  return <div ref={ref} className={cn("report-prose", className)} />;
}
