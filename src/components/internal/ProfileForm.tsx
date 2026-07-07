"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

interface Props {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

const inputClass =
  "w-full bg-wg-card-2 border border-wg-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-wg-gray focus:outline-none focus:ring-2 focus:ring-wg-green/40 transition-colors";
const labelClass = "block text-sm font-medium text-wg-gray mb-1";

export function ProfileForm({ user }: Props) {
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function handleNameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameLoading(true);
    setNameError(null);
    setNameSuccess(false);

    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNameError(typeof d.error === "string" ? d.error : "Erro ao salvar.");
        return;
      }

      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameError("Erro de conexão.");
    } finally {
      setNameLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);

    const form = new FormData(e.currentTarget);
    const currentPassword = form.get("currentPassword") as string;
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setPwError("A nova senha e a confirmação não coincidem.");
      setPwLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPwError(typeof d.error === "string" ? d.error : "Erro ao alterar senha.");
        return;
      }

      setPwSuccess(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Erro de conexão.");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Dados pessoais */}
      <div className="bg-wg-card border border-wg-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Dados pessoais</h2>

        <div className="mb-4">
          <label className={labelClass}>E-mail</label>
          <input
            type="email"
            value={user.email}
            disabled
            className={`${inputClass} opacity-50 cursor-not-allowed`}
          />
          <p className="text-xs text-wg-gray mt-1">
            O e-mail só pode ser alterado por um administrador.
          </p>
        </div>

        <form onSubmit={handleNameSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              name="name"
              type="text"
              required
              minLength={2}
              defaultValue={user.name}
              className={inputClass}
            />
          </div>

          {nameError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {nameError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nameLoading}
              className="bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold rounded-lg py-2 px-5 text-sm transition-colors flex items-center gap-2"
            >
              {nameLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
              ) : (
                "Salvar nome"
              )}
            </button>
            {nameSuccess && (
              <span className="flex items-center gap-1 text-sm text-wg-green">
                <Check className="w-4 h-4" />
                Nome atualizado
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="bg-wg-card border border-wg-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Alterar senha</h2>

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Senha atual</label>
            <input
              name="currentPassword"
              type="password"
              required
              placeholder="Digite sua senha atual"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Nova senha</label>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Confirmar nova senha</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="Repita a nova senha"
              className={inputClass}
            />
          </div>

          {pwError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {pwError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pwLoading}
              className="bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold rounded-lg py-2 px-5 text-sm transition-colors flex items-center gap-2"
            >
              {pwLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Alterando...</>
              ) : (
                "Alterar senha"
              )}
            </button>
            {pwSuccess && (
              <span className="flex items-center gap-1 text-sm text-wg-green">
                <Check className="w-4 h-4" />
                Senha alterada com sucesso
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
