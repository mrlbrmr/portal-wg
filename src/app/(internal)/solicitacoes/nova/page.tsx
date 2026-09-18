import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { PageHeader } from "@/components/internal/PageHeader";
import { NewJobRequestForm } from "@/components/internal/job-requests/NewJobRequestForm";
import type { FormFieldConfig } from "@/types/form-config";

export const metadata: Metadata = { title: "Nova Solicitação de Vaga — RH" };

export default async function NovaSolicitacaoPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/solicitacoes");

  const supabase = createAdminClient();
  const [configRes, jobsRes, reqRes] = await Promise.all([
    supabase.from("job_request_form_config").select("fields").eq("id", "singleton").maybeSingle(),
    supabase.from("jobs").select("company, department").limit(500),
    supabase.from("job_requests").select("location, department").limit(500),
  ]);

  const extraFields: FormFieldConfig[] = Array.isArray(configRes.data?.fields)
    ? configRes.data.fields
    : DEFAULT_FORM_CONFIG.fields;

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

  return (
    <div className="bg-slate-50 max-w-4xl">
      <Link
        href="/solicitacoes"
        className="inline-flex items-center gap-1.5 text-sm text-[#55614A] hover:text-[#1A2213] mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar às solicitações
      </Link>

      <PageHeader
        title="Nova solicitação de vaga"
        subtitle="Registre a necessidade de contratação. A vaga (processo seletivo) só é criada depois da aprovação."
      />

      <NewJobRequestForm
        extraFields={extraFields}
        unitOptions={[...units].sort((a, b) => a.localeCompare(b, "pt-BR"))}
        departmentOptions={[...departments].sort((a, b) => a.localeCompare(b, "pt-BR"))}
        currentUser={{ name: session.user.name, email: session.user.email }}
      />
    </div>
  );
}
