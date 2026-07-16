"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("callbackUrl");
  const callbackUrl = raw && raw.startsWith("/") ? raw : "/dashboard";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("E-mail ou senha inválidos. Verifique e tente novamente.");
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
  }

  const inputClass =
    "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wg-green/50 focus:border-wg-green transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-wg-green hover:bg-wg-green-bright disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-wg-green rounded-xl mb-4">
            <Zap className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Painel RH</h1>
          <p className="text-sm text-gray-500 mt-1">WG Baterias — Gente &amp; Gestão</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
          <Suspense
            fallback={
              <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                Carregando...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Acesso restrito à equipe de RH do Grupo WG.
          <br />
          Problemas? Fale com o administrador do sistema.
        </p>
      </div>
    </div>
  );
}
