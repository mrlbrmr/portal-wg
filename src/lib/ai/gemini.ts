// Cliente único do Google Gemini (plano gratuito do AI Studio) — toda IA do portal passa por aqui.
// Instância lazy: não quebra o build/import se GEMINI_API_KEY não existir.

import type { GoogleGenAI, Part } from '@google/genai'

/** Modelo padrão; pode ser trocado sem deploy de código via env GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash'

export function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
}

export function getGeminiClient(): GoogleGenAI {
  const { GoogleGenAI } = require('@google/genai') as typeof import('@google/genai')
  const apiKey = getGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado')
  return new GoogleGenAI({ apiKey })
}

/** Parte de arquivo inline (imagem ou PDF) para mandar junto do prompt. */
export function inlineFile(mimeType: string, base64: string): Part {
  return { inlineData: { mimeType, data: base64 } }
}

/**
 * Gera uma resposta JSON e já faz o parse. Aceita texto puro ou partes multimodais.
 * Lança erro se a resposta não for JSON válido.
 */
export async function generateJson<T>(opts: {
  parts: Array<Part | string>
  system?: string
  maxOutputTokens?: number
}): Promise<T> {
  const ai = getGeminiClient()
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: opts.parts.map((p) => (typeof p === 'string' ? { text: p } : p)) }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: 'application/json',
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  })
  const raw = (response.text ?? '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Resposta da IA inválida: ${raw.slice(0, 200)}`)
  }
}

/** Traduz falhas da API do Gemini em um motivo que o RH entende. */
export function describeGeminiError(err: unknown): string {
  const status = (err as { status?: number })?.status
  const message = err instanceof Error ? err.message : String(err)
  if (/GEMINI_API_KEY não configurado/.test(message))
    return 'IA não configurada (GEMINI_API_KEY ausente) — revisão manual necessária.'
  if (status === 400 && /API key/i.test(message)) return 'IA indisponível: chave do Gemini inválida. Revise manualmente.'
  if (status === 401 || status === 403) return 'IA indisponível: chave do Gemini sem permissão. Revise manualmente.'
  if (status === 429)
    return 'Limite gratuito do Gemini atingido no momento. Tente validar novamente em alguns minutos.'
  if (status !== undefined && status >= 500) return 'IA temporariamente indisponível. Tente validar novamente em alguns minutos.'
  return 'Erro na validação automática — revisão manual necessária.'
}
