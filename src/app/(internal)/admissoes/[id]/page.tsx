import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ElementType } from "react";
import {
  ArrowLeft,
  Pencil,
  Briefcase,
  Building2,
  MapPin,
  Calendar,
  Cake,
  Mail,
  Phone,
  FileText,
  DollarSign,
  User,
  Clock,
  Shirt,
  Stethoscope,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AdmissionChecklist,
  type ChecklistGroupView,
} from "@/components/internal/admissao/AdmissionChecklist";
import {
  AdmissionAttachments,
  type AttachmentView,
} from "@/components/internal/admissao/AdmissionAttachments";

export const metadata: Metadata = { title: "Ficha da admissão — RH" };

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null;
}
function dateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function AdmissaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, admission, documentTypes, templates, users] = await Promise.all([
    auth(),
    prisma.admission.findFirst({
      where: { id, deletedAt: null },
      include: {
        position: { select: { name: true } },
        company: { select: { name: true } },
        branch: { select: { name: true } },
        stage: { select: { name: true, color: true } },
        checklistGroups: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.documentType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, required: true } }),
    prisma.checklistTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  if (!admission) notFound();

  const canManage = session?.user.role === "ADMIN_RH";
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const groups: ChecklistGroupView[] = admission.checklistGroups.map((g) => {
    // Os itens vêm achatados (pais e subtarefas compartilham groupId); aninha as
    // subtarefas sob seus pais mantendo a ordem por sortOrder.
    const children = g.items.filter((it) => it.parentId);
    const topLevel = g.items.filter((it) => !it.parentId);
    return {
      id: g.id,
      name: g.name,
      items: topLevel.map((it) => ({
        id: it.id,
        name: it.name,
        status: it.status,
        dueDate: dateInput(it.dueDate),
        subtasks: children
          .filter((c) => c.parentId === it.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            dueDate: dateInput(c.dueDate),
            subtasks: [],
          })),
      })),
    };
  });

  const attachments: AttachmentView[] = admission.attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    sizeBytes: a.sizeBytes != null ? Number(a.sizeBytes) : null,
    createdAt: a.createdAt.toISOString(),
    documentTypeId: a.documentTypeId,
  }));

  const salaryFmt =
    admission.salary != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          Number(admission.salary)
        )
      : null;

  const initials = admission.fullName.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link
          href="/admissoes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" /> Admissões
        </Link>
        {canManage && (
          <Link
            href={`/admissoes/${id}/editar`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 px-4 py-2 rounded-full transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar admissão
          </Link>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-wg-green/15 text-wg-green-dark grid place-items-center text-lg font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{admission.fullName}</h1>
            <p className="text-sm text-gray-500">
              {admission.position?.name ?? "Cargo não definido"} ·{" "}
              {admission.branch?.name ?? "Filial —"}
            </p>
          </div>
        </div>
        {admission.stage && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
            style={{
              backgroundColor: `${admission.stage.color}1f`,
              color: admission.stage.color,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: admission.stage.color }} />
            {admission.stage.name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Informações</h2>
          <div className="grid grid-cols-1 gap-4">
            <Info icon={Briefcase} label="Cargo" value={admission.position?.name} />
            <Info icon={Building2} label="Empresa" value={admission.company?.name} />
            <Info icon={MapPin} label="Filial" value={admission.branch?.name} />
            <Info icon={User} label="Responsável" value={admission.responsibleId ? userMap.get(admission.responsibleId) : null} />
            <Info icon={Calendar} label="Data de início" value={fmtDate(admission.startDate)} />
            <Info icon={Cake} label="Nascimento" value={fmtDate(admission.birthDate)} />
            <Info icon={Mail} label="E-mail" value={admission.email} />
            <Info icon={Phone} label="Telefone" value={admission.phone} />
            <Info icon={FileText} label="CPF" value={admission.cpf} />
            <Info icon={DollarSign} label="Salário" value={salaryFmt} />
            <Info icon={User} label="Gestor" value={admission.managerName} />
            <Info icon={Clock} label="Turno" value={admission.shift} />
            <Info icon={Shirt} label="Uniforme (camiseta)" value={admission.uniformShirt} />
            <Info icon={Shirt} label="Uniforme (calça)" value={admission.uniformPants} />
            <Info icon={Shirt} label="Uniforme (sapato)" value={admission.uniformShoe} />
            <Info icon={Stethoscope} label="Exame médico" value={fmtDate(admission.medicalExamDate)} />
            {admission.notes && (
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Observações</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{admission.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <AdmissionChecklist
            admissionId={id}
            canManage={canManage}
            groups={groups}
            templates={templates}
          />
          <AdmissionAttachments
            admissionId={id}
            canManage={canManage}
            attachments={attachments}
            documentTypes={documentTypes}
          />
        </div>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400 flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</div>
    </div>
  );
}
