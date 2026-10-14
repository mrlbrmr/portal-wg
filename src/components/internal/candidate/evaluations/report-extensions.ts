// Extensões do editor de parecer — as MESMAS na edição e na leitura (o schema do documento
// é um só). O que entra aqui precisa estar na lista branca de sanitizeReportDoc
// (src/lib/recruitment/evaluations/document.ts), senão o servidor descarta ao salvar.

import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import type { Extensions } from "@tiptap/react";
import { safeHref } from "@/lib/recruitment/evaluations/document";

export const reportExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["mailto"],
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
      // Mesma regra do servidor: só http(s) e mailto.
      isAllowedUri: (url) => safeHref(url) !== null,
    },
  }),
  TableKit.configure({ table: { resizable: false } }),
];
