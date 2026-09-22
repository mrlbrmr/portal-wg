// Análise de currículo via Google Gemini — extração de texto do PDF + score de aderência à vaga.
// Usa unpdf (wrapper Node.js/edge-compatível sobre pdfjs-dist) para evitar problemas de APIs de browser
// como DOMMatrix ausente no Node.js e o bug "Command token too long" do pdf-parse antigo.

import { GEMINI_MODEL, getGeminiClient } from './gemini'

export interface CvProfile {
  experienceYears: number | null
  education: string | null
  lastPosition: string | null
  skills: string[]
}

/** Veredito da IA para um requisito da vaga — descritivo, nunca uma decisão. */
export type CvCriterionStatus = 'MEETS' | 'PARTIAL' | 'NOT_FOUND'

export interface CvCriterionAssessment {
  criterion: string
  status: CvCriterionStatus
  /** Evidência curta do currículo — ou o que não foi encontrado. */
  evidence: string | null
}

export interface CvAnalysisResult {
  profile: CvProfile
  /** 1 frase sobre o profissional, só com fatos do currículo (sem juízo sobre a vaga). */
  profileSummary: string | null
  fitScore: number        // 0–100
  fitReason: string       // 2-3 frases
  strengths: string[]     // até 3 pontos fortes em relação à vaga
  gaps: string[]          // até 3 lacunas em relação à vaga
  /** Requisitos da vaga avaliados um a um (vazio se a vaga não tem requisitos em lista). */
  criteria: CvCriterionAssessment[]
}

const CRITERION_STATUSES: CvCriterionStatus[] = ['MEETS', 'PARTIAL', 'NOT_FOUND']
const MAX_CRITERIA = 8

// ─── Extração de perfil (sem contexto de vaga) ───────────────────────────────

const EXTRACT_PROFILE_PROMPT = `Você é um especialista em recrutamento. Extraia as informações do currículo fornecido e retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON.

Formato obrigatório:
{
  "experienceYears": number | null,
  "education": string | null,
  "lastPosition": string | null,
  "skills": [string]
}

Regras:
- experienceYears: total de anos de experiência profissional (número inteiro) ou null se não identificado
- education: grau mais alto de formação (ex: "Ensino Médio", "Graduação em Administração") ou null
- lastPosition: cargo mais recente (ex: "Vendedor", "Assistente Administrativo") ou null
- skills: lista de até 8 habilidades técnicas ou comportamentais relevantes
- Responda em português brasileiro`

export interface CvProfileExtraction extends CvProfile {
  extractedAt: string
  modelUsed: string
}

/**
 * Extrai texto de um buffer PDF usando unpdf (wrapper serverless-compatível do pdfjs-dist).
 * Evita os bugs do pdf-parse (token too long) e do pdfjs-dist cru (DOMMatrix not defined).
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf')
  const { text } = await extractText(new Uint8Array(buffer))
  return (Array.isArray(text) ? text.join('\n') : String(text)).trim()
}

/**
 * Extrai perfil estruturado de um currículo PDF sem contexto de vaga.
 * Usado na inscrição pública (assíncrono, pós-resposta).
 */
export async function extractCvProfile(pdfBuffer: Buffer): Promise<CvProfileExtraction> {
  let pdfText: string
  try {
    pdfText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    throw new Error(
      `Falha ao ler o PDF: ${err instanceof Error ? err.message : 'arquivo inválido'}`,
    )
  }

  if (!pdfText) throw new Error('PDF sem texto extraível (pode ser scan/imagem).')

  const ai = getGeminiClient()

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `CURRÍCULO:\n${pdfText.slice(0, 8000)}\n\nExtraia as informações e retorne o JSON.`,
    config: {
      systemInstruction: EXTRACT_PROFILE_PROMPT,
      maxOutputTokens: 1024,
    },
  })

  const raw = response.text ?? ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: Partial<CvProfile>
  try {
    parsed = JSON.parse(cleaned) as Partial<CvProfile>
  } catch {
    throw new Error(`Resposta IA inválida: ${raw.slice(0, 200)}`)
  }

  return {
    experienceYears: typeof parsed.experienceYears === 'number' ? parsed.experienceYears : null,
    education: parsed.education ?? null,
    lastPosition: parsed.lastPosition ?? null,
    skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 8) : [],
    extractedAt: new Date().toISOString(),
    modelUsed: `google/${GEMINI_MODEL}`,
  }
}

// ─── Análise de aderência à vaga (com contexto) ───────────────────────────────

const SYSTEM_PROMPT = `Você é um recrutador sênior experiente. Analise o currículo em relação à vaga e retorne APENAS JSON válido, sem markdown, sem texto fora do JSON.

COMO CALCULAR O fitScore:
Avalie os 4 critérios abaixo de 0 a 100 e aplique os pesos para obter o score final:
  A. Experiência relevante (peso 35%): anos/meses de experiência diretamente relacionada à função
  B. Competências técnicas (peso 30%): habilidades exigidas que o candidato demonstra no currículo
  C. Histórico de cargo (peso 20%): proximidade dos cargos anteriores com o cargo ofertado
  D. Formação acadêmica (peso 15%): compatibilidade da formação com os requisitos da vaga

fitScore = round(A*0.35 + B*0.30 + C*0.20 + D*0.15)

REGRA CRÍTICA DO fitScore: o resultado NUNCA deve ser múltiplo exato de 5 ou 10.
Se o cálculo resultar em múltiplo de 5 (ex: 70, 75, 80), ajuste ±1 ou ±2 pontos com base
nos detalhes do currículo. Use números como 67, 73, 78, 82, 91 — nunca 70, 75, 80, 85.

Formato JSON obrigatório:
{
  "profile": {
    "experienceYears": number | null,
    "education": string | null,
    "lastPosition": string | null,
    "skills": [string]
  },
  "profileSummary": "UMA frase descrevendo o profissional só com fatos do currículo (formação, área, experiências principais). Ex.: 'Profissional formado em Administração, com experiência em prospecção de clientes e rotinas administrativas.' Sem opinião e sem mencionar a vaga. null se o currículo não tiver dados suficientes.",
  "fitScore": number inteiro entre 0 e 100,
  "fitReason": "3 a 4 frases citando dados concretos do currículo (cargo, tempo, empresa) e comparando com requisitos específicos da vaga. Exemplo: 'O candidato atuou X anos como Y na empresa Z, atendendo ao requisito de experiência em W. Sua formação em... alinha-se com...'",
  "strengths": [
    "Cite a evidência específica do currículo (cargo, empresa, tempo, habilidade) e explique como ela atende a um requisito concreto da vaga",
    "...",
    "..."
  ],
  "gaps": [
    "Cite o que a vaga exige explicitamente e o que está ausente ou insuficiente no currículo do candidato",
    "...",
    "..."
  ],
  "criteria": [
    { "criterion": "requisito da vaga resumido em até 5 palavras", "status": "MEETS | PARTIAL | NOT_FOUND", "evidence": "evidência curta do currículo, ou o que não foi encontrado" }
  ]
}

Regras adicionais:
- Em strengths e gaps, sempre nomeie evidências reais: empresa, cargo, período, habilidade ou formação
- Se a vaga exige algo que o currículo não menciona, sinalize como lacuna com clareza
- criteria: avalie CADA item da lista "REQUISITOS OBRIGATÓRIOS" (quando houver), na mesma ordem, no máximo ${MAX_CRITERIA}. MEETS = o currículo demonstra; PARTIAL = demonstra em parte; NOT_FOUND = o currículo não menciona (não significa que o candidato não tenha). Sem lista de requisitos, devolva "criteria": []
- Linguagem descritiva: nunca escreva "contrate", "reprove", "candidato ideal" ou "melhor candidato"
- Responda em português brasileiro`

export async function analyzeCv(
  pdfBuffer: Buffer,
  jobTitle: string,
  jobDescription: string,
  /** Requisitos obrigatórios da vaga, em lista (screening.ts) — viram os critérios avaliados. */
  requirements: string[] = [],
): Promise<CvAnalysisResult> {
  let pdfText: string
  try {
    pdfText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    throw new Error(
      `Falha ao ler o PDF: ${err instanceof Error ? err.message : 'arquivo inválido'}. ` +
        'Verifique se o currículo não está protegido por senha.',
    )
  }

  if (!pdfText) {
    throw new Error(
      'O PDF não contém texto extraível (pode ser um scan/imagem). ' +
        'Reenvie o currículo em PDF com texto selecionável.',
    )
  }

  const userPrompt =
    `CURRÍCULO:\n${pdfText.slice(0, 8000)}\n\n` +
    `VAGA: ${jobTitle}\n\n` +
    `DESCRIÇÃO DA VAGA:\n${jobDescription.slice(0, 3000)}\n\n` +
    (requirements.length > 0
      ? `REQUISITOS OBRIGATÓRIOS:\n${requirements.slice(0, MAX_CRITERIA).map((r) => `- ${r}`).join('\n')}\n\n`
      : '') +
    `Analise o currículo acima em relação à vaga e retorne o JSON de análise.`

  const ai = getGeminiClient()

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 8192,
    },
  })

  const raw = response.text ?? ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: CvAnalysisResult
  try {
    parsed = JSON.parse(cleaned) as CvAnalysisResult
  } catch {
    throw new Error(`Resposta da IA inválida: ${raw.slice(0, 200)}`)
  }

  const criteria: CvCriterionAssessment[] = (Array.isArray(parsed.criteria) ? parsed.criteria : [])
    .filter((c) => c && typeof c.criterion === 'string' && c.criterion.trim())
    .slice(0, MAX_CRITERIA)
    .map((c) => ({
      criterion: c.criterion.trim(),
      status: CRITERION_STATUSES.includes(c.status) ? c.status : 'NOT_FOUND',
      evidence: typeof c.evidence === 'string' && c.evidence.trim() ? c.evidence.trim() : null,
    }))

  return {
    profile: {
      experienceYears: parsed.profile?.experienceYears ?? null,
      education: parsed.profile?.education ?? null,
      lastPosition: parsed.profile?.lastPosition ?? null,
      skills: Array.isArray(parsed.profile?.skills) ? parsed.profile.skills : [],
    },
    profileSummary:
      typeof parsed.profileSummary === 'string' && parsed.profileSummary.trim() ? parsed.profileSummary.trim() : null,
    criteria,
    fitScore: Math.min(100, Math.max(0, Math.round(Number(parsed.fitScore) || 0))),
    fitReason: parsed.fitReason ?? '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3) : [],
  }
}
