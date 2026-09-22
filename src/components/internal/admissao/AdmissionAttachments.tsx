"use client";

import { useEffect, useRef, useState, useTransition, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, FileText, Eye, X, FilePlus2, FolderOpen, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, buttonVariants } from "@/components/ui/Button";
import { QuickFilterChips } from "@/components/ui/FilterPopover";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ActionResult } from "@/lib/admissao/actions";
import { updateAttachmentCategory, deleteAttachment, revalidateAttachmentsWithAI } from "@/lib/admissao/actions";
import { DOCUMENT_STATUS_META, fileStatus, sectionStatus, type DocumentStatus } from "@/lib/admissao/document-status";
import { cn } from "@/lib/utils";

const UNCATEGORIZED = "__uncategorized__";

export interface AttachmentView {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string; // ISO
  documentTypeId: string | null;
  aiStatus?: string | null;
  aiReason?: string | null;
  /** Nome de quem enviou (quando registrado). */
  uploadedByName?: string | null;
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
  status: DocumentStatus;
}

type DocFilter = "todos" | "pendentes" | "enviados";

const smallSelect =
  "h-8 rounded-control border border-wg-border-light bg-white px-2 text-[12.5px] text-wg-ink focus:border-wg-green-dark focus:outline-none focus:ring-2 focus:ring-wg-green/30";

function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}
function isPdf(mime: string | null) {
  return mime === "application/pdf";
}

function formatSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export function AdmissionAttachments({ admissionId, canManage, attachments, documentTypes }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [uploadCategory, setUploadCategory] = useState(UNCATEGORIZED);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<DocFilter>("todos");
  const [toDelete, setToDelete] = useState<AttachmentView | null>(null);

  const [previewItem, setPreviewItem] = useState<AttachmentView | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const closePreview = useCallback(() => {
    setPreviewItem(null);
    setPreviewBlobUrl(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewItem, closePreview]);

  // Busca o arquivo e cria um blob URL local — contorna X-Frame-Options/CSP do servidor.
  const openPreview = useCallback(
    async (f: AttachmentView) => {
      setPreviewItem(f);
      setPreviewBlobUrl(null);
      if (!isImage(f.mimeType) && !isPdf(f.mimeType)) return;
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/admissoes/${admissionId}/attachments/${f.id}?inline=true`, {
          credentials: "same-origin",
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = url;
          setPreviewBlobUrl(url);
        } else {
          notify("error", "Não foi possível carregar a pré-visualização.");
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [admissionId, notify]
  );

  function run(fn: () => Promise<ActionResult>, success?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) notify("error", res.error);
      else if (success) notify("success", success);
    });
  }

  function revalidateAll() {
    startTransition(async () => {
      const res = await revalidateAttachmentsWithAI(admissionId);
      if (!res.ok) notify("error", res.error);
      else notify("success", `Validação concluída: ${res.approved} de ${res.total} documentos aprovados pela IA.`);
      router.refresh();
    });
  }

  function uploadFiles(files: FileList | File[], categoryId: string) {
    const list = Array.from(files);
    if (list.length === 0) return;
    startTransition(async () => {
      let sent = 0;
      for (const file of list) {
        const fd = new FormData();
        fd.set("file", file);
        if (categoryId && categoryId !== UNCATEGORIZED) fd.set("documentTypeId", categoryId);
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
          continue;
        }
        sent++;
      }
      if (sent > 0) {
        notify("success", sent === 1 ? "Documento adicionado." : `${sent} documentos adicionados.`);
        router.refresh();
      }
    });
  }

  function pickFor(categoryId: string) {
    setUploadCategory(categoryId);
    // Aguarda o estado para o onChange do input usar a categoria certa.
    requestAnimationFrame(() => inputRef.current?.click());
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!canManage || isPending) return;
    uploadFiles(e.dataTransfer.files, uploadCategory);
  }

  const sections = buildSections(attachments, documentTypes);
  const requiredTypes = documentTypes.filter((d) => d.required);
  const requiredDone = requiredTypes.filter((d) => attachments.some((a) => a.documentTypeId === d.id)).length;
  const reqTotal = requiredTypes.length;
  const reqPct = reqTotal > 0 ? Math.round((requiredDone / reqTotal) * 100) : 0;
  const pendingCount = sections.filter((s) => s.status === "PENDING").length;
  const reviewCount = sections.filter((s) => s.status === "NEEDS_REVIEW" || s.status === "AI_REJECTED").length;

  const visibleSections = sections.filter((s) =>
    filter === "pendentes"
      ? s.status === "PENDING" || s.status === "NEEDS_REVIEW" || s.status === "AI_REJECTED"
      : filter === "enviados"
        ? s.files.length > 0
        : true
  );

  return (
    <>
      <section aria-labelledby="docs-title" className="rounded-card border border-wg-border-lighter bg-white">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-wg-border-lighter px-5 py-4">
          <div className="min-w-[220px] flex-1">
            <h2 id="docs-title" className="font-sora text-section-title text-wg-ink">
              Documentos
            </h2>
            {reqTotal > 0 ? (
              <>
                <p className="mt-0.5 text-meta text-wg-ink-muted">
                  {requiredDone} de {reqTotal} obrigatórios enviados · {reqPct}%
                  {reviewCount > 0 && (
                    <span className="text-warning-fg">
                      {" "}
                      · {reviewCount} {reviewCount === 1 ? "precisa" : "precisam"} de revisão
                    </span>
                  )}
                </p>
                <ProgressBar
                  className="mt-2 max-w-xs"
                  value={reqPct}
                  tone={reqPct === 100 ? "success" : "warning"}
                  label="Documentos obrigatórios enviados"
                />
              </>
            ) : (
              <p className="mt-0.5 text-meta text-wg-ink-muted">Nenhum documento obrigatório configurado.</p>
            )}
          </div>
          {canManage && reviewCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              disabled={isPending}
              onClick={revalidateAll}
              title="Refaz a validação automática dos documentos que ainda não foram aprovados pela IA"
            >
              {isPending ? "Validando…" : "Validar novamente com IA"}
            </Button>
          )}
          <QuickFilterChips<DocFilter>
            label="Filtrar documentos"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "todos", label: "Todos", count: sections.length },
              { value: "pendentes", label: "Pendentes", count: pendingCount + reviewCount },
              { value: "enviados", label: "Enviados", count: sections.filter((s) => s.files.length > 0).length },
            ]}
          />
        </header>

        {canManage && (
          <div className="px-5 pt-4">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                if (e.target.files?.length) {
                  uploadFiles(e.target.files, uploadCategory);
                  e.target.value = "";
                }
              }}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-5 text-center transition-colors sm:flex-row sm:text-left",
                dragOver ? "border-wg-green-dark bg-wg-sidebar" : "border-wg-border-light bg-wg-bg"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-wg-green-dark">
                <Upload className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-wg-ink">
                  {isPending ? "Enviando documentos…" : "Arraste os documentos aqui"}
                </p>
                <p className="text-meta text-wg-ink-muted">
                  ou{" "}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => inputRef.current?.click()}
                    className="font-semibold text-wg-green-dark underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    escolha arquivos do computador
                  </button>{" "}
                  · PDF ou imagem, até 4,5 MB
                </p>
              </div>
              <label className="flex flex-col gap-1 text-left">
                <span className="text-label text-wg-ink-muted">Categoria do documento</span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className={cn(smallSelect, "h-9 w-[200px]")}
                >
                  <option value={UNCATEGORIZED}>Sem categoria</option>
                  {documentTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.required ? " (obrigatório)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="p-5">
          {sections.length === 0 ? (
            <EmptyState
              compact
              icon={FolderOpen}
              title="Nenhum tipo de documento configurado"
              description="Cadastre os tipos em Admissões → Configurações → Categorias."
            />
          ) : visibleSections.length === 0 ? (
            <EmptyState
              compact
              icon={FolderOpen}
              title={filter === "pendentes" ? "Nenhum documento pendente" : "Nenhum documento enviado ainda"}
            />
          ) : (
            <ul className="divide-y divide-wg-border-lighter rounded-card border border-wg-border-lighter">
              {visibleSections.map((s) => {
                const meta = DOCUMENT_STATUS_META[s.status];
                return (
                  <li key={s.key} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-wg-ink">{s.name}</span>
                      {s.required && <span className="text-[11.5px] text-wg-ink-muted">Obrigatório</span>}
                      <StatusBadge tone={meta.tone} hint={meta.hint} className="ml-auto">
                        {meta.label}
                      </StatusBadge>
                      {canManage && s.key !== UNCATEGORIZED && (
                        <Button
                          size="sm"
                          variant={s.files.length === 0 ? "secondary" : "tertiary"}
                          icon={FilePlus2}
                          disabled={isPending}
                          onClick={() => pickFor(s.key)}
                          aria-label={`${s.files.length === 0 ? "Fazer upload" : "Adicionar arquivo"} — ${s.name}`}
                        >
                          {s.files.length === 0 ? "Fazer upload" : "Adicionar"}
                        </Button>
                      )}
                    </div>

                    {s.files.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {s.files.map((f) => {
                          const fs = DOCUMENT_STATUS_META[fileStatus(f.aiStatus)];
                          return (
                            <li
                              key={f.id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control bg-wg-bg px-3 py-2"
                            >
                              <FileText className="h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-wg-ink" title={f.fileName}>
                                  {f.fileName}
                                </p>
                                <p className="text-[12px] text-wg-ink-muted">
                                  Enviado em {formatSentAt(f.createdAt)}
                                  {f.uploadedByName ? ` por ${f.uploadedByName}` : ""}
                                  {f.sizeBytes ? ` · ${formatSize(f.sizeBytes)}` : ""}
                                </p>
                                {f.aiReason && (fs.tone === "warning" || fs.tone === "danger") && (
                                  <p className={cn("mt-1 text-[12px]", fs.tone === "danger" ? "text-danger-fg" : "text-warning-fg")}>
                                    <span className="font-semibold">Motivo:</span> {f.aiReason}
                                  </p>
                                )}
                              </div>
                              {canManage && (
                                <select
                                  aria-label={`Categoria de ${f.fileName}`}
                                  value={f.documentTypeId ?? UNCATEGORIZED}
                                  disabled={isPending}
                                  onChange={(e) =>
                                    run(
                                      () =>
                                        updateAttachmentCategory(
                                          admissionId,
                                          f.id,
                                          e.target.value === UNCATEGORIZED ? null : e.target.value
                                        ),
                                      "Categoria atualizada."
                                    )
                                  }
                                  className={cn(smallSelect, "w-[160px]")}
                                >
                                  <option value={UNCATEGORIZED}>Sem categoria</option>
                                  {documentTypes.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="tertiary" icon={Eye} onClick={() => openPreview(f)}>
                                  Visualizar
                                </Button>
                                <a
                                  href={`/api/admissoes/${admissionId}/attachments/${f.id}`}
                                  className={buttonVariants({ variant: "tertiary", size: "sm" })}
                                >
                                  <Download aria-hidden /> Baixar
                                </a>
                                {canManage && (
                                  <Button
                                    size="icon-sm"
                                    variant="tertiary"
                                    icon={Trash2}
                                    disabled={isPending}
                                    onClick={() => setToDelete(f)}
                                    aria-label={`Remover ${f.fileName}`}
                                    title="Remover arquivo"
                                    className="hover:bg-danger-bg hover:text-danger-fg"
                                  />
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <ConfirmModal
        isOpen={!!toDelete}
        title="Remover documento?"
        message={toDelete ? `"${toDelete.fileName}" será removido desta admissão. Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Remover"
        onConfirm={() => {
          const f = toDelete;
          setToDelete(null);
          if (f) run(() => deleteAttachment(admissionId, f.id), "Documento removido.");
        }}
        onCancel={() => setToDelete(null)}
      />

      {/* Modal de pré-visualização */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closePreview}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pré-visualização de ${previewItem.fileName}`}
            className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-card bg-white shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-wg-border-lighter px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-wg-ink-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-wg-ink">{previewItem.fileName}</span>
              <a
                href={`/api/admissoes/${admissionId}/attachments/${previewItem.id}`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                <Download aria-hidden /> Baixar
              </a>
              <Button size="icon-sm" variant="tertiary" icon={X} onClick={closePreview} aria-label="Fechar pré-visualização" autoFocus />
            </div>

            <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-wg-bg">
              {previewLoading && <p className="text-sm text-wg-ink-muted">Carregando pré-visualização…</p>}
              {!previewLoading && previewBlobUrl && isImage(previewItem.mimeType) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewBlobUrl} alt={previewItem.fileName} className="max-h-[75vh] max-w-full object-contain p-4" />
              )}
              {!previewLoading && previewBlobUrl && isPdf(previewItem.mimeType) && (
                <iframe src={previewBlobUrl} title={previewItem.fileName} className="w-full" style={{ height: "75vh" }} />
              )}
              {!previewLoading && !previewBlobUrl && !isImage(previewItem.mimeType) && !isPdf(previewItem.mimeType) && (
                <EmptyState
                  icon={FileText}
                  title="Este formato não tem pré-visualização"
                  action={
                    <a
                      href={`/api/admissoes/${admissionId}/attachments/${previewItem.id}`}
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      <Download aria-hidden /> Baixar arquivo
                    </a>
                  }
                />
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
  const sections: Section[] = types.map((t) => {
    const f = files.filter((x) => x.documentTypeId === t.id);
    return { key: t.id, name: t.name, required: t.required, files: f, status: sectionStatus(f, t.required) };
  });

  const knownIds = new Set(types.map((t) => t.id));
  const uncategorized = files.filter((f) => !f.documentTypeId || !knownIds.has(f.documentTypeId));
  if (uncategorized.length > 0) {
    sections.push({
      key: UNCATEGORIZED,
      name: "Sem categoria",
      required: false,
      files: uncategorized,
      status: sectionStatus(uncategorized, false),
    });
  }

  return sections;
}
