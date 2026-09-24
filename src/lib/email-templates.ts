// Templates HTML dos e-mails transacionais do fluxo de Requisição de Pessoal.
//
// Regras de HTML para e-mail (não são preciosismo — o Outlook desktop renderiza com o
// motor do Word e ignora CSS moderno):
//   • layout em <table role="presentation">, largura FIXA de 600px (max-width não funciona);
//   • nada de flex/grid/position; espaçamento vem de padding em <td>;
//   • botão "bulletproof": <a> com padding dentro de um <td> colorido + fallback VML p/ Outlook;
//   • border-radius e box-shadow são ignorados no Outlook — usados só como refinamento;
//   • fontes web-safe (Segoe UI/Arial); Sora e Inter não existem no cliente de e-mail;
//   • preheader oculto define a prévia mostrada na lista de mensagens.

import { getAppBaseUrl } from "@/lib/app-url";

const GREEN = "#90CB46";
const GREEN_DARK = "#4F6930";
const INK = "#1A2213";
const INK_SOFT = "#55614A";
const BORDER = "#E3E8DC";
const CANVAS = "#F1F3EE";
const FONT =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bloco invisível que o cliente usa como prévia ao lado do assunto. */
function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(
    text
  )}</div>`;
}

interface LayoutInput {
  /** Texto de prévia na caixa de entrada. */
  preview: string;
  /** Faixa de status no topo do card (cor + rótulo curto). */
  chip?: { label: string; bg: string; color: string };
  title: string;
  /** Conteúdo já em HTML de e-mail (linhas de <tr>). */
  body: string;
}

function layout({ preview, chip, title, body }: LayoutInput): string {
  const chipRow = chip
    ? `<tr>
         <td style="padding:0 32px 14px 32px">
           <table role="presentation" cellpadding="0" cellspacing="0" border="0">
             <tr>
               <td bgcolor="${chip.bg}" style="padding:5px 12px;border-radius:999px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${chip.color}">
                 ${escapeHtml(chip.label)}
               </td>
             </tr>
           </table>
         </td>
       </tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style type="text/css">
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  a{color:${GREEN_DARK}}
  @media only screen and (max-width:620px){
    .card{width:100% !important}
    .gutter{padding-left:20px !important;padding-right:20px !important}
    .stack{display:block !important;width:100% !important}
    .label-cell{padding-bottom:2px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
${preheader(preview)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CANVAS}" style="background-color:${CANVAS};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:10px;">

        <!-- filete da marca -->
        <tr><td bgcolor="${GREEN}" height="4" style="height:4px;line-height:4px;font-size:0;border-radius:10px 10px 0 0;">&nbsp;</td></tr>

        <!-- cabeçalho: logo + origem -->
        <tr>
          <td class="gutter" style="padding:22px 32px 10px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" valign="middle" width="46" style="width:46px;font-size:0;">
                  <img src="${getAppBaseUrl()}/logo-wg.png" width="46" height="46" alt="Grupo WG Baterias" style="display:block;width:46px;height:46px;"/>
                </td>
                <!-- nome em texto: o cabeçalho continua legível se o cliente bloquear imagens -->
                <td align="left" valign="middle" style="padding-left:12px;font-family:${FONT};font-size:15px;font-weight:700;color:${INK};line-height:20px;">
                  Grupo WG Baterias
                </td>
                <td align="right" valign="middle" style="font-family:${FONT};font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9AA694;">
                  Portal de Carreiras
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- título -->
        <tr>
          <td class="gutter" style="padding:8px 32px 0 32px;font-family:${FONT};font-size:21px;line-height:28px;font-weight:700;color:${INK};">
            ${escapeHtml(title)}
          </td>
        </tr>
        <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
        ${chipRow}

        ${body}

        <!-- rodapé -->
        <tr>
          <td class="gutter" style="padding:20px 32px 22px 32px;border-top:1px solid ${BORDER};background-color:#FAFBF8;border-radius:0 0 10px 10px;font-family:${FONT};font-size:11.5px;line-height:17px;color:#9AA694;">
            Gente &amp; Gestão — Grupo WG Baterias<br/>
            Mensagem automática do Portal de Carreiras. Não é necessário responder.
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Parágrafo padrão do corpo. */
function paragraph(html: string): string {
  return `<tr>
    <td class="gutter" style="padding:0 32px 14px 32px;font-family:${FONT};font-size:14.5px;line-height:22px;color:${INK_SOFT};">
      ${html}
    </td>
  </tr>`;
}

/** Ficha de dados: rótulo à esquerda, valor à direita, empilhando no mobile. */
function dataTable(rows: Array<[string, string]>): string {
  const body = rows
    .filter(([, v]) => v && v.trim())
    .map(
      ([label, value], i) => `
        <tr>
          <td class="label-cell" width="190" valign="top" style="width:190px;padding:11px 14px;background-color:#FAFBF8;border-top:${
            i === 0 ? "0" : `1px solid ${BORDER}`
          };font-family:${FONT};font-size:12px;line-height:18px;font-weight:600;color:${INK_SOFT};">
            ${escapeHtml(label)}
          </td>
          <td valign="top" style="padding:11px 14px;border-top:${
            i === 0 ? "0" : `1px solid ${BORDER}`
          };font-family:${FONT};font-size:14px;line-height:21px;color:${INK};">
            ${escapeHtml(value).replace(/\n/g, "<br/>")}
          </td>
        </tr>`
    )
    .join("");

  return `<tr>
    <td class="gutter" style="padding:4px 32px 4px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;">
        ${body}
      </table>
    </td>
  </tr>`;
}

/** Botão que sobrevive ao Outlook (VML) e aos clientes modernos (padding no <a>). */
function button(href: string, label: string, color = GREEN_DARK): string {
  const safeLabel = escapeHtml(label);
  return `<tr>
    <td class="gutter" style="padding:20px 32px 6px 32px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:42px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${color}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:${FONT};font-size:14px;font-weight:600;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="${color}" style="border-radius:8px;">
            <a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              ${safeLabel}
            </a>
          </td>
        </tr>
      </table>
      <!--<![endif]-->
    </td>
  </tr>`;
}

/** Bloco destacado (parecer do RH) com barra lateral colorida. */
function calloutBlock(title: string, text: string, accent: string): string {
  return `<tr>
    <td class="gutter" style="padding:14px 32px 4px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFBF8;border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;">
        <tr>
          <td width="4" bgcolor="${accent}" style="width:4px;font-size:0;line-height:0;border-radius:8px 0 0 8px;">&nbsp;</td>
          <td style="padding:13px 16px;font-family:${FONT};">
            <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9AA694;padding-bottom:4px;">
              ${escapeHtml(title)}
            </div>
            <div style="font-size:14px;line-height:21px;color:${INK};">
              ${escapeHtml(text).replace(/\n/g, "<br/>")}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function spacer(height = 10): string {
  return `<tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr>`;
}

/** E-mail para o RH quando um gestor envia uma nova requisição. */
export function jobRequestReceivedEmail(input: {
  requesterName: string;
  jobTitle: string;
  requestCode?: string | null;
  requestId?: string | null;
  rows: Array<[string, string]>;
}): { subject: string; html: string } {
  const url = input.requestId
    ? `${getAppBaseUrl()}/solicitacoes/${input.requestId}`
    : `${getAppBaseUrl()}/solicitacoes`;
  const funcao = input.jobTitle || "sem título";
  const gestor = input.requesterName || "gestor não informado";
  const codigo = input.requestCode ? `${input.requestCode} · ` : "";

  return {
    subject: `Nova solicitação de vaga: ${codigo}${funcao} — ${gestor}`,
    html: layout({
      preview: `${gestor} solicitou a abertura de ${funcao}. Aguardando validação do RH.`,
      chip: { label: "Aguardando validação do RH", bg: "#E9EDFA", color: "#3C56A8" },
      title: "Nova solicitação de vaga",
      body: [
        paragraph(
          `<strong style="color:${INK}">${escapeHtml(
            gestor
          )}</strong> solicitou a abertura de <strong style="color:${INK}">${escapeHtml(
            funcao
          )}</strong>${
            input.requestCode ? ` (${escapeHtml(input.requestCode)})` : ""
          }. A solicitação entrou na fila e aguarda a validação do time de Gente &amp; Gestão.`
        ),
        dataTable(input.rows),
        button(url, "Analisar solicitação"),
        spacer(8),
      ].join(""),
    }),
  };
}

export type DecisionKind =
  | "IN_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "RECRUITING";

const DECISION_COPY: Record<
  DecisionKind,
  {
    title: string;
    chip: { label: string; bg: string; color: string };
    accent: string;
    lead: (titulo: string) => string;
    preview: (titulo: string) => string;
  }
> = {
  IN_REVIEW: {
    title: "Sua solicitação seguiu para aprovação",
    chip: { label: "Aguardando aprovação", bg: "#FCF1DD", color: "#8A5B10" },
    accent: "#B4791C",
    lead: (t) =>
      `O time de Gente &amp; Gestão validou sua solicitação para <strong style="color:${INK}">${t}</strong> e a encaminhou para aprovação. Avisaremos assim que houver uma decisão.`,
    preview: (t) => `A solicitação para ${t} foi validada e seguiu para aprovação.`,
  },
  RECRUITING: {
    title: "Processo seletivo iniciado",
    chip: { label: "Em recrutamento", bg: "#E2F0E4", color: "#2F6B4F" },
    accent: GREEN_DARK,
    lead: (t) =>
      `O processo seletivo de <strong style="color:${INK}">${t}</strong> foi aberto a partir da sua solicitação. A partir daqui o time de Gente &amp; Gestão conduz a divulgação, a triagem e as entrevistas.`,
    preview: (t) => `O processo seletivo de ${t} foi iniciado.`,
  },
  RETURNED: {
    title: "Requisição devolvida para ajustes",
    chip: { label: "Precisa de ajustes", bg: "#FCF1DD", color: "#8A5B10" },
    accent: "#B4791C",
    lead: (t) =>
      `A requisição para <strong style="color:${INK}">${t}</strong> precisa de alguns ajustes antes de seguir para aprovação. Veja abaixo o que falta e reenvie o formulário.`,
    preview: (t) => `A requisição para ${t} precisa de ajustes antes da aprovação.`,
  },
  APPROVED: {
    title: "Requisição aprovada",
    chip: { label: "Aprovada", bg: "#EAF4DC", color: GREEN_DARK },
    accent: GREEN,
    lead: (t) =>
      `A requisição para <strong style="color:${INK}">${t}</strong> foi aprovada. O time de Gente &amp; Gestão já está preparando a divulgação e entrará em contato para alinhar o perfil e as etapas do processo.`,
    preview: (t) => `A requisição para ${t} foi aprovada pelo RH.`,
  },
  REJECTED: {
    title: "Requisição não aprovada",
    chip: { label: "Não aprovada", bg: "#F4E3E3", color: "#9A3B3B" },
    accent: "#9A3B3B",
    lead: (t) =>
      `A requisição para <strong style="color:${INK}">${t}</strong> não foi aprovada neste momento. O motivo está registrado abaixo — se o cenário mudar, é só enviar uma nova requisição.`,
    preview: (t) => `A requisição para ${t} não foi aprovada.`,
  },
  CANCELLED: {
    title: "Requisição cancelada",
    chip: { label: "Cancelada", bg: "#EFEFEF", color: "#6B7280" },
    accent: "#9AA694",
    lead: (t) =>
      `A requisição para <strong style="color:${INK}">${t}</strong> foi cancelada e não seguirá no processo.`,
    preview: (t) => `A requisição para ${t} foi cancelada.`,
  },
};

/** E-mail para o gestor a cada decisão do RH sobre a requisição. */
export function jobRequestDecisionEmail(input: {
  kind: DecisionKind;
  jobTitle: string;
  /** Número humano da solicitação (REQ-2026-0042), quando houver. */
  requestCode?: string | null;
  requesterName: string | null;
  note?: string | null;
  decidedBy?: string | null;
}): { subject: string; html: string } {
  const copy = DECISION_COPY[input.kind];
  const titulo = escapeHtml(input.jobTitle || "vaga sem título");
  const codigo = input.requestCode ? `${input.requestCode} · ` : "";
  const saudacao = input.requesterName
    ? `Olá, ${escapeHtml(input.requesterName.split(" ")[0])}!`
    : "Olá!";

  const blocks: string[] = [
    paragraph(`<strong style="color:${INK}">${saudacao}</strong>`),
    paragraph(copy.lead(titulo)),
  ];

  if (input.note?.trim()) {
    blocks.push(
      calloutBlock(
        input.kind === "RETURNED" ? "O que precisa ser ajustado" : "Observação do RH",
        input.note.trim(),
        copy.accent
      )
    );
  }

  if (input.kind === "RETURNED") {
    blocks.push(button(`${getAppBaseUrl()}/solicitar-vaga`, "Enviar nova solicitação", "#B4791C"));
  }

  if (input.decidedBy) {
    blocks.push(
      `<tr>
        <td class="gutter" style="padding:18px 32px 4px 32px;font-family:${FONT};font-size:13px;line-height:20px;color:#9AA694;">
          — ${escapeHtml(input.decidedBy)}, Gente &amp; Gestão
        </td>
      </tr>`
    );
  }

  blocks.push(spacer(10));

  return {
    subject: `${copy.title}: ${codigo}${input.jobTitle || "vaga sem título"}`,
    html: layout({
      preview: copy.preview(input.jobTitle || "a vaga solicitada"),
      chip: copy.chip,
      title: copy.title,
      body: blocks.join(""),
    }),
  };
}

/** E-mail para o RH quando o candidato conclui o formulário digital de admissão. */
export function admissionSubmittedEmail(input: {
  admissionId: string;
  candidateName: string;
  rows: Array<[string, string]>;
  /** Nomes dos documentos enviados (já agrupados, ex.: "RG (2 arquivos)"). */
  documents: string[];
}): { subject: string; html: string } {
  const nome = input.candidateName || "Candidato";
  const docs = input.documents.length;
  const docsLabel = docs === 1 ? "1 documento" : `${docs} documentos`;

  return {
    subject: `Documentos de admissão recebidos — ${nome}`,
    html: layout({
      preview: `${nome} concluiu o formulário de admissão e enviou ${docsLabel}.`,
      chip: { label: "Pronto para conferência", bg: "#E9EDFA", color: "#3C56A8" },
      title: "Documentos de admissão recebidos",
      body: [
        paragraph(
          `<strong style="color:${INK}">${escapeHtml(
            nome
          )}</strong> concluiu o formulário digital de admissão e enviou <strong style="color:${INK}">${docsLabel}</strong>. Os dados e anexos já estão na ficha da admissão, aguardando a conferência do time de Gente &amp; Gestão.`
        ),
        dataTable([
          ...input.rows,
          ["Documentos enviados", input.documents.join("\n") || "Nenhum anexo"],
        ]),
        button(`${getAppBaseUrl()}/admissoes/${input.admissionId}`, "Conferir admissão"),
        spacer(8),
      ].join(""),
    }),
  };
}

/** Resumo diário ao RH: candidatos que começaram o formulário de admissão e pararam. */
export function stalledAdmissionFormsEmail(input: {
  items: Array<{
    admissionId: string;
    candidateName: string;
    rows: Array<[string, string]>;
  }>;
}): { subject: string; html: string } {
  const n = input.items.length;
  const first = input.items[0]?.candidateName || "Candidato";
  const subject =
    n === 1
      ? `Formulário de admissão parado — ${first}`
      : `${n} formulários de admissão parados`;
  const intro =
    n === 1
      ? `<strong style="color:${INK}">${escapeHtml(first)}</strong> começou a enviar os documentos da admissão, mas ainda não concluiu o formulário.`
      : `<strong style="color:${INK}">${n} candidatos</strong> começaram a enviar os documentos da admissão, mas ainda não concluíram o formulário.`;

  const blocks = input.items
    .map((item) =>
      [
        paragraph(`<strong style="color:${INK};font-size:15.5px;">${escapeHtml(item.candidateName || "Candidato")}</strong>`),
        dataTable(item.rows),
        button(`${getAppBaseUrl()}/admissoes/${item.admissionId}`, "Abrir admissão"),
        spacer(18),
      ].join("")
    )
    .join("");

  return {
    subject,
    html: layout({
      preview: n === 1 ? `${first} parou no meio do formulário de admissão.` : `${n} candidatos pararam no meio do formulário de admissão.`,
      chip: { label: "Aguardando o candidato", bg: "#FCF1DD", color: "#8A5B10" },
      title: n === 1 ? "Formulário de admissão parado" : "Formulários de admissão parados",
      body: [
        paragraph(
          `${intro} Os arquivos já enviados ficam guardados: basta o candidato abrir o mesmo link, enviar o que falta e clicar em <strong style="color:${INK}">Enviar</strong>. Na ficha da admissão você copia o link para lembrá-lo.`
        ),
        spacer(4),
        blocks,
      ].join(""),
    }),
  };
}
