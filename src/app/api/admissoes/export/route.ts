import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmissionSession } from "@/lib/admissao/permissions";

// GET /api/admissoes/export — exporta as admissões ativas em .xlsx.
// Leitura = qualquer usuário interno autenticado (mesma regra da listagem).
export async function GET() {
  const access = await requireAdmissionSession();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Não autenticado" : "Não autorizado" },
      { status: access.status }
    );
  }

  const [admissions, users] = await Promise.all([
    prisma.admission.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        position: { select: { name: true } },
        company: { select: { name: true } },
        branch: { select: { name: true } },
        stage: { select: { name: true } },
        checklistItems: { select: { status: true } },
        attachments: { select: { documentTypeId: true } },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const requiredDocTypes = await prisma.documentType.findMany({
    where: { required: true },
    select: { id: true },
  });
  const requiredIds = requiredDocTypes.map((d) => d.id);

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal WG";
  wb.created = new Date();
  const ws = wb.addWorksheet("Admissões");

  ws.columns = [
    { header: "Nome", key: "fullName", width: 28 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "E-mail", key: "email", width: 26 },
    { header: "Telefone", key: "phone", width: 16 },
    { header: "Nascimento", key: "birthDate", width: 13 },
    { header: "Cargo", key: "position", width: 22 },
    { header: "Empresa", key: "company", width: 20 },
    { header: "Filial", key: "branch", width: 18 },
    { header: "Etapa", key: "stage", width: 16 },
    { header: "Responsável", key: "responsible", width: 20 },
    { header: "Gestor", key: "manager", width: 20 },
    { header: "Data de início", key: "startDate", width: 14 },
    { header: "Exame médico", key: "medicalExamDate", width: 14 },
    { header: "Salário", key: "salary", width: 14 },
    { header: "Turno", key: "shift", width: 14 },
    { header: "Uniforme (camiseta)", key: "uniformShirt", width: 18 },
    { header: "Uniforme (calça)", key: "uniformPants", width: 16 },
    { header: "Uniforme (sapato)", key: "uniformShoe", width: 16 },
    { header: "Checklist %", key: "checklistPct", width: 12 },
    { header: "Docs obrigatórios %", key: "docsPct", width: 18 },
    { header: "Criado em", key: "createdAt", width: 14 },
  ];

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";

  for (const a of admissions) {
    const items = a.checklistItems;
    const doneItems = items.filter((i) => i.status === "DONE").length;
    const checklistPct = items.length > 0 ? Math.round((doneItems / items.length) * 100) : null;

    const attachedTypeIds = new Set(
      a.attachments.map((x) => x.documentTypeId).filter((x): x is string => !!x)
    );
    const docsDone = requiredIds.filter((id) => attachedTypeIds.has(id)).length;
    const docsPct =
      requiredIds.length > 0 ? Math.round((docsDone / requiredIds.length) * 100) : null;

    ws.addRow({
      fullName: a.fullName,
      cpf: a.cpf ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
      birthDate: fmtDate(a.birthDate),
      position: a.position?.name ?? "",
      company: a.company?.name ?? "",
      branch: a.branch?.name ?? "",
      stage: a.stage?.name ?? "",
      responsible: a.responsibleId ? userMap.get(a.responsibleId) ?? "" : "",
      manager: a.managerName ?? "",
      startDate: fmtDate(a.startDate),
      medicalExamDate: fmtDate(a.medicalExamDate),
      salary: a.salary != null ? Number(a.salary) : "",
      shift: a.shift ?? "",
      uniformShirt: a.uniformShirt ?? "",
      uniformPants: a.uniformPants ?? "",
      uniformShoe: a.uniformShoe ?? "",
      checklistPct: checklistPct != null ? checklistPct / 100 : "",
      docsPct: docsPct != null ? docsPct / 100 : "",
      createdAt: fmtDate(a.createdAt),
    });
  }

  // Formatação: cabeçalho em negrito, moeda e porcentagem.
  ws.getRow(1).font = { bold: true };
  ws.getColumn("salary").numFmt = 'R$ #,##0.00';
  ws.getColumn("checklistPct").numFmt = "0%";
  ws.getColumn("docsPct").numFmt = "0%";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="admissoes-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
