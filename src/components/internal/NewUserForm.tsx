"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewUserForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      password: form.get("password") as string,
      role: form.get("role") as string,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erro ao criar usuário.");
        return;
      }

      router.push("/usuarios");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green transition-colors";

  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col gap-5">
      <div>
        <label className={labelClass}>Nome completo</label>
        <input name="name" type="text" required placeholder="Ex: Maria Silva" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>E-mail</label>
        <input name="email" type="email" required placeholder="maria@wgbaterias.com.br" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Senha inicial</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">O usuário pode alterar após o primeiro acesso.</p>
      </div>

      <div>
        <label className={labelClass}>Papel</label>
        <select name="role" defaultValue="VIEWER_RH" className={inputClass}>
          <option value="VIEWER_RH">Visualizador — só leitura</option>
          <option value="ADMIN_RH">Admin RH — acesso total</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-wg-green hover:bg-wg-green-bright text-black font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60"
        >
          {isLoading ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
