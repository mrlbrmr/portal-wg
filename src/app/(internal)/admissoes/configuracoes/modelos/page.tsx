import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewTemplateForm } from "@/components/internal/admissao/NewTemplateForm";
import { TemplateList } from "@/components/internal/admissao/TemplateList";
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

  const supabase = await createClient();
  const [templatesRes, positionsRes, selectedRes] = await Promise.all([
    supabase
      .from("admission_checklist_templates")
      .select("id, name, sortOrder, position:admission_positions(name)")
      .order("sortOrder", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("admission_positions")
      .select("id, name")
      .eq("active", true)
      .order("sortOrder", { ascending: true }),
    t
      ? supabase
          .from("admission_checklist_templates")
          .select(
            "id, name, positionId, groups:admission_template_groups(id, name, sortOrder, items:admission_template_items(id, name, sortOrder))"
          )
          .eq("id", t)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const templates = (templatesRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    position: { name: string } | null;
  }>;
  const templateItems = templates.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    positionName: tpl.position?.name ?? null,
  }));
  const positions = (positionsRes.data ?? []) as Array<{ id: string; name: string }>;

  // Ordena grupos/itens no JS (o embed do PostgREST não garante ordem) e reduz à
  // forma de TemplateDetail.
  const raw = selectedRes.data as unknown as {
    id: string;
    name: string;
    positionId: string | null;
    groups: Array<{
      id: string;
      name: string;
      sortOrder: number;
      items: Array<{ id: string; name: string; sortOrder: number }>;
    }>;
  } | null;
  const detail: TemplateDetail | null = raw
    ? {
        id: raw.id,
        name: raw.name,
        positionId: raw.positionId,
        groups: [...(raw.groups ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => ({
            id: g.id,
            name: g.name,
            items: [...(g.items ?? [])]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((it) => ({ id: it.id, name: it.name })),
          })),
      }
    : null;

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
          <TemplateList templates={templateItems} selectedId={t} />
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
