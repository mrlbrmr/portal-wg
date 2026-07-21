import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobRequestForm } from "@/components/public/JobRequestForm";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-config-defaults";
import type { FormConfig } from "@/types/form-config";

// Revalida a cada 60s — mudanças de config refletem sem rebuild
export const revalidate = 60;

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

export default async function SolicitarVagaPage() {
  const config = await loadConfig();

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
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
          {config.title}
        </h1>
        {config.description && (
          <p className="text-sm text-gray-600 mb-10">{config.description}</p>
        )}

        <JobRequestForm config={config} />
      </div>
    </div>
  );
}
