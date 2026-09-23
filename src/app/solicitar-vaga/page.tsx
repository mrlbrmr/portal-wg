import Image from "next/image";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobRequestForm } from "@/components/public/JobRequestForm";
import { JobRequestIntro } from "@/components/job-requests/JobRequestIntro";
import { loadJobRequestFormConfig } from "@/lib/job-requests/form-config-loader";
import { JOB_REQUEST_REASON_LABELS } from "@/lib/job-requests/constants";
import type { FormConfig } from "@/types/form-config";

// Render dinâmico: a página lê a sessão (para pré-preencher o gestor requisitante) e as
// sugestões de unidade/área, então não há cache estático a revalidar.
export const dynamic = "force-dynamic";

async function loadConfig(): Promise<FormConfig> {
  const { title, description, fields } = await loadJobRequestFormConfig();
  return { title, description, fields };
}

// O fluxo antigo gravava o MOTIVO da abertura em jobs.department; sem este filtro esses
// valores voltariam como sugestão de "Área / Departamento".
const REASON_LABELS = new Set(
  [...Object.values(JOB_REQUEST_REASON_LABELS), "Expansão de equipe"].map((l) => l.toLowerCase())
);

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
    departments: [...departments]
      .filter((d) => !REASON_LABELS.has(d.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
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
        <JobRequestIntro title={config.title} description={config.description} />

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
