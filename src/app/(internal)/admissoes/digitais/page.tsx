import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, CheckCircle2, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdmissionState } from "@/lib/whatsapp/types";
import { DOC_ORDER } from "@/lib/whatsapp/messages";

export const metadata: Metadata = { title: "Admissões Digitais (WhatsApp) — RH" };

const STATE_LABELS: Partial<Record<AdmissionState, string>> = {
  WAITING_START: "Aguardando início",
  GREETING: "Iniciado",
  COLLECT_NAME: "Coletando dados",
  COLLECT_CPF: "Coletando dados",
  COLLECT_BIRTHDATE: "Coletando dados",
  CONFIRM_PERSONAL: "Confirmando dados",
  DOC_RG_CNH: "Enviando documentos",
  DOC_CPF_CARD: "Enviando documentos",
  DOC_ADDRESS: "Enviando documentos",
  DOC_PHOTO: "Enviando documentos",
  PROCESSING: "Processando",
  DONE: "Concluído",
  EXCEPTION: "Exceção",
};

function stateColor(state: AdmissionState) {
  if (state === "DONE") return "bg-green-100 text-green-800";
  if (state === "EXCEPTION") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

function stateIcon(state: AdmissionState) {
  if (state === "DONE") return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (state === "EXCEPTION") return <AlertTriangle className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
}

type FilterTab = "ativas" | "concluidas" | "excecoes";

export default async function DigitaisPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") notFound();

  const { tab } = await searchParams;
  const activeTab = (tab as FilterTab) ?? "ativas";

  const supabase = await createClient();

  let query = supabase
    .from("whatsapp_admission_sessions")
    .select(
      `id, state, data, phone, createdAt, updatedAt, expiresAt,
       admission:admissions(id, fullName, phone)`
    )
    .order("updatedAt", { ascending: false })
    .limit(100);

  if (activeTab === "ativas") {
    query = query.not("state", "in", '("DONE","EXCEPTION")').gt("expiresAt", new Date().toISOString());
  } else if (activeTab === "concluidas") {
    query = query.eq("state", "DONE");
  } else {
    query = query.eq("state", "EXCEPTION");
  }

  const { data: sessions } = await query;
  const rows = (sessions as unknown) as Array<{
    id: string;
    state: AdmissionState;
    data: { docsReceived?: string[]; docsApproved?: string[]; declaredName?: string };
    phone: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    admission: { id: string; fullName: string; phone: string | null } | null;
  }>;

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: "ativas", label: "Ativas" },
    { key: "concluidas", label: "Concluídas" },
    { key: "excecoes", label: "Exceções" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare className="w-5 h-5 text-wg-green-dark" />
        <h1 className="text-xl font-bold text-gray-900">Admissões Digitais via WhatsApp</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/admissoes/digitais?tab=${key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-wg-green text-wg-green-dark"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Nenhuma sessão {activeTab === "ativas" ? "ativa" : activeTab === "concluidas" ? "concluída" : "em exceção"} encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const docsReceived = row.data?.docsReceived ?? [];
            const progress = Math.round((docsReceived.length / DOC_ORDER.length) * 100);
            const name = row.admission?.fullName ?? row.data?.declaredName ?? row.phone;
            return (
              <div key={row.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate text-sm">{name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${stateColor(row.state)}`}>
                      {stateIcon(row.state)}
                      {STATE_LABELS[row.state] ?? row.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{row.phone}</span>
                    <span>·</span>
                    <span>Docs: {docsReceived.length}/{DOC_ORDER.length}</span>
                    {row.state !== "DONE" && row.state !== "EXCEPTION" && (
                      <>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-100 rounded-full h-1">
                            <div className="bg-wg-green h-1 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span>{progress}%</span>
                        </div>
                      </>
                    )}
                    <span>·</span>
                    <span>{new Date(row.updatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                </div>
                {row.admission?.id && (
                  <Link
                    href={`/admissoes/${row.admission.id}`}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    Ver ficha <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
