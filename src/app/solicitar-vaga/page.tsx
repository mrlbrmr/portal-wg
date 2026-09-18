import Image from "next/image";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobRequestForm } from "@/components/public/JobRequestForm";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import type { FormConfig } from "@/types/form-config";

// Render dinâmico: a página lê a sessão (para pré-preencher o gestor requisitante) e as
// sugestões de unidade/área, então não há cache estático a revalidar.
export const dynamic = "force-dynamic";

async function loadConfig(): Promise<FormConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("job_request_form_config")
    .select("title, description, fields")
    .eq("id", "singleton")
    .maybeSingle();

  if (!data) return DEFAULT_FORM_CONFIG;
  return {
    title: data.title ?? DEFAULT_FORM_CONFIG.title,
    description: data.description ?? DEFAULT_FORM_CONFIG.description,
    fields: Array.isArray(data.fields) ? data.fields : DEFAULT_FORM_CONFIG.fields,
  };
}

/** Sugestões de Empresa/Unidade e Área já usadas, para o gestor não inventar variações. */
async function loadSuggestions(): Promise<{ units: string[]; departments: string[] }> {
  const supabase = createAdminClient();
  const [jobsRes, requestsRes] = await Promise.all([
    supabase.from("jobs").select("company, department").limit(500),
    supabase.from("job_requests").select("location, department").limit(500),
  ]);

  const units = new Set<string>();
  const departments = new Set<string>();
  for (const j of (jobsRes.data ?? []) as Array<{
    company: string | null;
    department: string | null;
  }>) {
    if (j.company?.trim()) units.add(j.company.trim());
    if (j.department?.trim()) departments.add(j.department.trim());
  }
  for (const r of (requestsRes.data ?? []) as Array<{
    location: string | null;
    department: string | null;
  }>) {
    if (r.location?.trim()) units.add(r.location.trim());
    if (r.department?.trim()) departments.add(r.department.trim());
  }

  return {
    units: [...units].sort((a, b) => a.localeCompare(b, "pt-BR")),
    departments: [...departments].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export default async function SolicitarVagaPage() {
  // auth() é opcional aqui: os gestores da WG não têm login. Quando existe sessão,
  // o requisitante já vem preenchido e a solicitação fica ligada ao usuário.
  const [config, suggestions, session] = await Promise.all([
    loadConfig(),
    loadSuggestions(),
    auth().catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-white">
      {/* Banner header */}
      <div className="relative w-full h-24 sm:h-32 bg-black overflow-hidden">
        <Image
          src="/hero-bg.png"
          alt="WG Baterias"
          fill
          className="object-cover object-center opacity-70"
          priority
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/logo-wg-branca.png"
            alt="Logo WG"
            width={80}
            height={80}
            className="object-contain"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
          {config.title}
        </h1>
        {config.description && (
          <p className="text-sm text-gray-600 mb-4">{config.description}</p>
        )}

        <div className="mb-10 rounded-lg border border-wg-green/30 bg-wg-green/5 px-4 py-3">
          <p className="text-sm font-semibold text-wg-green-dark">
            Isto é uma solicitação, não a vaga.
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Você está registrando uma necessidade de contratação. O RH valida o pedido e
            encaminha para aprovação; o processo seletivo é aberto depois, com a divulgação
            e as etapas definidas pelo time de Gente &amp; Gestão.
          </p>
        </div>

        <JobRequestForm
          config={config}
          unitOptions={suggestions.units}
          departmentOptions={suggestions.departments}
          currentUser={
            session ? { name: session.user.name, email: session.user.email } : null
          }
        />
      </div>
    </div>
  );
}
