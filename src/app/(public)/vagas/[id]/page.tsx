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

// ISR: revalida automaticamente a cada 60s; revalidatePath() em edições força imediato
export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

// cache() deduplica a query dentro do mesmo request (compartilhada entre generateMetadata e JobPage)
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

  // Vagas similares — mesmo departamento OU mesma cidade, excluindo a atual
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

  // JSON-LD JobPosting — Google for Jobs (markup completo em @/lib/job-schema)
  const jsonLd = buildJobPostingJsonLd(job, baseUrl);

  const sections = [
    { title: "Sobre a Vaga", content: job.description },
    { title: "Responsabilidades", content: job.responsibilities },
    { title: "Requisitos Obrigatórios", content: job.requiredRequirements },
    ...(job.desiredRequirements
      ? [{ title: "Requisitos Desejáveis", content: job.desiredRequirements }]
      : []),
    ...(job.benefits ? [{ title: "Benefícios", content: job.benefits }] : []),
  ];

  return (
    <>
      {/* Structured data para Google Jobs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-10">
          {/* Breadcrumb */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-wg-green hover:text-wg-green-bright transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar às vagas
          </Link>

          {/* Cabeçalho */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
                {job.department && (
                  <span className="text-sm text-gray-500">{job.department}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ShareButton url={jobUrl} />
                <a
                  href="#inscrever"
                  className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-5 py-2.5 rounded-full transition-colors"
                >
                  Candidatar-se
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-wg-green" />
                {job.city ? `${job.city} / ${job.state}` : "Banco de Talentos"}
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-wg-green" />
                {MODALITY_LABELS[job.modality]} · {CONTRACT_TYPE_LABELS[job.contractType]}
              </span>
              {job.workSchedule && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-wg-green" />
                  {job.workSchedule}
                </span>
              )}
            </div>
          </div>

          {/* Seções */}
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray-200 rounded-2xl p-6 mb-4 shadow-sm"
            >
              <h2 className="text-base font-semibold text-gray-900 mb-3">{section.title}</h2>
              <div
                className="rich-text text-sm text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.content) }}
              />
            </div>
          ))}

          {/* Formulário de inscrição nativo */}
          <div id="inscrever" className="mt-2 scroll-mt-8">
            <ApplicationForm jobId={job.id} jobTitle={job.title} />
          </div>

          {/* Vagas similares */}
          {similar.length > 0 && (
            <div className="mt-10">
              <h2 className="text-base font-semibold text-gray-700 mb-4">Outras oportunidades</h2>
              <div className="flex flex-col gap-3">
                {similar.map((s) => (
                  <Link
                    key={s.id}
                    href={`/vagas/${s.slug ?? s.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 hover:border-wg-green/40 rounded-xl px-5 py-4 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-wg-green transition-colors">
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
        </div>
      </div>
    </>
  );
}
