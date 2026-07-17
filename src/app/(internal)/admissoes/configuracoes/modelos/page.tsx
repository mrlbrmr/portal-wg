import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "@/components/internal/admissao/NewTemplateForm";
import {
  TemplateEditor,
  type TemplateDetail,
} from "@/components/internal/admissao/TemplateEditor";

export const metadata: Metadata = { title: "Modelos de Checklist — RH" };

export default async function ModelosPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const [session, { t }] = await Promise.all([auth(), searchParams]);
  if (session?.user.role !== "ADMIN_RH") redirect("/admissoes");

  const [templates, positions, selected] = await Promise.all([
    prisma.checklistTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, position: { select: { name: true } } },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    t
      ? prisma.checklistTemplate.findUnique({
          where: { id: t },
          select: {
            id: true,
            name: true,
            positionId: true,
            groups: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                name: true,
                items: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
              },
            },
          },
        })
      : null,
  ]);

  const detail: TemplateDetail | null = selected;

  return (
    <div className="max-w-6xl">
      <Link
        href="/admissoes/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Configurações
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> Modelos de Checklist
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Templates aplicáveis por cargo às novas admissões.
          </p>
        </div>
        <NewTemplateForm positions={positions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-900">
            Modelos
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 px-4">Nenhum modelo criado.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <Link
                  key={tpl.id}
                  href={`/admissoes/configuracoes/modelos?t=${tpl.id}`}
                  className={`block px-4 py-2.5 transition-colors ${
                    t === tpl.id ? "bg-wg-green/10" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{tpl.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tpl.position?.name ?? "Todos os cargos"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {detail ? (
          <TemplateEditor key={detail.id} template={detail} positions={positions} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <p className="text-sm text-gray-400 text-center py-20">
              Selecione um modelo à esquerda ou crie um novo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
