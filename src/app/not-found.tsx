"use client";

import Link from "next/link";
import Image from "next/image";
import { Briefcase, ArrowLeft } from "lucide-react";

export default function NotFound() {
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
          A página que você está procurando não existe ou foi removida.
          Talvez a vaga que buscava tenha sido encerrada.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#vagas"
            className="inline-flex items-center justify-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-bold px-6 py-3 rounded-full transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Ver vagas abertas
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
