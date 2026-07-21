import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  FunnelStagesManager,
  type FunnelStage,
} from "@/components/internal/FunnelStagesManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Funil de seleção — RH" };

export default async function FunilPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("application_stages")
    .select("id, name, color, sortOrder, kind, active")
    .order("sortOrder", { ascending: true });

  const stages = (data ?? []) as FunnelStage[];

  return (
    <div>
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-wg-green-dark transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar às configurações
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Funil de seleção</h1>
        <p className="text-gray-500 text-sm mt-1">
          Estas são as etapas (colunas) do Kanban de candidatos de <strong>todas</strong> as
          vagas. Marque uma etapa como <strong>Contratado</strong> ou <strong>Reprovado</strong>{" "}
          para as métricas do painel funcionarem.
        </p>
      </div>

      <FunnelStagesManager stages={stages} />
    </div>
  );
}
