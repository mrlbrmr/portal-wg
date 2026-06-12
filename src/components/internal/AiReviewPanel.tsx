"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import type { AiReview } from "@prisma/client";

interface Props {
  applicationId: string;
  aiReview: AiReview | null;
  isAdmin: boolean;
}

export default function AiReviewPanel({ applicationId, aiReview, isAdmin }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<AiReview | null>(aiReview);

  async function generate(useMock = false) {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, useMock }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao gerar análise.");
        return;
      }

      setReview(data);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  }

  const adherenceColor: Record<string, string> = {
    Alta: "bg-green-100 text-green-700 border-green-200",
    Média: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Baixa: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          Análise com IA
        </h2>

        {isAdmin && (
          <div className="flex gap-2">
            {review && (
              <button
                onClick={() => generate(false)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Regerar
              </button>
            )}
            {!review && (
              <>
                <button
                  onClick={() => generate(true)}
                  disabled={isGenerating}
                  className="text-xs border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Simular
                </button>
                <button
                  onClick={() => generate(false)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Gerar análise
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isGenerating && (
        <div className="flex items-center gap-3 py-8 justify-center text-gray-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          Analisando currículo com IA...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!review && !isGenerating && !error && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          {isAdmin
            ? "Clique em 'Gerar análise' para analisar o currículo com IA."
            : "Análise ainda não gerada para este candidato."}
        </div>
      )}

      {review && !isGenerating && (
        <div className="space-y-4">
          {/* Badge mock */}
          {review.isMock && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              <AlertTriangle className="w-3 h-3" />
              Análise simulada (modo de desenvolvimento) — não baseada no currículo real
            </div>
          )}

          {/* Aderência */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Aderência geral:</span>
            <span className={`text-sm font-bold px-3 py-0.5 rounded-full border ${adherenceColor[review.adherenceLevel] || "bg-gray-100 text-gray-700"}`}>
              {review.adherenceLevel}
            </span>
          </div>

          {/* Resumo */}
          <ReviewSection title="Resumo Profissional" content={review.resumeSummary} />

          {/* Requisitos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReviewSection
              title="Requisitos Obrigatórios Atendidos"
              content={review.requiredMet}
              accent="green"
            />
            <ReviewSection
              title="Não Evidenciados"
              content={review.requiredNotEvidenced}
              accent="yellow"
            />
          </div>

          <ReviewSection title="Requisitos Desejáveis Atendidos" content={review.desiredMet} />
          <ReviewSection title="Pontos Fortes" content={review.strengths} accent="green" />
          <ReviewSection title="Pontos de Atenção para Entrevista" content={review.interviewAttention} accent="yellow" />
          <ReviewSection title="Perguntas Sugeridas para Entrevista" content={review.suggestedQuestions} />

          {/* Nota final */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 leading-relaxed">
            ⓘ {review.finalNote}
          </div>

          <p className="text-xs text-gray-400">
            Modelo: {review.modelUsed} · Gerado em {new Date(review.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewSection({
  title,
  content,
  accent,
}: {
  title: string;
  content: string;
  accent?: "green" | "yellow";
}) {
  const bg = accent === "green"
    ? "bg-green-50 border-green-100"
    : accent === "yellow"
    ? "bg-yellow-50 border-yellow-100"
    : "bg-gray-50 border-gray-100";

  return (
    <div className={`p-3 rounded-lg border ${bg}`}>
      <p className="text-xs font-semibold text-gray-600 mb-1.5">{title}</p>
      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{content}</p>
    </div>
  );
}
