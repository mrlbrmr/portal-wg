"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import type { ActionResult } from "@/lib/admissao/actions";
import { updateAttachmentCategory, deleteAttachment } from "@/lib/admissao/actions";

const UNCATEGORIZED = "__uncategorized__";

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string; // ISO
  documentTypeId: string | null;
}

interface DocumentType {
  id: string;
  name: string;
  required: boolean;
}

interface Props {
  admissionId: string;
  canManage: boolean;
  attachments: AttachmentView[];
  documentTypes: DocumentType[];
}

interface Section {
  key: string;
  name: string;
  required: boolean;
  files: AttachmentView[];
}

const smallSelect =
  "h-8 rounded-md border border-gray-300 px-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

function isImage(mime: string | null) { return !!mime && mime.startsWith("image/"); }
function isPdf(mime: string | null) { return mime === "application/pdf"; }

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

  const [previewItem, setPreviewItem] = useState<AttachmentView | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePreview(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewItem]);

  // Busca o arquivo e cria um blob URL local — contorna X-Frame-Options/CSP do servidor.
  const openPreview = useCallback(async (f: AttachmentView) => {
    setPreviewItem(f);
    setPreviewBlobUrl(null);
    if (!isImage(f.mimeType) && !isPdf(f.mimeType)) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/admissoes/${admissionId}/attachments/${f.id}?inline=true`,
        { credentials: "same-origin" }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setPreviewBlobUrl(url);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [admissionId]);

  function closePreview() {
    setPreviewItem(null);
    setPreviewBlobUrl(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

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

  const sections = buildSections(attachments, documentTypes);

  // % de documentos obrigatórios com ao menos um anexo.
  const requiredTypes = documentTypes.filter((d) => d.required);
  const requiredDone = requiredTypes.filter((d) =>
    attachments.some((a) => a.documentTypeId === d.id)
  ).length;
  const reqTotal = requiredTypes.length;
  const reqPct = reqTotal > 0 ? Math.round((requiredDone / reqTotal) * 100) : 0;

  return (
    <>
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Documentos
          </h2>
          {reqTotal > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {requiredDone} de {reqTotal} obrigatórios · {reqPct}%
            </p>
          )}
        </div>
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
        {/* Barra de progresso dos obrigatórios */}
        {reqTotal > 0 && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${reqPct === 100 ? "bg-wg-green" : "bg-amber-400"}`}
              style={{ width: `${reqPct}%` }}
            />
          </div>
        )}

        {sections.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum tipo de documento configurado.
          </p>
        )}

        {sections.map((s) => {
          const isEmptyRequired = s.required && s.files.length === 0;
          return (
            <div
              key={s.key}
              className={`border rounded-lg overflow-hidden ${
                isEmptyRequired ? "border-amber-300" : "border-gray-200"
              }`}
            >
              <div
                className={`flex items-center gap-2 px-3 py-2 ${
                  isEmptyRequired ? "bg-amber-50" : "bg-gray-50"
                }`}
              >
                <FolderOpen
                  className={`w-4 h-4 shrink-0 ${isEmptyRequired ? "text-amber-500" : "text-gray-400"}`}
                />
                <span className="font-medium text-sm text-gray-800">{s.name}</span>
                {s.required && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                    Obrigatório
                  </span>
                )}
                {s.files.length > 0 && (
                  <span className="text-[11px] text-gray-500 bg-gray-200 rounded-full px-1.5">
                    {s.files.length}
                  </span>
                )}
                {s.required &&
                  (s.files.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-wg-green ml-auto shrink-0" />
                  ) : (
                    <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" /> Pendente
                    </span>
                  ))}
              </div>

              {s.files.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-3">Nenhum arquivo nesta seção.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {s.files.map((f) => (
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
                      <button
                        type="button"
                        onClick={() => openPreview(f)}
                        className="p-1 text-gray-400 hover:text-wg-green-dark rounded"
                        title="Pré-visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* Modal de pré-visualização */}
    {previewItem && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        onClick={closePreview}
      >
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
          style={{ maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-gray-800 truncate min-w-0">
              {previewItem.fileName}
            </span>
            <a
              href={`/api/admissoes/${admissionId}/attachments/${previewItem.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-wg-green-dark shrink-0"
              title="Baixar"
            >
              <Download className="w-3.5 h-3.5" /> Baixar
            </a>
            <button
              onClick={closePreview}
              className="p-1 text-gray-400 hover:text-gray-700 rounded shrink-0"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-[300px]">
            {previewLoading && (
              <p className="text-sm text-gray-400">Carregando…</p>
            )}
            {!previewLoading && previewBlobUrl && isImage(previewItem.mimeType) && (
              <img
                src={previewBlobUrl}
                alt={previewItem.fileName}
                className="max-w-full max-h-[75vh] object-contain p-4"
              />
            )}
            {!previewLoading && previewBlobUrl && isPdf(previewItem.mimeType) && (
              <iframe
                src={previewBlobUrl}
                title={previewItem.fileName}
                className="w-full"
                style={{ height: "75vh" }}
              />
            )}
            {!previewLoading && !previewBlobUrl &&
              !isImage(previewItem.mimeType) && !isPdf(previewItem.mimeType) && (
              <div className="text-center p-10">
                <FileText className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">
                  Este formato não suporta pré-visualização.
                </p>
                <a
                  href={`/api/admissoes/${admissionId}/attachments/${previewItem.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-wg-green-dark hover:underline"
                >
                  <Download className="w-4 h-4" /> Baixar arquivo
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/**
 * Uma seção por tipo de documento (na ordem de sortOrder), mesmo sem arquivos —
 * assim os obrigatórios pendentes ficam visíveis. "Sem categoria" só aparece se
 * houver arquivos soltos.
 */
function buildSections(files: AttachmentView[], types: DocumentType[]): Section[] {
  const sections: Section[] = types.map((t) => ({
    key: t.id,
    name: t.name,
    required: t.required,
    files: files.filter((f) => f.documentTypeId === t.id),
  }));

  const knownIds = new Set(types.map((t) => t.id));
  const uncategorized = files.filter((f) => !f.documentTypeId || !knownIds.has(f.documentTypeId));
  if (uncategorized.length > 0) {
    sections.push({
      key: UNCATEGORIZED,
      name: "Sem categoria",
      required: false,
      files: uncategorized,
    });
  }

  return sections;
}
