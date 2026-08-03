"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Plus, Upload, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { maskPhone } from "@/lib/utils";
import {
  APPLICATION_SOURCE_LABELS,
  MANUAL_APPLICATION_SOURCES,
} from "@/lib/application-schema";

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

const MAX_MB = 5;
const ACCEPT = ".pdf,.doc,.docx";

interface Props {
  jobId: string;
}

/**
 * Botão "Adicionar candidato" + modal de cadastro MANUAL de candidato numa vaga
 * (CV recebido por fora do portal). Só ADMIN_RH vê o botão. CV é opcional.
 * Envia multipart para POST /api/vagas/[id]/candidatos e dá router.refresh().
 */
export function AddCandidateModal({ jobId }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<string>(MANUAL_APPLICATION_SOURCES[0]);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setSource(MANUAL_APPLICATION_SOURCES[0]);
    setFileName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    if (saving) return;
    setOpen(false);
    reset();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) {
      setFileName(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`O currículo excede o limite de ${MAX_MB} MB.`);
      e.target.value = "";
      setFileName(null);
      return;
    }
    setFileName(f.name);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (phone.replace(/\D/g, "").length !== 11) {
      setError("Celular inválido. Use o formato (xx) x xxxx-xxxx.");
      return;
    }

    setSaving(true);
    try {
      const data = new FormData();
      data.set("fullName", fullName);
      data.set("email", email);
      data.set("phone", phone);
      data.set("source", source);
      const file = fileRef.current?.files?.[0];
      if (file) data.set("resume", file);

      const res = await fetch(`/api/vagas/${jobId}/candidatos`, {
        method: "POST",
        credentials: "same-origin",
        body: data,
      });

      if (!res.ok) {
        let message = "Não foi possível cadastrar o candidato.";
        try {
          const j = await res.json();
          if (typeof j.error === "string") message = j.error;
        } catch {
          /* mantém padrão */
        }
        setError(message);
        return;
      }

      notify("success", `${fullName} adicionado à vaga.`);
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-wg-green px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright"
      >
        <UserPlus className="h-4 w-4" />
        Adicionar candidato
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Adicionar candidato</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Para currículos recebidos por fora do portal (WhatsApp, Catho, Indeed…).
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nome completo *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="Nome do candidato"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@exemplo.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Celular *</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  required
                  inputMode="numeric"
                  placeholder="(11) 9 1234-5678"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Origem *</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={inputClass}
                >
                  {MANUAL_APPLICATION_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Currículo <span className="font-normal text-gray-400">(opcional, PDF/DOC/DOCX até {MAX_MB} MB)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 transition-colors hover:border-wg-green hover:text-wg-green-dark">
                  {fileName ? <Paperclip className="h-4 w-4 shrink-0" /> : <Upload className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{fileName ?? "Anexar currículo"}</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-wg-green px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-wg-green-bright disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
