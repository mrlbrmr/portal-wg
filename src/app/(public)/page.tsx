import { Suspense } from "react";
import { createAnonClient } from "@/lib/supabase/anon";
import { DEFAULT_CONFIG, type HomepageConfigData } from "@/lib/homepage-config";
import type { Job } from "@/types/domain";
import { PUBLIC_JOB_STATUSES } from "@/lib/utils";
import { applyJobFilters, onlyPublicVisible } from "@/lib/jobs-query";
import JobFilters from "@/components/public/JobFilters";
import { LoadMoreJobs } from "@/components/public/LoadMoreJobs";
import { AnimateIn } from "@/components/ui/AnimateIn";
import { Zap, TrendingUp, Globe, Heart, Briefcase } from "lucide-react";

const PAGE_SIZE = 9;

interface SearchParams {
  city?: string;
  modality?: string;
  department?: string;
  query?: string;
}

const FEATURES = [
  {
    icon: Zap,
    title: "Energia que move pessoas",
    desc: "Um ambiente de trabalho dinâmico, com propósito e movimento.",
  },
  {
    icon: TrendingUp,
    title: "Desenvolvimento profissional",
    desc: "Oportunidades reais de crescimento e aprendizado contínuo.",
  },
  {
    icon: Globe,
    title: "Presença nacional",
    desc: "Atuação em todo o território brasileiro com referência no setor.",
  },
  {
    icon: Heart,
    title: "Ambiente colaborativo",
    desc: "Pessoas que se ajudam e constroem resultados juntas.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const supabase = createAnonClient();

  let listQuery = supabase.from("jobs").select("*", { count: "exact" });
  listQuery = onlyPublicVisible(listQuery);
  listQuery = applyJobFilters(listQuery, params);

  const [listRes, activeRes, configRes] = await Promise.all([
    listQuery.order("createdAt", { ascending: false }).range(0, PAGE_SIZE - 1),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .in("status", PUBLIC_JOB_STATUSES as readonly string[]),
    supabase.from("homepage_config").select("*").eq("id", "singleton").maybeSingle(),
  ]);

  const jobs = (listRes.data ?? []) as unknown as Job[];
  const total = listRes.count ?? 0;
  const totalActive = activeRes.count ?? 0;
  const config = (configRes.data as HomepageConfigData | null) ?? DEFAULT_CONFIG;

  const hasActiveFilters = Object.keys(params).length > 0;

  return (
    <div>
      {/* ── HERO ── */}
      <section
        className="relative text-center"
        style={{ background: "#90CB46", padding: "96px 48px 120px", position: "relative" }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Badge pill */}
          <div
            className="inline-flex items-center gap-2 mb-7 animate-fade-up"
            style={{
              background: "rgba(12,13,12,0.12)",
              color: "#0C0D0C",
              padding: "8px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              animationDelay: "0ms",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C0D0C" strokeWidth="2.2">
              <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
            </svg>
            Portal de Carreiras — Energia que move o Brasil
          </div>

          {/* H1 */}
          <h1
            className="font-sora font-extrabold text-[#0C0D0C] animate-fade-up"
            style={{ fontSize: 52, lineHeight: 1.1, margin: "0 0 20px", animationDelay: "120ms" }}
          >
            Faça parte do Grupo WG
          </h1>

          {/* Parágrafo */}
          <p
            className="animate-fade-up"
            style={{
              fontSize: 18,
              color: "#22301a",
              lineHeight: 1.6,
              margin: "0 0 36px",
              fontWeight: 500,
              animationDelay: "220ms",
            }}
          >
            Desde 2002, o Grupo WG conecta energia, movimento e pessoas nas regiões Sul e Sudeste
            do Brasil. Venha crescer com a nossa equipe.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 justify-center flex-wrap animate-fade-up" style={{ animationDelay: "340ms" }}>
            <a
              href="#vagas"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#0C0D0C",
                color: "#fff",
                padding: "16px 30px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Ver vagas abertas →
            </a>

            {config.showJobCounter && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(12,13,12,0.1)",
                  color: "#0C0D0C",
                  padding: "16px 26px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C0D0C" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                {totalActive} {totalActive === 1 ? "vaga aberta" : "vagas abertas"}
              </div>
            )}
          </div>
        </div>

        {/* Curva convexa SVG: hero verde → fundo escuro */}
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            width: "100%",
            height: 100,
            display: "block",
          }}
          aria-hidden="true"
        >
          <path d="M0,0 C 360,100 1080,100 1440,0 L1440,100 L0,100 Z" fill="#0C0D0C" />
        </svg>
      </section>

      {/* ── VAGAS ABERTAS ── */}
      <section id="vagas" className="bg-wg-dark py-10 md:py-16 px-4 md:px-12">
        <div className="max-w-[1180px] mx-auto">
          {/* Cabeçalho da seção */}
          <AnimateIn>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-wg-green text-[13px] font-bold uppercase tracking-[1px] mb-2.5">
                  Oportunidades
                </p>
                <h2 className="font-sora text-[34px] font-extrabold text-white leading-tight">
                  {config.jobsSectionTitle}
                </h2>
                <p className="text-[#B8B8B8] mt-2 text-[15px]">
                  {config.jobsSectionSubtitle}
                </p>
              </div>
              {jobs.length > 0 && (
                <span className="text-sm text-[#B8B8B8] flex-shrink-0">
                  {total} {total === 1 ? "resultado" : "resultados"}
                </span>
              )}
            </div>
          </AnimateIn>

          {/* Filtros */}
          {config.showFilters && (
            <Suspense fallback={null}>
              <JobFilters />
            </Suspense>
          )}

          {/* Lista de vagas */}
          {jobs.length === 0 ? (
            <AnimateIn>
              <div className="bg-wg-card border border-wg-border rounded-[20px] p-12 text-center">
                <div className="w-14 h-14 bg-wg-green/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Briefcase className="w-7 h-7 text-wg-green" />
                </div>
                <p className="text-white text-lg font-semibold mb-2 font-sora">
                  {hasActiveFilters
                    ? "Nenhuma vaga encontrada"
                    : "No momento, não temos vagas abertas"}
                </p>
                <p className="text-[#B8B8B8] text-sm max-w-sm mx-auto leading-relaxed">
                  {hasActiveFilters
                    ? "Tente outros filtros ou confira todas as vagas disponíveis."
                    : "Mas continue acompanhando nosso portal. Em breve, novas oportunidades podem surgir."}
                </p>
              </div>
            </AnimateIn>
          ) : (
            <LoadMoreJobs
              initialJobs={jobs}
              total={total}
              filters={params}
              config={config}
              pageSize={PAGE_SIZE}
            />
          )}
        </div>
      </section>

      {/* ── SOBRE NÓS ── */}
      <section className="bg-wg-dark py-16 md:py-24 px-4 md:px-12">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-14 items-stretch">
            {/* Coluna de texto */}
            <AnimateIn>
              <div className="flex flex-col justify-center h-full">
                <p className="text-wg-green text-[13px] font-bold uppercase tracking-[1px] mb-3.5">
                  Sobre nós
                </p>
                <h2 className="font-sora text-[36px] font-extrabold text-white leading-[1.2] mb-6">
                  Nós somos o{" "}
                  <span className="text-wg-green">Grupo WG</span>
                </h2>
                <p className="text-[#C7C7C7] text-[16px] leading-[1.85] mb-5">
                  Desde 2002, o <strong className="text-white">Grupo WG</strong>{" "}
                  conecta energia, movimento e pessoas nas regiões Sul e Sudeste do Brasil.
                  Atuamos no setor automotivo, especializados em baterias, com referência em
                  qualidade, atendimento e inovação.
                </p>
                <p className="text-[#C7C7C7] text-[16px] leading-[1.85]">
                  Acreditamos que o sucesso da empresa é construído pelas pessoas. Por isso,
                  investimos no desenvolvimento dos nossos colaboradores, oferecemos um ambiente
                  de trabalho saudável e oportunidades reais de crescimento de carreira.
                </p>
              </div>
            </AnimateIn>

            {/* Grid 2×2 de cards */}
            <div className="grid grid-cols-2 gap-5">
              {FEATURES.map((f, i) => (
                <AnimateIn key={f.title} delay={i * 80}>
                  <div
                    className="flex flex-col justify-center h-full hover:border-wg-green/50 hover:-translate-y-0.5
                      hover:shadow-[0_4px_20px_rgba(144,203,70,0.08)] transition-all duration-200"
                    style={{
                      background: "#151515",
                      border: "1px solid #2A2A2A",
                      borderRadius: 20,
                      padding: 26,
                    }}
                  >
                    <div className="mb-4">
                      <f.icon className="w-7 h-7 text-wg-green" strokeWidth={2} />
                    </div>
                    <h3 className="font-sora text-white font-bold text-[16px] mb-2 leading-snug">
                      {f.title}
                    </h3>
                    <p className="text-[#B8B8B8] text-[14px] leading-relaxed">{f.desc}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
