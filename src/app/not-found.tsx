"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Briefcase, ArrowLeft, LayoutDashboard } from "lucide-react";

// Rotas do painel do RH: o 404 não pode falar com o candidato ("a vaga foi encerrada").
const INTERNAL_PREFIXES = [
  "/dashboard", "/vagas/gerenciar", "/vagas/nova", "/solicitacoes", "/talentos", "/avaliacoes",
  "/admissoes", "/usuarios", "/configuracoes", "/perfil",
];

export default function NotFound() {
  const pathname = usePathname() ?? "";
  const internal =
    INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    /^\/vagas\/[^/]+\/(candidatos|editar)/.test(pathname);
  return (
    <div className="min-h-screen bg-wg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-wg-branca.png"
            alt="Grupo WG"
            width={120}
            height={60}
            className="h-12 w-auto opacity-70"
          />
        </div>

        <div className="text-wg-green text-8xl font-black mb-4 leading-none">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Página não encontrada</h1>
        <p className="text-wg-gray leading-relaxed mb-10">
          {internal
            ? "Esta página do painel não existe ou o registro foi removido. Confira o endereço ou volte para a visão geral."
            : "A página que você está procurando não existe ou foi removida. Talvez a vaga que buscava tenha sido encerrada."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={internal ? "/dashboard" : "/#vagas"}
            className="inline-flex items-center justify-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-bold px-6 py-3 rounded-full transition-colors"
          >
            {internal ? <LayoutDashboard className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            {internal ? "Ir para a visão geral" : "Ver vagas abertas"}
          </Link>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center justify-center gap-2 border border-wg-border hover:border-wg-green/50 text-wg-gray hover:text-white px-6 py-3 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
