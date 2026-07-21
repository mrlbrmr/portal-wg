"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { UserRole } from "@/types/domain";

interface Props {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active: boolean;
  };
}

const inputClass =
  "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export function EditUserForm({ user }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      role: form.get("role") as string,
      active: form.get("active") === "true",
    };

    const password = (form.get("password") as string).trim();
    if (password) body.password = password;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "Erro ao salvar.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/usuarios"), 800);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "Erro ao excluir.");
        return;
      }
      router.push("/usuarios");
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Informações básicas */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Informações
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Nome completo</label>
              <input
                name="name"
                type="text"
                required
                defaultValue={user.name}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Acesso */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Acesso
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Papel</label>
              <select name="role" defaultValue={user.role} className={inputClass}>
                <option value="VIEWER_RH" className="bg-white">Visualizador — só leitura</option>
                <option value="ADMIN_RH" className="bg-white">Admin RH — acesso total</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="active" defaultValue={String(user.active)} className={inputClass}>
                <option value="true" className="bg-white">Ativo</option>
                <option value="false" className="bg-white">Inativo</option>
              </select>
            </div>
          </div>
        </section>

        {/* Redefinir senha */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Redefinir senha
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Deixe em branco para manter a senha atual.
          </p>
          <input
            name="password"
            type="password"
            minLength={8}
            placeholder="Nova senha (mínimo 8 caracteres)"
            className={inputClass}
          />
        </section>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 rounded-lg py-2.5 px-4 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || success}
            className="flex-1 bg-wg-green hover:bg-wg-green-bright disabled:opacity-60 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
            ) : success ? (
              "Salvo!"
            ) : (
              "Salvar alterações"
            )}
          </button>
        </div>
      </form>

      {/* Zona de perigo */}
      <div className="mt-8 border-t border-red-200 pt-6">
        <p className="text-xs text-gray-500 mb-3">
          Excluir permanentemente remove o usuário e todo o histórico de acesso.
        </p>
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 border border-red-300 hover:border-red-500 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Excluir usuário
        </button>
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        title="Excluir usuário?"
        message={`"${user.name}" será removido permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
