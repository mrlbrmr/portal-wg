import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getAdmissionConfig } from "@/lib/admissao/queries";
import AdmissionForm from "@/components/internal/admissao/AdmissionForm";

export const metadata: Metadata = { title: "Nova admissão — RH" };

export default async function NovaAdmissaoPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  const config = await getAdmissionConfig();

  return (
    <div className="max-w-3xl">
      <Link
        href="/admissoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Admissões
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova admissão</h1>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <AdmissionForm options={config} />
      </div>
    </div>
  );
}
