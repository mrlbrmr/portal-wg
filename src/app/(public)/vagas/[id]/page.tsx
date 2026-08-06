import { createAnonClient } from "@/lib/supabase/anon";
import type { Job } from "@/types/domain";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MODALITY_LABELS, CONTRACT_TYPE_LABELS, PUBLIC_JOB_STATUSES } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize";
import { buildJobPostingJsonLd } from "@/lib/job-schema";
import { getAppBaseUrl } from "@/lib/app-url";
import { MapPin, Clock, Briefcase, ChevronLeft, ArrowRight } from "lucide-react";
import { ShareButton } from "@/components/public/ShareButton";
import { ApplicationForm } from "@/components/public/ApplicationForm";
import type { Metadata } from "next";
import { cache } from "react";

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

const findJob = cache(async (slugOrId: string): Promise<Job | null> => {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .in("status", PUBLIC_JOB_STATUSES as readonly string[])
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .limit(1);
  return (data?.[0] ?? null) as unknown as Job | null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) return { title: "Vaga não encontrada" };
  const location = job.city ? `${job.city}/${job.state}` : "Banco de Talentos";
  return {
    title: `${job.title} — ${location}`,
    description: `Vaga de ${job.title}${job.department ? ` em ${job.department}` : ""} no Grupo WG Baterias${job.city ? ` em ${location}` : ""}. Candidate-se agora!`,
    openGraph: {
      title: `${job.title} — Carreiras WG`,
      description: `Oportunidade${job.city ? ` em ${location}` : " no Banco de Talentos"}. Faça parte do Grupo WG!`,
    },
  };
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) notFound();

  const now = new Date();
  const baseUrl = getAppBaseUrl();
  const jobUrl = `${baseUrl}/vagas/${job.slug ?? job.id}`;

  const supabase = createAnonClient();
  let simQuery = supabase
    .from("jobs")
    .select("id, slug, title, city, state, modality, department")
    .neq("id", job.id)
    .in("status", PUBLIC_JOB_STATUSES as readonly string[])
    .or(`closingDate.is.null,closingDate.gte.${now.toISOString()}`);
  if (job.department && job.city) {
    simQuery = simQuery.or(`department.eq."${job.department}",city.eq."${job.city}"`);
  } else if (job.department) {
    simQuery = simQuery.eq("department", job.department);
  } else if (job.city) {
    simQuery = simQuery.eq("city", job.city);
  }
  const { data: similarData } = await simQuery.order("createdAt", { ascending: false }).limit(3);
  const similar = (similarData ?? []) as unknown as Array<
    Pick<Job, "id" | "slug" | "title" | "city" | "state" | "modality" | "department">
  >;

  const jsonLd = buildJobPostingJsonLd(job, baseUrl);

  const sections = [
    { title: "Sobre a Vaga", content: job.description },
    { title: "Responsabilidades", content: job.responsibilities },
    { title: "Requisitos Obrigatórios", content: job.requiredRequirements },
    ...(job.desiredRequirements
      ? [{ title: "Requisitos Desejáveis", content: job.desiredRequirements }]
      : []),
    ...(job.benefits ? [{ title: "Benefícios", content: job.benefits }] : []),
  ].filter((s) => s.content);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-8 md:py-12">

          {/* Topo: breadcrumb + compartilhar */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-wg-green hover:text-wg-green-bright transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar às vagas
            </Link>
            <ShareButton url={jobUrl} />
          </div>

          {/* Layout 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 xl:gap-12 items-start">

            {/* ── COLUNA ESQUERDA: info da vaga ── */}
            <div className="min-w-0">

              {/* Título */}
              <h1 className="text-[32px] md:text-[40px] font-extrabold text-gray-900 leading-tight mb-4 font-sora">
                {job.title}
              </h1>

              {/* Pills de localização / modalidade */}
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-sm text-gray-600 shadow-sm">
                  <MapPin className="w-3.5 h-3.5 text-wg-green shrink-0" />
                  {job.city ? `${job.city} / ${job.state}` : "Banco de Talentos"}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-sm text-gray-600 shadow-sm">
                  <Briefcase className="w-3.5 h-3.5 text-wg-green shrink-0" />
                  {MODALITY_LABELS[job.modality]} · {CONTRACT_TYPE_LABELS[job.contractType]}
                </span>
                {job.workSchedule && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 text-sm text-gray-600 shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-wg-green shrink-0" />
                    {job.workSchedule}
                  </span>
                )}
              </div>

              {/* Botão "Candidatar-se" apenas no mobile (no desktop a form está ao lado) */}
              <a
                href="#inscrever-mobile"
                className="lg:hidden inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-5 py-2.5 rounded-full transition-colors mb-8"
              >
                Candidatar-se
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Seções de conteúdo */}
              <div className="space-y-8">
                {sections.map((section) => (
                  <div key={section.title}>
                    <h2 className="text-[17px] font-bold text-gray-900 mb-3 font-sora">
                      {section.title}
                    </h2>
                    <div
                      className="rich-text text-[15px] text-gray-700 leading-[1.75]"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.content) }}
                    />
                  </div>
                ))}
              </div>

              {/* Vagas similares */}
              {similar.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h2 className="text-base font-semibold text-gray-700 mb-4">
                    Outras oportunidades
                  </h2>
                  <div className="flex flex-col gap-3">
                    {similar.map((s) => (
                      <Link
                        key={s.id}
                        href={`/vagas/${s.slug ?? s.id}`}
                        className="flex items-center justify-between bg-white border border-gray-200 hover:border-wg-green/40 rounded-xl px-5 py-4 transition-colors group shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-wg-green transition-colors">
                            {s.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {s.city} / {s.state}
                            {s.department ? ` · ${s.department}` : ""}
                            {" · "}
                            {MODALITY_LABELS[s.modality]}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-wg-green transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulário no mobile (abaixo do conteúdo) */}
              <div id="inscrever-mobile" className="mt-10 lg:hidden scroll-mt-6">
                <ApplicationForm jobId={job.id} jobTitle={job.title} />
              </div>
            </div>

            {/* ── COLUNA DIREITA: formulário sticky (desktop) ── */}
            <div className="hidden lg:block sticky top-8 self-start">
              <ApplicationForm jobId={job.id} jobTitle={job.title} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
