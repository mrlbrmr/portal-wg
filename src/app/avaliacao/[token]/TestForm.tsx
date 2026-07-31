"use client"

import { useState } from "react"
import { Clock, CheckCircle2, AlertCircle, Loader2, ChevronRight } from "lucide-react"
import type { Question } from "@/lib/avaliacoes/schema"

interface TemplateInfo {
  name: string
  kind: string
  estimatedMin: number | null
  instructions: string | null
  passingScore: number | null
  questions: Question[]
}

interface Props {
  token: string
  sessionId: string
  candidateName: string
  template: TemplateInfo
}

type Answers = Record<string, string>

interface ResultData {
  score: number | null
  outcome: "PASS" | "FAIL" | "PENDING_REVIEW"
  scoreBreakdown: Record<string, unknown>
}

const LIKERT_LABELS = ["", "Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"]

function QuestionCard({
  q,
  index,
  answer,
  onChange,
}: {
  q: Question
  index: number
  answer: string | undefined
  onChange: (val: string) => void
}) {
  if (q.type === "MULTIPLE_CHOICE") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-3">
          <span className="text-gray-400 mr-1.5">{index}.</span>
          {q.text}
          {q.weight && q.weight > 1 && (
            <span className="ml-2 text-xs text-purple-600 font-medium">(peso {q.weight})</span>
          )}
        </p>
        <div className="flex flex-col gap-2">
          {(q.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name={q.id}
                value={opt}
                checked={answer === opt}
                onChange={() => onChange(opt)}
                className="w-4 h-4 accent-wg-green shrink-0"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (q.type === "TRUE_FALSE") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-3">
          <span className="text-gray-400 mr-1.5">{index}.</span>
          {q.text}
        </p>
        <div className="flex gap-4">
          {["Verdadeiro", "Falso"].map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name={q.id}
                value={opt}
                checked={answer === opt}
                onChange={() => onChange(opt)}
                className="w-4 h-4 accent-wg-green"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (q.type === "SCALE_LIKERT") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-4">
          <span className="text-gray-400 mr-1.5">{index}.</span>
          {q.text}
        </p>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((v) => {
            const val = String(v)
            const selected = answer === val
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(val)}
                title={LIKERT_LABELS[v]}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 transition-colors min-w-[52px] ${
                  selected
                    ? "border-wg-green bg-wg-green/10 text-wg-green-dark"
                    : "border-gray-200 text-gray-600 hover:border-wg-green/50"
                }`}
              >
                <span className="text-base font-bold leading-none">{v}</span>
                <span className="text-[10px] leading-tight text-center hidden sm:block">
                  {LIKERT_LABELS[v]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-400 sm:hidden">
          <span>Discordo totalmente</span>
          <span>Concordo totalmente</span>
        </div>
      </div>
    )
  }

  // SHORT_TEXT
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-800 mb-3">
        <span className="text-gray-400 mr-1.5">{index}.</span>
        {q.text}
      </p>
      <textarea
        rows={3}
        value={answer ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escreva sua resposta aqui..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-wg-green focus:outline-none focus:ring-2 focus:ring-wg-green/30 resize-y"
      />
    </div>
  )
}

function ResultScreen({ result, passingScore }: { result: ResultData; passingScore: number | null }) {
  const bigFive = result.scoreBreakdown?.bigFive as Record<string, number | null> | undefined

  if (bigFive) {
    const dimLabels: Record<string, string> = {
      O: "Abertura a experiências",
      C: "Conscienciosidade",
      E: "Extroversão",
      A: "Amabilidade",
      N: "Neuroticismo",
    }
    return (
      <div className="max-w-xl mx-auto mt-10 px-4 pb-16">
        <div className="text-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Avaliação enviada com sucesso!</h1>
          <p className="text-gray-500 text-sm mt-1">O time de RH irá analisar seu perfil em breve.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Perfil Big Five</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(dimLabels).map(([dim, label]) => {
              const val = bigFive[dim]
              return (
                <div key={dim}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">{val !== null ? `${val}%` : "—"}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-wg-green rounded-full transition-all"
                      style={{ width: val !== null ? `${val}%` : "0%" }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (result.outcome === "PENDING_REVIEW") {
    return (
      <div className="max-w-lg mx-auto mt-20 px-4 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Respostas enviadas!</h1>
        <p className="text-gray-500 text-sm">
          Suas respostas foram registradas com sucesso. O time de RH irá avaliá-las e entrará em contato em breve.
        </p>
      </div>
    )
  }

  const passed = result.outcome === "PASS"
  return (
    <div className="max-w-lg mx-auto mt-20 px-4 text-center">
      {passed ? (
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
      ) : (
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      )}
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        {passed ? "Parabéns!" : "Avaliação concluída"}
      </h1>
      {result.score !== null && (
        <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-5 py-2 mb-3">
          <span className="text-2xl font-extrabold text-gray-900">{result.score}</span>
          <span className="text-gray-500 text-sm">/ 100</span>
          {passingScore !== null && (
            <span className="text-gray-400 text-xs ml-1">(mínimo {passingScore})</span>
          )}
        </div>
      )}
      <p className="text-gray-500 text-sm">
        {passed
          ? "Você atingiu a pontuação necessária. O time de RH entrará em contato em breve."
          : "O time de RH irá analisar os resultados e entrará em contato em breve."}
      </p>
    </div>
  )
}

export function TestForm({ token, sessionId, candidateName, template }: Props) {
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const questions = template.questions
  const totalAnswered = questions.filter((q) => {
    const a = answers[q.id]
    return a !== undefined && a.trim() !== ""
  }).length

  function setAnswer(qId: string, val: string) {
    setAnswers((prev) => ({ ...prev, [qId]: val }))
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/avaliacao/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar respostas. Tente novamente.")
        return
      }
      setResult(data)
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return <ResultScreen result={result} passingScore={template.passingScore} />
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h1 className="text-lg font-bold text-gray-900">{template.name}</h1>
        {candidateName && (
          <p className="text-sm text-gray-500 mt-0.5">Candidato(a): {candidateName}</p>
        )}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {template.estimatedMin && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Tempo estimado: {template.estimatedMin} min
            </span>
          )}
          <span className="text-xs text-gray-500">
            {questions.length} {questions.length === 1 ? "questão" : "questões"}
          </span>
        </div>
        {template.instructions && (
          <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 whitespace-pre-wrap">
            {template.instructions}
          </div>
        )}
      </div>

      {/* Progresso */}
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
        <span>{totalAnswered} de {questions.length} respondidas</span>
        <span className="font-medium text-wg-green-dark">
          {questions.length > 0 ? Math.round((totalAnswered / questions.length) * 100) : 0}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-wg-green rounded-full transition-all"
          style={{ width: questions.length > 0 ? `${(totalAnswered / questions.length) * 100}%` : "0%" }}
        />
      </div>

      {/* Questões */}
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i + 1}
            answer={answers[q.id]}
            onChange={(val) => setAnswer(q.id, val)}
          />
        ))}
      </div>

      {/* Confirmar + Enviar */}
      {error && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {!confirmed ? (
        <button
          type="button"
          onClick={() => {
            if (totalAnswered < questions.length) {
              const unanswered = questions.length - totalAnswered
              setError(
                `Ainda há ${unanswered} ${unanswered === 1 ? "questão sem resposta" : "questões sem resposta"}. Verifique e tente novamente.`
              )
              return
            }
            setError(null)
            setConfirmed(true)
          }}
          className="mt-8 w-full bg-wg-green hover:bg-wg-green-bright text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Revisar e enviar
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Confirmar envio?</p>
          <p className="text-sm text-amber-700 mb-4">
            Após enviar, suas respostas não poderão ser alteradas.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmed(false)}
              disabled={submitting}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-wg-green hover:bg-wg-green-bright text-black font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Enviando…" : "Confirmar envio"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
