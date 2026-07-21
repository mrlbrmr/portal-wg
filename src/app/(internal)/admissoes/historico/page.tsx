import type { Metadata } from "next";
import Link from "next/link";
import { History, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Histórico de Admissões — RH" };

// Histórico cronológico das admissões (criação/última atualização). Um log de
// atividade por item (AdmissionActivity) é uma evolução futura — as tabelas já
// existem; por ora derivamos o histórico dos próprios registros de admissão.
export default async function AdmissoesHistoricoPage() {
  const supabase = await createClient();
  const [admissionsRes, usersRes] = await Promise.all([
    supabase
      .from("admissions")
      .select(
        "id, fullName, createdAt, updatedAt, createdById, position:admission_positions(name), stage:admission_stages(name, color)"
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .limit(100),
    supabase.from("users").select("id, name").eq("active", true),
  ]);

  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    id: string;
    fullName: string;
    createdAt: string;
    updatedAt: string;
    createdById: string | null;
    position: { name: string } | null;
    stage: { name: string; color: string } | null;
  }>;
  const users = (usersRes.data ?? []) as Array<{ id: string; name: string }>;

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5" /> Histórico
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Admissões cadastradas, da mais recente para a mais antiga.
        </p>
      </div>

      {admissions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <EmptyState icon={ClipboardCheck} title="Sem histórico" description="Nenhuma admissão cadastrada ainda." />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <ol className="relative border-l border-gray-200 ml-2">
            {admissions.map((a) => (
              <li key={a.id} className="mb-6 last:mb-0 ml-5">
                <span
                  className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white"
                  style={{ backgroundColor: a.stage?.color ?? "#94a3b8" }}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Link href={`/admissoes/${a.id}`} className="text-sm font-medium text-gray-900 hover:text-wg-green-dark">
                    {a.fullName}
                  </Link>
                  <time className="text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleString("pt-BR")}
                  </time>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {a.position?.name ?? "Cargo não definido"}
                  {a.stage?.name ? ` · ${a.stage.name}` : ""}
                  {a.createdById && userMap.get(a.createdById)
                    ? ` · por ${userMap.get(a.createdById)}`
                    : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
