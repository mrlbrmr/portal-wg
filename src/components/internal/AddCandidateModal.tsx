"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Plus, Upload, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { buttonVariants } from "@/components/ui/Button";
import { BRAZIL_STATES, maskPhone } from "@/lib/utils";
import { MAX_SOURCE_NAME } from "@/lib/application-schema";

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

const MAX_MB = 5;
const ACCEPT = ".pdf,.doc,.docx";
/** Valor do <select> que abre o campo de nova origem. */
const NEW_SOURCE = "__nova__";

interface Props {
  jobId: string;
  /** Origens ativas do cadastro "Origens de candidatos", na ordem do cadastro. */
  sources: Array<{ id: string; name: string }>;
}

/**
 * Botão "Adicionar candidato" + modal de cadastro MANUAL de candidato numa vaga
 * (CV recebido por fora do portal). Só ADMIN_RH vê o botão. CV é opcional.
 * A origem é obrigatória — é o que permite medir de onde vêm os candidatos. Se ela não
 * estiver na lista, o RH cria na hora ("Nova origem…"); a API grava no cadastro.
 * Envia multipart para POST /api/vagas/[id]/candidatos e dá router.refresh().
 */
export function AddCandidateModal({ jobId, sources }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [source, setSource] = useState("");
  const [newSource, setNewSource] = useState("");
  const newSourceRef = useRef<HTMLInputElement>(null);
  const creatingSource = source === NEW_SOURCE;
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
    setCity("");
    setUf("");
    setSource("");
    setNewSource("");
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
    if (!source || (creatingSource && newSource.trim().length < 2)) {
      setError(creatingSource ? "Informe o nome da nova origem." : "Informe a origem do candidato.");
      return;
    }

    setSaving(true);
    try {
      const data = new FormData();
      data.set("fullName", fullName);
      data.set("email", email);
      data.set("phone", phone);
      if (city.trim()) data.set("candidateCity", city.trim());
      if (uf) data.set("candidateState", uf);
      if (creatingSource) data.set("newSource", newSource.trim());
      else data.set("source", source);
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
        className={buttonVariants({ variant: "primary" })}
      >
        <UserPlus aria-hidden />
        Novo candidato
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Novo candidato</h3>
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

              <div className="grid grid-cols-[1fr_88px] gap-3">
                <div>
                  <label htmlFor="add-candidate-city" className="mb-1 block text-sm font-medium text-gray-700">
                    Cidade <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    id="add-candidate-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={120}
                    autoComplete="off"
                    placeholder="Cidade onde reside"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="add-candidate-uf" className="mb-1 block text-sm font-medium text-gray-700">
                    UF
                  </label>
                  <select
                    id="add-candidate-uf"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">--</option>
                    {BRAZIL_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="add-candidate-source" className="mb-1 block text-sm font-medium text-gray-700">
                  Origem *
                </label>
                <select
                  id="add-candidate-source"
                  value={source}
                  required
                  onChange={(e) => {
                    setSource(e.target.value);
                    if (e.target.value === NEW_SOURCE) requestAnimationFrame(() => newSourceRef.current?.focus());
                  }}
                  className={inputClass}
                >
                  <option value="" disabled>
                    De onde veio o candidato?
                  </option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={NEW_SOURCE}>+ Nova origem…</option>
                </select>
                {creatingSource && (
                  <div className="mt-2">
                    <label htmlFor="add-candidate-new-source" className="sr-only">
                      Nome da nova origem
                    </label>
                    <input
                      id="add-candidate-new-source"
                      ref={newSourceRef}
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      required
                      minLength={2}
                      maxLength={MAX_SOURCE_NAME}
                      placeholder="Ex.: Vagas.com, rádio local, feira de empregos"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Fica salva em Configurações › Cadastros › Origens de candidatos e aparece nas próximas vezes.
                    </p>
                  </div>
                )}
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
