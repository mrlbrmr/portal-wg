// Camada única de envio de e-mail transacional (Resend).
//
// Todo envio do portal passa por aqui: se as variáveis de ambiente não estiverem
// configuradas, `sendEmail` NÃO lança — apenas registra o motivo e devolve
// `{ sent: false }`. Assim o fluxo de negócio (aprovar uma vaga, receber uma
// solicitação) nunca falha por causa de e-mail.
//
// Env necessárias:
//   RESEND_API_KEY     — chave da API (https://resend.com/api-keys)
//   RESEND_FROM_EMAIL  — remetente verificado (ex: "RH WG <rh@wgbaterias.com.br>")
//   RH_EMAIL           — caixa do time de Gente & Gestão (destino das notificações internas)

import { Resend } from "resend";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function rhInboxEmail(): string | null {
  return process.env.RH_EMAIL ?? null;
}

/** Valida um e-mail de forma permissiva (evita disparo com string quebrada). */
export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      `[email] envio ignorado ("${subject}"): defina RESEND_API_KEY e RESEND_FROM_EMAIL.`
    );
    return { sent: false, reason: "not_configured" };
  }

  const recipients = (Array.isArray(to) ? to : [to]).filter(isValidEmail);
  if (recipients.length === 0) {
    console.warn(`[email] envio ignorado ("${subject}"): nenhum destinatário válido.`);
    return { sent: false, reason: "no_recipient" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("[email] resend error:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] falha inesperada:", err);
    return { sent: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
