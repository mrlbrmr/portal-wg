import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";

export interface JobContext {
  title: string;
  requiredRequirements: string;
  desiredRequirements?: string | null;
  description: string;
}

export interface AiReviewResult {
  resumeSummary: string;
  adherenceLevel: "Alta" | "Média" | "Baixa";
  requiredMet: string;
  requiredNotEvidenced: string;
  desiredMet: string;
  strengths: string;
  interviewAttention: string;
  suggestedQuestions: string;
  finalNote: string;
  modelUsed: string;
  isMock: boolean;
}

const SYSTEM_PROMPT = `Você é um assistente de apoio ao RH para triagem curricular.
Sua função é analisar currículos e comparar com os requisitos de uma vaga específica.

REGRAS OBRIGATÓRIAS — siga todas sem exceção:
1. NUNCA aprove ou reprove candidatos automaticamente.
2. NUNCA use linguagem discriminatória ou tendenciosa.
3. IGNORE completamente: foto, gênero, idade, aparência, estado civil, religião, raça, deficiência, orientação sexual, dados de saúde, endereço residencial, nome completo.
4. Quando uma informação NÃO estiver explícita no currículo, marque como "não evidenciado" — NUNCA presuma ou infira.
5. Ausência de informação NÃO é ponto negativo absoluto — apenas "não evidenciado".
6. Baseie TODA a análise em evidências concretas do currículo e nos requisitos da vaga.
7. Use linguagem neutra, objetiva e respeitosa.
8. NUNCA crie ranking ou comparação com outros candidatos.
9. A análise é somente apoio ao RH — a decisão final SEMPRE é humana.

Formato de resposta: retorne um JSON válido com exatamente os campos especificados pelo usuário. Não inclua markdown, blocos de código ou texto fora do JSON.`;

export async function generateAiReview(
  resumeText: string,
  job: JobContext
): Promise<AiReviewResult> {
  const truncatedResume = resumeText.slice(0, 8000);

  const userPrompt = `Analise o currículo abaixo em relação à vaga especificada.

VAGA: ${job.title}
DESCRIÇÃO: ${job.description}
REQUISITOS OBRIGATÓRIOS:
${job.requiredRequirements}
REQUISITOS DESEJÁVEIS:
${job.desiredRequirements || "Não especificado"}

CURRÍCULO:
${truncatedResume}

Retorne EXATAMENTE este JSON (sem markdown, sem texto fora do JSON):
{
  "resumeSummary": "Resumo profissional objetivo do candidato baseado no currículo (máx 3 parágrafos)",
  "adherenceLevel": "Alta | Média | Baixa",
  "requiredMet": "Liste cada requisito obrigatório ATENDIDO conforme evidências do currículo",
  "requiredNotEvidenced": "Liste cada requisito obrigatório NÃO EVIDENCIADO no currículo (use 'não evidenciado', nunca 'não atende')",
  "desiredMet": "Liste cada requisito desejável ATENDIDO conforme evidências (se nenhum, escreva 'Nenhum requisito desejável evidenciado')",
  "strengths": "Pontos fortes evidenciados no currículo relevantes para a vaga",
  "interviewAttention": "Pontos que merecem aprofundamento na entrevista (não são pontos negativos, são áreas para explorar)",
  "suggestedQuestions": "3 a 5 perguntas sugeridas para a entrevista, baseadas nos pontos de atenção",
  "finalNote": "Análise gerada por IA como apoio ao RH. A decisão final sobre o candidato deve ser tomada por pessoas, com base em uma avaliação completa e humanizada."
}`;

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Resposta vazia da Groq API");
  }

  const jsonText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(jsonText);

  // Normaliza campos que o modelo pode retornar como array em vez de string
  const str = (v: unknown): string =>
    Array.isArray(v) ? v.join("\n") : String(v ?? "");

  return {
    resumeSummary: str(parsed.resumeSummary),
    adherenceLevel: parsed.adherenceLevel,
    requiredMet: str(parsed.requiredMet),
    requiredNotEvidenced: str(parsed.requiredNotEvidenced),
    desiredMet: str(parsed.desiredMet),
    strengths: str(parsed.strengths),
    interviewAttention: str(parsed.interviewAttention),
    suggestedQuestions: str(parsed.suggestedQuestions),
    finalNote: str(parsed.finalNote),
    modelUsed: MODEL,
    isMock: false,
  };
}

export function generateMockReview(job: JobContext): AiReviewResult {
  return {
    resumeSummary:
      "Profissional com trajetória consistente na área de interesse, apresentando experiências relevantes ao longo da carreira. Demonstra progressão profissional e atuação em diferentes contextos organizacionais. O currículo apresenta informações sobre formação acadêmica e histórico profissional de forma clara.",
    adherenceLevel: "Média",
    requiredMet:
      "• Requisito 1: evidenciado no currículo conforme experiência descrita\n• Requisito 2: evidenciado conforme formação acadêmica apresentada",
    requiredNotEvidenced:
      "• Requisito 3: não evidenciado no currículo\n• Requisito 4: não evidenciado no currículo",
    desiredMet:
      "• Requisito desejável 1: evidenciado\n• Requisito desejável 2: não evidenciado",
    strengths:
      "• Experiência prática na área\n• Progressão de carreira demonstrada\n• Formação acadêmica alinhada à vaga",
    interviewAttention:
      "• Aprofundar experiências específicas mencionadas brevemente\n• Verificar disponibilidade e expectativas de remuneração\n• Explorar motivações para mudança de área/empresa",
    suggestedQuestions:
      "1. Pode descrever uma situação desafiadora na sua última experiência e como resolveu?\n2. Quais são suas expectativas para essa posição em relação à sua trajetória profissional?\n3. Como você organiza suas prioridades em cenários de alta demanda?\n4. O que te motivou a se candidatar para esta vaga no Grupo WG?",
    finalNote:
      "⚠️ ANÁLISE SIMULADA (modo de desenvolvimento) — Análise gerada por IA como apoio ao RH. A decisão final sobre o candidato deve ser tomada por pessoas, com base em uma avaliação completa e humanizada.",
    modelUsed: "mock",
    isMock: true,
  };
}
