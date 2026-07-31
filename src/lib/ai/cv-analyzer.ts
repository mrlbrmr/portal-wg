// Análise de currículo via Claude Haiku — extração de texto do PDF + score de aderência à vaga.
// Usa pdf-parse@1.x (Node.js puro, sem worker) para extrair texto antes de enviar ao Claude.
// Import dinâmico evita problemas de inicialização no bundle do Next.js.

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
  pdfBuffer: Buffer,
  jobTitle: string,
  jobDescription: string,
): Promise<CvAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurado')
  }

  // Import dinâmico para não quebrar o bundle do Next.js durante o build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buffer: Buffer,
    options?: object,
  ) => Promise<{ text: string; numpages: number }>

  let pdfText: string
  try {
    const data = await pdfParse(pdfBuffer, { max: 0 })
    pdfText = (data.text ?? '').trim()
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

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
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
