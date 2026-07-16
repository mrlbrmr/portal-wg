import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobForm from "@/components/internal/JobForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nova Vaga — RH" };

export default async function NovaVagaPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova Vaga</h1>
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
        <JobForm />
      </div>
    </div>
  );
}
