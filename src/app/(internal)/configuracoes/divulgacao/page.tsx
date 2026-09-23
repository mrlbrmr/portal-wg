import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  isLinkedInConfigured,
  getLinkedInConnection,
  getLinkedInConfig,
} from "@/lib/distribution/linkedin";
import { LinkedInConnection } from "@/components/internal/LinkedInConnection";
import { SettingsPage } from "@/components/internal/settings/SettingsPage";

export const metadata: Metadata = { title: "LinkedIn — Configurações — RH" };

const ERROR_MESSAGES: Record<string, string> = {
  nao_configurado: "A integração com o LinkedIn ainda não foi habilitada. Fale com o responsável técnico.",
  state_invalido: "A conexão não pôde ser confirmada por segurança. Tente conectar novamente.",
  sem_pagina_admin:
    "Nenhuma página de empresa encontrada para este usuário. É preciso ser administrador da página no LinkedIn.",
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
    <SettingsPage
      breadcrumb={[{ label: "Integrações" }, { label: "LinkedIn" }]}
      title="LinkedIn"
      description="Conecte a página da empresa para divulgar as vagas no LinkedIn."
    >
      <div className="max-w-3xl space-y-4">
        {connected && (
          <div role="status" className="flex items-center gap-2 rounded-control border border-success-border bg-success-bg px-3 py-2.5 text-meta text-success-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> LinkedIn conectado com sucesso.
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-control border border-danger-border bg-danger-bg px-3 py-2.5 text-meta text-danger-fg">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {ERROR_MESSAGES[error] ?? "Não foi possível conectar ao LinkedIn. Tente novamente."}
          </div>
        )}

        <LinkedInConnection
          configured={configured}
          connected={!!conn}
          orgName={cfg.orgName ?? null}
          expiresAt={conn?.expiresAt ? new Date(conn.expiresAt).toISOString() : null}
        />
      </div>
    </SettingsPage>
  );
}
