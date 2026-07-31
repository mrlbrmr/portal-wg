// Análise de currículo via Claude Haiku — extração de perfil + score de aderência à vaga.
// O PDF é enviado como document block (base64); o resultado é JSON estruturado.

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
  pdfBlob: Blob,
  jobTitle: string,
  jobDescription: string,
): Promise<CvAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurado')
  }

  const buffer = await pdfBlob.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const userPrompt = `Vaga: ${jobTitle}

Descrição da vaga:
${jobDescription.slice(0, 3000)}

Analise o currículo acima e retorne o JSON de análise.`

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    },
    { type: 'text', text: userPrompt },
  ]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
  // Remove possível wrapper markdown
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: CvAnalysisResult
  try {
    parsed = JSON.parse(cleaned) as CvAnalysisResult
  } catch {
    throw new Error(`Resposta da IA inválida: ${raw.slice(0, 200)}`)
  }

  // Garante os campos obrigatórios
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
