import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  formatDateTime,
} from "@/lib/utils";
import StatusChangeForm from "@/components/internal/StatusChangeForm";
import AiReviewPanel from "@/components/internal/AiReviewPanel";
import AnonymizeButton from "@/components/internal/AnonymizeButton";
import { ApplicationStatus } from "@prisma/client";
import { Download, User, MapPin, Phone, Mail, FileText } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Candidato" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidatoPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      job: true,
      aiReview: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!application) notFound();

  const isAdmin = session?.user.role === "ADMIN_RH";
  const { candidate, job, aiReview, statusHistory } = application;

  return (
    <div className="max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link href="/candidatos" className="text-sm text-orange-600 hover:underline mb-2 block">
            ← Candidatos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{candidate.fullName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Candidatura para: <strong>{job.title}</strong> — {job.city}/{job.state}
          </p>
        </div>
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${
            APPLICATION_STATUS_COLORS[application.status]
          }`}
        >
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dados do candidato */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Dados do Candidato
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{candidate.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{candidate.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{candidate.city} / {candidate.state}</span>
              </div>
              <div className="text-xs text-gray-400 pt-2">
                Candidatura recebida em {formatDateTime(application.createdAt)}
              </div>
              <div className="flex gap-3 text-xs pt-1">
                <span className={candidate.privacyAcceptance ? "text-green-600" : "text-red-500"}>
                  {candidate.privacyAcceptance ? "✓ Privacidade aceita" : "✗ Sem aceite de privacidade"}
                </span>
                <span className={candidate.talentPoolAcceptance ? "text-green-600" : "text-gray-400"}>
                  {candidate.talentPoolAcceptance ? "✓ Banco de talentos" : "Não aderiu ao banco de talentos"}
                </span>
              </div>
            </div>
            {candidate.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Observações do candidato:</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{candidate.notes}</p>
              </div>
            )}
          </div>

          {/* Currículo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" /> Currículo
            </h2>
            {application.resumeFilePath === "[anonimizado]" ? (
              <p className="text-sm text-gray-400 italic">Arquivo removido (candidato anonimizado)</p>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-700 truncate">{application.resumeFileName}</span>
                <a
                  href={`/api/applications/${application.id}/resume`}
                  className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium flex-shrink-0 ml-3"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </a>
              </div>
            )}
          </div>

          {/* Análise de IA */}
          <AiReviewPanel
            applicationId={application.id}
            aiReview={aiReview}
            isAdmin={isAdmin}
          />
        </div>

        {/* Coluna lateral — Status e Histórico */}
        <div className="space-y-5">
          {/* Alterar status */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Alterar Status</h2>
              <StatusChangeForm
                applicationId={application.id}
                currentStatus={application.status as ApplicationStatus}
              />
            </div>
          )}

          {/* Histórico */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Histórico</h2>
            <div className="space-y-3">
              {statusHistory.map((h, i) => (
                <div key={h.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    {i < statusHistory.length - 1 && (
                      <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                    )}
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className="text-xs font-medium text-gray-800">
                      {APPLICATION_STATUS_LABELS[h.toStatus]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(h.createdAt)}
                      {h.changedByName ? ` · ${h.changedByName}` : ""}
                    </p>
                    {h.note && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">{h.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LGPD — Anonimizar */}
          {isAdmin && !candidate.anonymized && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-700 font-medium mb-2">Direito LGPD</p>
              <p className="text-xs text-red-600 mb-3">
                Para anonimizar os dados e remover o currículo a pedido do candidato:
              </p>
              <AnonymizeButton candidateId={candidate.id} />
            </div>
          )}

          {candidate.anonymized && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">
                ✓ Candidato anonimizado em {candidate.anonymizedAt ? formatDateTime(candidate.anonymizedAt) : "—"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
