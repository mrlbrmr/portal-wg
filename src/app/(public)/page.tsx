import { Suspense } from "react";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CONFIG } from "@/lib/homepage-config";
import JobCard from "@/components/public/JobCard";
import JobFilters from "@/components/public/JobFilters";
import { AnimateIn } from "@/components/ui/AnimateIn";
import {
  Briefcase,
  ArrowRight,
  Zap,
  TrendingUp,
  Globe,
  Heart,
} from "lucide-react";

interface SearchParams {
  city?: string;
  modality?: string;
  department?: string;
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

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.city) where.city = { contains: params.city, mode: "insensitive" };
  if (params.modality) where.modality = params.modality;
  if (params.department)
    where.department = { contains: params.department, mode: "insensitive" };

  const [jobs, totalActive, rawConfig] = await Promise.all([
    prisma.job.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.homepageConfig.findUnique({ where: { id: "singleton" } }),
  ]);
  const config = rawConfig ?? DEFAULT_CONFIG;

  const hasActiveFilters = Object.keys(params).length > 0;

  return (
    <div>
      {/* ── HERO ── */}
      <section
        className="relative min-h-[560px] md:min-h-[640px] flex items-center"
        style={{ background: "#7FD400" }}
      >
        {/* Dot texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.13) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="relative z-10 w-full py-20 md:py-28 px-4">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo WG — versão escura sobre fundo verde */}
            <div
              className="flex justify-center mb-8 animate-fade-in"
              style={{ animationDelay: "0ms" }}
            >
              <Image
                src="/logo-wg-branca.png"
                alt="Grupo WG"
                width={220}
                height={110}
                className="h-20 w-auto animate-float-subtle"
                priority
              />
            </div>

            {/* Badge superior */}
            <div
              className="inline-flex items-center gap-2 bg-black/15 border border-black/20
                rounded-full px-4 py-1.5 text-sm font-semibold text-black mb-6
                animate-fade-up"
              style={{ animationDelay: "120ms" }}
            >
              <Zap className="w-4 h-4" />
              Portal de Carreiras — Energia que move o Brasil
            </div>

            {/* Título */}
            <h1
              className="text-4xl md:text-6xl font-black text-black leading-tight mb-6 animate-fade-up"
              style={{ animationDelay: "220ms" }}
            >
              Faça parte do{" "}
              <span className="underline decoration-black/30 underline-offset-4">
                Grupo WG
              </span>
            </h1>

            {/* Subtítulo */}
            <p
              className="text-black/70 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up"
              style={{ animationDelay: "340ms" }}
            >
              Desde 2002, o Grupo WG conecta energia, movimento e pessoas nas
              regiões Sul e Sudeste do Brasil. Venha crescer com a nossa equipe.
            </p>

            {/* CTA */}
            <a
              href="#vagas"
              className="inline-flex items-center gap-2 bg-black text-white font-bold
                px-8 py-4 rounded-full text-base
                hover:bg-black/80 hover:-translate-y-0.5 active:scale-[0.97]
                transition-all duration-200 shadow-lg shadow-black/20
                animate-fade-up"
              style={{ animationDelay: "460ms" }}
            >
              Ver vagas abertas
              <ArrowRight className="w-5 h-5" />
            </a>

            {/* Indicador de vagas */}
            {config.showJobCounter && (
              <div
                className="flex justify-center mt-10 animate-fade-up"
                style={{ animationDelay: "580ms" }}
              >
                <div className="flex items-center gap-2.5 bg-black/15 border border-black/20 rounded-full px-6 py-3 text-base font-semibold text-black">
                  <Briefcase className="w-5 h-5" />
                  {totalActive}{" "}
                  {totalActive === 1 ? "vaga aberta" : "vagas abertas"}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── ARCO DE TRANSIÇÃO verde → escuro ── */}
      <div
        className="overflow-hidden"
        style={{ background: "#7FD400" }}
        aria-hidden="true"
      >
        <div
          className="bg-wg-dark h-16 md:h-24 w-[115%] -ml-[7.5%]"
          style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
        />
      </div>

      {/* ── SOBRE O GRUPO WG ── */}
      <section className="bg-wg-dark py-16 md:py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Coluna de texto */}
            <AnimateIn>
              <p className="text-wg-green text-xs font-semibold uppercase tracking-widest mb-3">
                Sobre nós
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-6">
                Nós somos o{" "}
                <span className="text-wg-green">Grupo WG</span>
              </h2>
              <p className="text-wg-gray leading-relaxed mb-4">
                Desde 2002, o <strong className="text-white">Grupo WG</strong>{" "}
                conecta energia, movimento e pessoas nas regiões Sul e Sudeste
                do Brasil. Atuamos no setor automotivo, especializados em
                baterias, com referência em qualidade, atendimento e inovação.
              </p>
              <p className="text-wg-gray leading-relaxed">
                Acreditamos que o sucesso da empresa é construído pelas pessoas.
                Por isso, investimos no desenvolvimento dos nossos
                colaboradores, oferecemos um ambiente de trabalho saudável e
                oportunidades reais de crescimento de carreira.
              </p>
            </AnimateIn>

            {/* Cards de diferenciais */}
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <AnimateIn key={f.title} delay={i * 80}>
                  <div className="bg-wg-card border border-wg-border rounded-2xl p-5
                    hover:border-wg-green/50 hover:-translate-y-0.5
                    hover:shadow-[0_4px_20px_rgba(144,203,70,0.08)]
                    transition-all duration-200 h-full">
                    <f.icon className="w-6 h-6 text-wg-green mb-3" />
                    <h3 className="text-white font-semibold text-sm mb-1.5 leading-snug">
                      {f.title}
                    </h3>
                    <p className="text-wg-gray text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VAGAS ABERTAS ── */}
      <section id="vagas" className="bg-black py-14 md:py-18 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Cabeçalho da seção */}
          <AnimateIn>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-wg-green text-xs font-semibold uppercase tracking-widest mb-2">
                  Oportunidades
                </p>
                <h2 className="text-3xl font-black text-white">
                  {config.jobsSectionTitle}
                </h2>
                <p className="text-wg-gray mt-1.5 text-sm">
                  {config.jobsSectionSubtitle}
                </p>
              </div>
              {jobs.length > 0 && (
                <span className="text-sm text-wg-gray flex-shrink-0">
                  {jobs.length}{" "}
                  {jobs.length === 1 ? "resultado" : "resultados"}
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
              <div className="bg-wg-card border border-wg-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 bg-wg-green/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <Briefcase className="w-7 h-7 text-wg-green" />
                </div>
                <p className="text-white text-lg font-semibold mb-2">
                  {hasActiveFilters
                    ? "Nenhuma vaga encontrada"
                    : "No momento, não temos vagas abertas"}
                </p>
                <p className="text-wg-gray text-sm max-w-sm mx-auto leading-relaxed">
                  {hasActiveFilters
                    ? "Tente outros filtros ou confira todas as vagas disponíveis."
                    : "Mas continue acompanhando nosso portal. Em breve, novas oportunidades podem surgir."}
                </p>
              </div>
            </AnimateIn>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job, i) => (
                <AnimateIn key={job.id} delay={i * 60}>
                  <JobCard job={job} config={config} />
                </AnimateIn>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
