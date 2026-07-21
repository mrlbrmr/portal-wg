import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  isLinkedInConfigured,
  getLinkedInConnection,
  getLinkedInConfig,
} from "@/lib/distribution/linkedin";
import { LinkedInConnection } from "@/components/internal/LinkedInConnection";

export const metadata: Metadata = { title: "Divulgação — RH" };

const ERROR_MESSAGES: Record<string, string> = {
  nao_configurado: "Integração do LinkedIn não configurada no servidor.",
  state_invalido: "Falha de segurança na conexão (state inválido). Tente novamente.",
  sem_pagina_admin:
    "Nenhuma página de empresa encontrada para este usuário. Você precisa ser administrador da página no LinkedIn.",
};

export default async function DivulgacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const { connected, error } = await searchParams;

  const configured = isLinkedInConfigured();
  const conn = await getLinkedInConnection();
  const cfg = conn ? getLinkedInConfig(conn) : {};

  return (
    <div className="max-w-3xl">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Configurações
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Divulgação de vagas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Conexões com canais externos usados para divulgar as vagas.
        </p>
      </div>

      {connected && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-wg-green/30 bg-wg-green/10 px-3 py-2.5 text-sm text-wg-green-dark">
          <CheckCircle2 className="w-4 h-4" /> LinkedIn conectado com sucesso.
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {ERROR_MESSAGES[error] ?? `Não foi possível conectar (${error}).`}
        </div>
      )}

      <LinkedInConnection
        configured={configured}
        connected={!!conn}
        orgName={cfg.orgName ?? null}
        expiresAt={conn?.expiresAt ? new Date(conn.expiresAt).toISOString() : null}
      />
    </div>
  );
}
