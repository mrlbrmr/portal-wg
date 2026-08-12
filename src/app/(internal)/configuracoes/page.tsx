import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Globe,
  ListChecks,
  ClipboardList,
  Megaphone,
  Tags,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/internal/PageHeader";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configurações — RH" };

// ─── NavCard ──────────────────────────────────────────────────────────────────

function NavCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-px hover:border-wg-green/40 transition-all group"
    >
      <div className="h-10 w-10 rounded-xl bg-wg-green/10 text-wg-green-dark grid place-items-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 leading-snug">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-wg-green-dark shrink-0 transition-colors" />
    </Link>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN_RH") redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as configurações do portal de carreiras e do painel RH."
      />

      <div className="flex flex-col gap-8">
        {/* Seção: Recrutamento */}
        <div>
          <SectionHeader label="Recrutamento" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <NavCard
              href="/configuracoes/homepage"
              icon={Globe}
              title="Homepage / Portal público"
              description="Cards de vagas, filtros, contadores e textos da página pública."
            />
            <NavCard
              href="/configuracoes/funil"
              icon={ListChecks}
              title="Funil de seleção"
              description="Etapas do processo seletivo (colunas do Kanban de candidatos)."
            />
            <NavCard
              href="/configuracoes/formulario-vaga"
              icon={ClipboardList}
              title="Formulário de abertura de vaga"
              description="Campos e opções do formulário preenchido pelos gestores."
            />
            <NavCard
              href="/configuracoes/divulgacao"
              icon={Megaphone}
              title="Divulgação de vagas"
              description="Conexões com canais externos (LinkedIn) para divulgar vagas."
            />
          </div>
        </div>

        {/* Seção: Admissões */}
        <div>
          <SectionHeader label="Admissões" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <NavCard
              href="/configuracoes/categorias"
              icon={Tags}
              title="Categorias"
              description="Empresas, filiais, cargos, etapas, tags e tipos de documento."
            />
            <NavCard
              href="/configuracoes/modelos"
              icon={ListChecks}
              title="Modelos de Checklist"
              description="Templates de checklist por cargo com grupos e itens padronizados."
            />
            <NavCard
              href="/configuracoes/formulario-admissao"
              icon={FileText}
              title="Formulário de Admissão Digital"
              description="Textos, opções, perguntas e documentos do formulário para candidatos."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
