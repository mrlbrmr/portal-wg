import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import AdmissionForm, {
  type AdmissionFormValues,
} from "@/components/internal/admissao/AdmissionForm";

export const metadata: Metadata = { title: "Editar admissão — RH" };

/** Converte a data (string ISO do supabase-js) para "AAAA-MM-DD" do <input>. */
function toDateInput(d: string | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export default async function EditarAdmissaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  const supabase = await createClient();
  const [config, admissionRes] = await Promise.all([
    getAdmissionConfig(),
    supabase.from("admissions").select("*").eq("id", id).is("deletedAt", null).maybeSingle(),
  ]);

  const admission = admissionRes.data as {
    id: string;
    fullName: string;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    positionId: string | null;
    companyId: string | null;
    branchId: string | null;
    stageId: string | null;
    responsibleId: string | null;
    managerName: string | null;
    startDate: string | null;
    medicalExamDate: string | null;
    salary: number | string | null;
    shift: string | null;
    uniformShirt: string | null;
    uniformPants: string | null;
    uniformShoe: string | null;
    notes: string | null;
  } | null;
  if (!admission) notFound();

  const values: AdmissionFormValues & { id: string } = {
    id: admission.id,
    fullName: admission.fullName,
    cpf: admission.cpf ?? "",
    email: admission.email ?? "",
    phone: admission.phone ?? "",
    birthDate: toDateInput(admission.birthDate),
    positionId: admission.positionId ?? "",
    companyId: admission.companyId ?? "",
    branchId: admission.branchId ?? "",
    stageId: admission.stageId ?? "",
    responsibleId: admission.responsibleId ?? "",
    managerName: admission.managerName ?? "",
    startDate: toDateInput(admission.startDate),
    medicalExamDate: toDateInput(admission.medicalExamDate),
    salary: admission.salary != null ? String(admission.salary) : "",
    shift: admission.shift ?? "",
    uniformShirt: admission.uniformShirt ?? "",
    uniformPants: admission.uniformPants ?? "",
    uniformShoe: admission.uniformShoe ?? "",
    notes: admission.notes ?? "",
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/admissoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Admissões
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar admissão</h1>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <AdmissionForm options={config} admission={values} canDelete />
      </div>
    </div>
  );
}
