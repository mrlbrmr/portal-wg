"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, Download, Trash2, FileText, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import type { ActionResult } from "@/lib/admissao/actions";
import { updateAttachmentCategory, deleteAttachment } from "@/lib/admissao/actions";

const UNCATEGORIZED = "__uncategorized__";

export interface AttachmentView {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string; // ISO
  documentTypeId: string | null;
}

interface Props {
  admissionId: string;
  canManage: boolean;
  attachments: AttachmentView[];
  documentTypes: { id: string; name: string }[];
}

const smallSelect =
  "h-8 rounded-md border border-gray-300 px-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

function formatSize(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AdmissionAttachments({ admissionId, canManage, attachments, documentTypes }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingCategory, setPendingCategory] = useState(UNCATEGORIZED);

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
    });
  }

  function handleFiles(files: FileList) {
    const categoryId = pendingCategory === UNCATEGORIZED ? "" : pendingCategory;
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        if (categoryId) fd.set("documentTypeId", categoryId);
        const res = await fetch(`/api/admissoes/${admissionId}/attachments`, {
          method: "POST",
          credentials: "same-origin",
          body: fd,
        });
        if (!res.ok) {
          let msg = "Falha no upload.";
          try {
            const j = await res.json();
            if (typeof j.error === "string") msg = j.error;
          } catch {
            /* mantém a mensagem padrão */
          }
          notify("error", `${file.name}: ${msg}`);
          return;
        }
      }
      notify("success", "Anexo(s) enviado(s).");
      router.refresh();
    });
  }

  const grouped = groupByCategory(attachments, documentTypes);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip className="w-4 h-4" /> Anexos
        </h2>
        {canManage && (
          <div className="flex items-center gap-2">
            <select
              value={pendingCategory}
              onChange={(e) => setPendingCategory(e.target.value)}
              className={`${smallSelect} w-[170px]`}
            >
              <option value={UNCATEGORIZED}>Sem categoria</option>
              {documentTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 bg-wg-green hover:bg-wg-green-bright text-black text-sm font-semibold px-3 py-1.5 rounded-full disabled:opacity-60"
            >
              <Upload className="w-4 h-4" /> {isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {attachments.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">Nenhum arquivo enviado.</p>
        )}

        {grouped.map((g) => (
          <div key={g.key} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
              <FolderOpen className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-sm text-gray-800">{g.name}</span>
              <span className="text-[11px] text-gray-500 bg-gray-200 rounded-full px-1.5">{g.files.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {g.files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50/60">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 truncate">{f.fileName}</div>
                    <div className="text-xs text-gray-400">
                      {formatSize(f.sizeBytes)} · {new Date(f.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {canManage && (
                    <select
                      value={f.documentTypeId ?? UNCATEGORIZED}
                      disabled={isPending}
                      onChange={(e) =>
                        run(() =>
                          updateAttachmentCategory(
                            admissionId,
                            f.id,
                            e.target.value === UNCATEGORIZED ? null : e.target.value
                          )
                        )
                      }
                      className={`${smallSelect} w-[150px]`}
                    >
                      <option value={UNCATEGORIZED}>Sem categoria</option>
                      {documentTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <a
                    href={`/api/admissoes/${admissionId}/attachments/${f.id}`}
                    className="p-1 text-gray-400 hover:text-wg-green-dark rounded"
                    title="Baixar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover "${f.fileName}"?`))
                          run(() => deleteAttachment(admissionId, f.id));
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByCategory(files: AttachmentView[], categories: { id: string; name: string }[]) {
  const map = new Map<string, { key: string; name: string; files: AttachmentView[] }>();
  for (const c of categories) map.set(c.id, { key: c.id, name: c.name, files: [] });
  map.set(UNCATEGORIZED, { key: UNCATEGORIZED, name: "Sem categoria", files: [] });
  for (const f of files) {
    const key = f.documentTypeId ?? UNCATEGORIZED;
    if (!map.has(key)) map.set(key, { key, name: "Sem categoria", files: [] });
    map.get(key)!.files.push(f);
  }
  return Array.from(map.values()).filter((g) => g.files.length > 0);
}
