// Análise de currículo via Groq (llama-3.3-70b-versatile) — extração de texto do PDF + score de aderência à vaga.
// Usa unpdf (wrapper Node.js/edge-compatível sobre pdfjs-dist) para evitar problemas de APIs de browser
// como DOMMatrix ausente no Node.js e o bug "Command token too long" do pdf-parse antigo.

export interface CvProfile {
  experienceYears: number | null
  education: string | null
  lastPosition: string | null
  skills: string[]
}

export interface CvAnalysisResult {
  profile: CvProfile
  fitScore: number        // 0–100
  fitReason: string       // 2-3 frases
  strengths: string[]     // até 3 pontos fortes em relação à vaga
  gaps: string[]          // até 3 lacunas em relação à vaga
}

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
  const apiKey = (process.env.GROQ_API_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) throw new Error('GROQ_API_KEY não configurado')

  let pdfText: string
  try {
    pdfText = await extractTextFromPdf(pdfBuffer)
  } catch (err) {
    throw new Error(
      `Falha ao ler o PDF: ${err instanceof Error ? err.message : 'arquivo inválido'}`,
    )
  }

  if (!pdfText) throw new Error('PDF sem texto extraível (pode ser scan/imagem).')

  const { default: Groq } = await import('groq-sdk')
  const client = new Groq({ apiKey })

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 512,
    messages: [
      { role: 'system', content: EXTRACT_PROFILE_PROMPT },
      {
        role: 'user',
        content: `CURRÍCULO:\n${pdfText.slice(0, 8000)}\n\nExtraia as informações e retorne o JSON.`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
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
    modelUsed: 'groq/llama-3.3-70b-versatile',
  }
}

// ─── Análise de aderência à vaga (com contexto) ───────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em recrutamento e seleção. Analise o currículo fornecido em relação à vaga descrita e retorne APENAS um JSON válido, sem markdown, sem texto fora do JSON.

Formato obrigatório:
{
  "profile": {
    "experienceYears": number | null,
    "education": string | null,
    "lastPosition": string | null,
    "skills": [string]
  },
  "fitScore": number entre 0 e 100,
  "fitReason": "2 a 3 frases explicando o score de aderência",
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "gaps": ["lacuna 1", "lacuna 2", "lacuna 3"]
}

Regras:
- fitScore 80-100: candidato muito alinhado à vaga
- fitScore 60-79: candidato com bom potencial, alguns gaps
- fitScore 40-59: perfil parcial, gaps relevantes
- fitScore 0-39: perfil com pouca aderência à vaga
- Seja objetivo e específico nos strengths/gaps, referenciando a vaga
- Responda em português brasileiro`

export async function analyzeCv(
  pdfBuffer: Buffer,
  jobTitle: string,
  jobDescription: string,
): Promise<CvAnalysisResult> {
  // Strip BOM (U+FEFF) que editores Windows às vezes gravam no início de variáveis de ambiente
  const apiKey = (process.env.GROQ_API_KEY ?? '').replace(/^﻿/, '').trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não configurado')
  }

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
    `Analise o currículo acima em relação à vaga e retorne o JSON de análise.`

  const { default: Groq } = await import('groq-sdk')
  const client = new Groq({ apiKey })

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: CvAnalysisResult
  try {
    parsed = JSON.parse(cleaned) as CvAnalysisResult
  } catch {
    throw new Error(`Resposta da IA inválida: ${raw.slice(0, 200)}`)
  }

  return {
    profile: {
      experienceYears: parsed.profile?.experienceYears ?? null,
      education: parsed.profile?.education ?? null,
      lastPosition: parsed.profile?.lastPosition ?? null,
      skills: Array.isArray(parsed.profile?.skills) ? parsed.profile.skills : [],
    },
    fitScore: Math.min(100, Math.max(0, Math.round(Number(parsed.fitScore) || 0))),
    fitReason: parsed.fitReason ?? '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3) : [],
  }
}
