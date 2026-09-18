// Templates HTML dos e-mails transacionais do fluxo de Requisição de Pessoal.
// HTML de e-mail é inline por necessidade (clientes ignoram <style> externo).

import { getAppBaseUrl } from "@/lib/app-url";

const GREEN = "#90CB46";
const GREEN_DARK = "#4F6930";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout({
  title,
  subtitle,
  body,
  accent = GREEN,
}: {
  title: string;
  subtitle: string;
  body: string;
  accent?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:${accent};padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:20px">${escapeHtml(title)}</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.88);font-size:14px">${escapeHtml(subtitle)}</p>
    </div>
    <div style="padding:24px 32px">
      ${body}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Portal de Carreiras — Grupo WG Baterias. Mensagem automática, não responda.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function table(rows: Array<[string, string]>): string {
  const body = rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;background:#f9fafb;width:200px;vertical-align:top;border-bottom:1px solid #e5e7eb">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#111827;white-space:pre-wrap;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">${body}</table>`;
}

function button(href: string, label: string, color = GREEN_DARK): string {
  return `<p style="margin:24px 0 0">
    <a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px">${escapeHtml(label)}</a>
  </p>`;
}

/** E-mail para o RH quando um gestor envia uma nova requisição. */
export function jobRequestReceivedEmail(input: {
  requesterName: string;
  rows: Array<[string, string]>;
}): { subject: string; html: string } {
  const url = `${getAppBaseUrl()}/vagas/solicitacoes`;
  const funcao = input.rows.find(([label]) => /fun[çc][ãa]o|cargo/i.test(label))?.[1] ?? "sem título";

  return {
    subject: `Nova requisição de vaga: ${funcao} — ${input.requesterName || "gestor não informado"}`,
    html: layout({
      title: "Nova Requisição de Pessoal",
      subtitle: "Recebida pelo Portal de Carreiras WG",
      body: `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">
          A requisição entrou na fila e está aguardando análise do time de Gente &amp; Gestão.
        </p>
        ${table(input.rows)}
        ${button(url, "Analisar solicitação")}
      `,
    }),
  };
}

export type DecisionKind = "IN_REVIEW" | "RETURNED" | "APPROVED" | "REJECTED" | "CANCELLED";

const DECISION_COPY: Record<
  DecisionKind,
  { title: string; subtitle: string; accent: string; lead: (t: string) => string }
> = {
  IN_REVIEW: {
    title: "Sua requisição está em análise",
    subtitle: "Gente & Gestão — Grupo WG Baterias",
    accent: "#3C56A8",
    lead: (t) => `A requisição para <strong>${t}</strong> foi recebida e está sendo analisada pelo RH.`,
  },
  RETURNED: {
    title: "Requisição devolvida para ajustes",
    subtitle: "Precisamos de mais informações",
    accent: "#B4791C",
    lead: (t) =>
      `A requisição para <strong>${t}</strong> precisa de ajustes antes de seguir para aprovação.`,
  },
  APPROVED: {
    title: "Requisição aprovada",
    subtitle: "A vaga será aberta pelo RH",
    accent: GREEN,
    lead: (t) =>
      `A requisição para <strong>${t}</strong> foi aprovada. O time de Gente &amp; Gestão já está preparando a divulgação.`,
  },
  REJECTED: {
    title: "Requisição não aprovada",
    subtitle: "Gente & Gestão — Grupo WG Baterias",
    accent: "#9A3B3B",
    lead: (t) => `A requisição para <strong>${t}</strong> não foi aprovada neste momento.`,
  },
  CANCELLED: {
    title: "Requisição cancelada",
    subtitle: "Gente & Gestão — Grupo WG Baterias",
    accent: "#6B7280",
    lead: (t) => `A requisição para <strong>${t}</strong> foi cancelada.`,
  },
};

/** E-mail para o gestor a cada decisão do RH sobre a requisição. */
export function jobRequestDecisionEmail(input: {
  kind: DecisionKind;
  jobTitle: string;
  requesterName: string | null;
  note?: string | null;
  decidedBy?: string | null;
}): { subject: string; html: string } {
  const copy = DECISION_COPY[input.kind];
  const title = escapeHtml(input.jobTitle || "vaga sem título");
  const saudacao = input.requesterName ? `Olá, ${escapeHtml(input.requesterName)}!` : "Olá!";

  const noteBlock = input.note?.trim()
    ? `<div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border-left:3px solid ${copy.accent};border-radius:6px">
         <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Observação do RH</p>
         <p style="margin:0;font-size:14px;color:#111827;white-space:pre-wrap">${escapeHtml(input.note)}</p>
       </div>`
    : "";

  const assinatura = input.decidedBy
    ? `<p style="margin:20px 0 0;font-size:13px;color:#6b7280">— ${escapeHtml(input.decidedBy)}, Gente &amp; Gestão</p>`
    : "";

  const reenvio =
    input.kind === "RETURNED"
      ? button(`${getAppBaseUrl()}/solicitar-vaga`, "Reenviar requisição ajustada", "#B4791C")
      : "";

  return {
    subject: `${copy.title}: ${input.jobTitle || "vaga sem título"}`,
    html: layout({
      title: copy.title,
      subtitle: copy.subtitle,
      accent: copy.accent,
      body: `
        <p style="margin:0 0 12px;font-size:14px;color:#374151">${saudacao}</p>
        <p style="margin:0;font-size:14px;color:#374151">${copy.lead(title)}</p>
        ${noteBlock}
        ${reenvio}
        ${assinatura}
      `,
    }),
  };
}
