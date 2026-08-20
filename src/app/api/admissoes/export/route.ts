import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const [admissionsRes, usersRes, requiredRes] = await Promise.all([
    supabase
      .from("admissions")
      .select(
        `fullName, cpf, email, phone, birthDate, responsibleId, managerName, startDate,
         medicalExamDate, salary, shift, uniformShirt, uniformPants, uniformShoe, createdAt,
         position:admission_positions(name),
         company:admission_companies(name),
         branch:admission_branches(name),
         stage:admission_stages(name),
         attachments:admission_attachments(documentTypeId)`
      )
      .is("deletedAt", null)
      .order("createdAt", { ascending: false }),
    supabase.from("users").select("id, name"),
    supabase.from("admission_document_types").select("id").eq("required", true),
  ]);

  const admissions = (admissionsRes.data ?? []) as unknown as Array<{
    fullName: string;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    responsibleId: string | null;
    managerName: string | null;
    startDate: string | null;
    medicalExamDate: string | null;
    salary: number | string | null;
    shift: string | null;
    uniformShirt: string | null;
    uniformPants: string | null;
    uniformShoe: string | null;
    createdAt: string | null;
    position: { name: string } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
    stage: { name: string } | null;
    attachments: Array<{ documentTypeId: string | null }>;
  }>;
  const users = (usersRes.data ?? []) as Array<{ id: string; name: string }>;
  const requiredIds = ((requiredRes.data ?? []) as Array<{ id: string }>).map((d) => d.id);

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
    { header: "Docs obrigatórios %", key: "docsPct", width: 18 },
    { header: "Criado em", key: "createdAt", width: 14 },
  ];

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";

  for (const a of admissions) {
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
      docsPct: docsPct != null ? docsPct / 100 : "",
      createdAt: fmtDate(a.createdAt),
    });
  }

  // Formatação: cabeçalho em negrito, moeda e porcentagem.
  ws.getRow(1).font = { bold: true };
  ws.getColumn("salary").numFmt = 'R$ #,##0.00';
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
