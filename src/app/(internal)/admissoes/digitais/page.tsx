import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Admissões Digitais (WhatsApp) — RH" };

export default async function DigitaisPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") notFound();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">Admissões Digitais via WhatsApp</h1>
      </div>
      <div className="text-center py-16 text-gray-400 text-sm">
        Este módulo está temporariamente desativado.
      </div>
    </div>
  )
}
