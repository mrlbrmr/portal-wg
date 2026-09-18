// Gera os HTMLs dos e-mails transacionais em disco para conferir o visual sem
// precisar disparar envio real.
//
//   node_modules/.bin/tsx scripts/_preview-emails.ts [pasta-de-saida]
//
// Abra os arquivos no navegador. Lembre que o Outlook desktop renderiza com o motor
// do Word: o navegador mostra o melhor caso, não o pior.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jobRequestDecisionEmail, jobRequestReceivedEmail } from "../src/lib/email-templates";

const outDir = process.argv[2] ?? join(process.cwd(), ".email-preview");
mkdirSync(outDir, { recursive: true });

const amostra: Array<[string, string]> = [
  ["Gestor(a)", "Daniel Marchioti"],
  ["E-mail do gestor(a)", "daniel.marchioti@wgbaterias.com.br"],
  ["Função", "Assistente Comercial"],
  ["Quantidade de posições", "1"],
  ["Tipo de contratação", "CLT"],
  ["Horário de trabalho", "Seg a Sex, das 08h00 às 18h00"],
  ["Local de trabalho", "São José dos Pinhais"],
  ["Motivo da abertura", "Substituição"],
  ["Nome do colaborador substituído", "João da Silva"],
  ["Faixa salarial pretendida", "R$ 2.800 a R$ 3.200"],
  [
    "Perfil do candidato",
    "Experiência com CRM e ERP, pacote Office, familiaridade com IA.\nPerfil comunicativo e organizado.",
  ],
];

const arquivos: Array<[string, { subject: string; html: string }]> = [
  ["01-rh-nova-requisicao.html", jobRequestReceivedEmail({ requesterName: "Daniel Marchioti", jobTitle: "Assistente Comercial", requestCode: "REQ-2026-0042", rows: amostra })],
  [
    "02-gestor-aprovada.html",
    jobRequestDecisionEmail({
      kind: "APPROVED",
      jobTitle: "Assistente Comercial",
      requesterName: "Daniel Marchioti",
      note: "Aprovada com 1 posição. Vamos publicar hoje e alinhar o perfil na quinta.",
      decidedBy: "Murilo Bremer",
    }),
  ],
  [
    "03-gestor-devolvida.html",
    jobRequestDecisionEmail({
      kind: "RETURNED",
      jobTitle: "Assistente Comercial",
      requesterName: "Daniel Marchioti",
      note: "Faltou a faixa salarial e a data prevista de início. Pode reenviar com esses dois campos?",
      decidedBy: "Murilo Bremer",
    }),
  ],
  [
    "04-gestor-reprovada.html",
    jobRequestDecisionEmail({
      kind: "REJECTED",
      jobTitle: "Assistente Comercial",
      requesterName: "Daniel Marchioti",
      note: "Headcount da área já está fechado para o trimestre. Revisamos em janeiro.",
      decidedBy: "Murilo Bremer",
    }),
  ],
];

for (const [nome, { subject, html }] of arquivos) {
  writeFileSync(join(outDir, nome), html, "utf8");
  console.log(`${nome.padEnd(30)} ${subject}`);
}
console.log(`\nHTMLs gerados em ${outDir}`);
