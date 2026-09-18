import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import JobForm from "@/components/internal/JobForm";
import { createClient } from "@/lib/supabase/server";
import { buildJobDraftFromRequest, type JobDraftFromRequest } from "@/lib/job-requests/mapping";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nova Vaga — RH" };

export default async function NovaVagaPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  // Vaga aberta a partir de uma Requisição de Pessoal aprovada: pré-preenche o
  // formulário com o que o gestor pediu (ver src/lib/job-requests/mapping.ts).
  let requestDraft: JobDraftFromRequest | undefined;
  let requestId: string | undefined;

  if (params.request) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("job_requests")
      .select("id, status, form_data, job_id")
      .eq("id", params.request)
      .maybeSingle();

    const request = data as
      | { id: string; status: string; form_data: Record<string, string> | null; job_id: string | null }
      | null;

    // Já virou vaga? Manda direto para ela em vez de criar uma duplicada.
    if (request?.job_id) redirect(`/vagas/${request.job_id}/editar`);

    if (request && request.status === "APPROVED") {
      requestId = request.id;
      requestDraft = buildJobDraftFromRequest(request.form_data ?? {});
    }
  }

  return (
    <div className="max-w-2xl">
      {params.request && (
        <Link
          href="/vagas/solicitacoes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar às solicitações
        </Link>
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Vaga</h1>
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
        <JobForm
          currentUserName={session.user.name}
          requestId={requestId}
          requestDraft={requestDraft}
        />
      </div>
    </div>
  );
}
