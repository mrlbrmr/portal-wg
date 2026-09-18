import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Briefcase } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { PageHeader } from "@/components/internal/PageHeader";
import { JobRequestStatusBadge } from "@/components/internal/job-requests/JobRequestStatusBadge";
import { JobRequestDetail } from "@/components/internal/job-requests/JobRequestDetail";
import { JobRequestActions } from "@/components/internal/job-requests/JobRequestActions";
import { JobRequestTimeline } from "@/components/internal/job-requests/JobRequestTimeline";
import {
  currentActor,
  getJobRequest,
  getJobRequestHistory,
  listApprovers,
} from "@/lib/job-requests/service";
import { JOB_REQUEST_STATUS_LABELS } from "@/lib/job-requests/constants";
import type { FormFieldConfig } from "@/types/form-config";

export const metadata: Metadata = { title: "Solicitação de Vaga — RH" };

async function loadExtraFields(): Promise<FormFieldConfig[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("fields")
    .eq("id", "singleton")
    .maybeSingle();
  return Array.isArray(data?.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields;
}

async function loadSuggestions() {
  const supabase = createAdminClient();
  const [jobsRes, reqRes] = await Promise.all([
    supabase.from("jobs").select("company, department").limit(500),
    supabase.from("job_requests").select("location, department").limit(500),
  ]);
  const units = new Set<string>();
  const departments = new Set<string>();
  for (const j of (jobsRes.data ?? []) as Array<{ company: string | null; department: string | null }>) {
    if (j.company?.trim()) units.add(j.company.trim());
    if (j.department?.trim()) departments.add(j.department.trim());
  }
  for (const r of (reqRes.data ?? []) as Array<{ location: string | null; department: string | null }>) {
    if (r.location?.trim()) units.add(r.location.trim());
    if (r.department?.trim()) departments.add(r.department.trim());
  }
  return {
    units: [...units].sort((a, b) => a.localeCompare(b, "pt-BR")),
    departments: [...departments].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export default async function SolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) redirect("/login");

  const [request, history, approvers, extraFields, suggestions] = await Promise.all([
    getJobRequest(id),
    getJobRequestHistory(id),
    listApprovers(),
    loadExtraFields(),
    loadSuggestions(),
  ]);

  if (!request) notFound();

  return (
    <div className="bg-slate-50">
      <Link
        href="/solicitacoes"
        className="inline-flex items-center gap-1.5 text-sm text-[#55614A] hover:text-[#1A2213] mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar às solicitações
      </Link>

      <PageHeader
        title={request.title ?? "Solicitação sem título"}
        subtitle={`${request.code ?? "sem número"} · solicitada por ${request.requesterName ?? "gestor não informado"}`}
        action={<JobRequestStatusBadge status={request.status} variant="full" />}
      />

      {/* Vaga gerada a partir desta solicitação */}
      {request.jobId && (
        <div className="mb-4 rounded-2xl border border-[#CBE3D4] bg-[#E2F0E4] px-4 py-3">
          <p className="text-sm font-semibold text-[#2F6B4F]">
            Processo seletivo criado a partir desta solicitação.
          </p>
          <Link
            href={`/vagas/${request.jobId}/candidatos`}
            className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2F6B4F] hover:underline"
          >
            <Briefcase className="w-3.5 h-3.5" />
            {request.jobCode ? `${request.jobCode} — ` : ""}
            {request.jobTitle ?? "Abrir a vaga"}
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="min-w-0">
          <JobRequestDetail
            request={request}
            actor={actor}
            extraFields={extraFields}
            unitOptions={suggestions.units}
            departmentOptions={suggestions.departments}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8A9480] font-sora mb-1">
              Status da solicitação
            </h2>
            <p className="text-sm font-semibold text-[#1A2213] mb-3">
              {JOB_REQUEST_STATUS_LABELS[request.status]}
            </p>
            <JobRequestActions request={request} actor={actor} approvers={approvers} />
          </section>

          <section className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8A9480] font-sora mb-4">
              Histórico
            </h2>
            <JobRequestTimeline events={history} />
          </section>
        </aside>
      </div>
    </div>
  );
}
