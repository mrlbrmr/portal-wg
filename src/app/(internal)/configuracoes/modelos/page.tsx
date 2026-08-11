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

export const metadata: Metadata = { title: "Modelos de Checklist — Configurações — RH" };

export default async function ModelosPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const [session, { t }] = await Promise.all([auth(), searchParams]);
  if (session?.user.role !== "ADMIN_RH") redirect("/dashboard");

  const supabase = await createClient();
  const [templatesRes, positionsRes, selectedRes] = await Promise.all([
    supabase
      .from("admission_checklist_templates")
      .select(
        "id, name, sortOrder, positions:admission_template_positions(position:admission_positions(id, name))"
      )
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
            "id, name, positions:admission_template_positions(positionId), groups:admission_template_groups(id, name, sortOrder, items:admission_template_items(id, name, sortOrder, parentId))"
          )
          .eq("id", t)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const templates = (templatesRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    positions: Array<{ position: { id: string; name: string } | null }>;
  }>;
  const templateItems = templates.map((tpl) => {
    const names = (tpl.positions ?? [])
      .map((p) => p.position?.name)
      .filter((n): n is string => !!n);
    return {
      id: tpl.id,
      name: tpl.name,
      positionLabel: names.length === 0 ? "Todos os cargos" : names.join(", "),
    };
  });
  const positions = (positionsRes.data ?? []) as Array<{ id: string; name: string }>;

  const raw = selectedRes.data as unknown as {
    id: string;
    name: string;
    positions: Array<{ positionId: string }>;
    groups: Array<{
      id: string;
      name: string;
      sortOrder: number;
      items: Array<{ id: string; name: string; sortOrder: number; parentId: string | null }>;
    }>;
  } | null;
  const detail: TemplateDetail | null = raw
    ? {
        id: raw.id,
        name: raw.name,
        positionIds: (raw.positions ?? []).map((p) => p.positionId),
        groups: [...(raw.groups ?? [])]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => {
            const gItems = [...(g.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
            const children = gItems.filter((it) => it.parentId);
            const topLevel = gItems.filter((it) => !it.parentId);
            return {
              id: g.id,
              name: g.name,
              items: topLevel.map((it) => ({
                id: it.id,
                name: it.name,
                subtasks: children
                  .filter((c) => c.parentId === it.id)
                  .map((c) => ({ id: c.id, name: c.name })),
              })),
            };
          }),
      }
    : null;

  return (
    <div className="max-w-6xl">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#55614A] hover:text-[#1A2213] transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Configurações
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1A2213] font-sora tracking-tight flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> Modelos de Checklist
          </h1>
          <p className="text-[#55614A] text-sm mt-1">
            Templates aplicáveis por cargo às novas admissões.
          </p>
        </div>
        <NewTemplateForm positions={positions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="bg-white border border-[#E7EEDD] rounded-2xl shadow-sm overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-[#EEF2E9] text-[11px] tracking-[.07em] uppercase font-bold text-[#6B7860]">
            Modelos
          </div>
          <TemplateList templates={templateItems} selectedId={t} />
        </div>

        {detail ? (
          <TemplateEditor key={detail.id} template={detail} positions={positions} />
        ) : (
          <div className="bg-white border border-[#E7EEDD] rounded-2xl shadow-sm">
            <p className="text-sm text-[#8A9480] text-center py-20">
              Selecione um modelo à esquerda ou crie um novo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
