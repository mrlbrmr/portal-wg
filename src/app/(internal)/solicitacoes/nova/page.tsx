import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrgUnits } from "@/lib/registries/org-units-data";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import { PageHeader } from "@/components/internal/PageHeader";
import { NewJobRequestForm } from "@/components/internal/job-requests/NewJobRequestForm";
import type { FormFieldConfig } from "@/types/form-config";

export const metadata: Metadata = { title: "Nova Solicitação de Vaga — RH" };

export default async function NovaSolicitacaoPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/solicitacoes");

  const supabase = createAdminClient();
  const [configRes, orgUnits] = await Promise.all([
    supabase.from("job_request_form_config").select("fields").eq("id", "singleton").maybeSingle(),
    loadOrgUnits(supabase),
  ]);

  const extraFields: FormFieldConfig[] = Array.isArray(configRes.data?.fields)
    ? configRes.data.fields
    : DEFAULT_FORM_CONFIG.fields;


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
        branchOptions={orgUnits.branches}
        areaOptions={orgUnits.areas}
        currentUser={{ name: session.user.name, email: session.user.email }}
      />
    </div>
  );
}
