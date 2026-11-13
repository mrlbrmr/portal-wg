import Image from "next/image";
import { auth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrgUnits } from "@/lib/registries/org-units-data";
import type { OrgUnit } from "@/lib/registries/org-units";
import { JobRequestForm } from "@/components/public/JobRequestForm";
import { JobRequestIntro } from "@/components/job-requests/JobRequestIntro";
import { loadJobRequestFormConfig } from "@/lib/job-requests/form-config-loader";
import type { FormConfig } from "@/types/form-config";

// Render dinâmico: a página lê a sessão (para pré-preencher o gestor requisitante) e as
// sugestões de unidade/área, então não há cache estático a revalidar.
export const dynamic = "force-dynamic";

async function loadConfig(): Promise<FormConfig> {
  const { title, description, fields } = await loadJobRequestFormConfig();
  return { title, description, fields };
}

/** Filiais e áreas dos cadastros e cargos sugeridos, para o gestor não inventar variações. */
async function loadSuggestions(): Promise<{ branches: OrgUnit[]; areas: OrgUnit[]; positions: string[] }> {
  const supabase = createAdminClient();
  const [orgUnits, positionsRes] = await Promise.all([
    loadOrgUnits(supabase),
    // Cargos ativos do cadastro: o gestor escolhe o mesmo nome que a admissão vai usar.
    supabase.from("admission_positions").select("name").eq("active", true).order("sortOrder", { ascending: true }),
  ]);
  return {
    ...orgUnits,
    positions: ((positionsRes.data ?? []) as Array<{ name: string }>).map((p) => p.name),
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
          alt=""
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
          branchOptions={suggestions.branches}
          areaOptions={suggestions.areas}
          positionOptions={suggestions.positions}
          currentUser={
            session ? { name: session.user.name, email: session.user.email } : null
          }
        />
      </div>
    </div>
  );
}
