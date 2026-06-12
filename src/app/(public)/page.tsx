import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import JobCard from "@/components/public/JobCard";
import JobFilters from "@/components/public/JobFilters";
import { Briefcase, MapPin, Users } from "lucide-react";

interface SearchParams {
  city?: string;
  modality?: string;
  department?: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = { status: "ACTIVE" };
  if (params.city) where.city = { contains: params.city, mode: "insensitive" };
  if (params.modality) where.modality = params.modality;
  if (params.department) where.department = { contains: params.department, mode: "insensitive" };

  const [jobs, totalActive] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Faça parte do Grupo WG
          </h1>
          <p className="text-orange-100 text-lg mb-8 max-w-2xl mx-auto">
            Há mais de 30 anos conectando energia e movimento. Venha crescer com
            a gente e fazer parte de uma equipe que move o Brasil.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              <span>{totalActive} {totalActive === 1 ? "vaga aberta" : "vagas abertas"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>São Paulo e região</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>CLT, PJ, Estágio</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre o Grupo WG */}
      <section className="bg-white py-12 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sobre o Grupo WG</h2>
          <div className="grid md:grid-cols-2 gap-8 text-gray-600 leading-relaxed">
            <p>
              O <strong className="text-gray-900">Grupo WG</strong> é uma empresa
              brasileira com atuação no setor automotivo, especializada em baterias,
              peças e acessórios. Com décadas de experiência e presença em todo o
              território nacional, somos referência em qualidade, atendimento e
              inovação.
            </p>
            <p>
              Acreditamos que o sucesso da empresa é construído pelas pessoas.
              Por isso, investimos no desenvolvimento dos nossos colaboradores,
              oferecemos um ambiente de trabalho saudável e oportunidades reais
              de crescimento de carreira.
            </p>
          </div>
        </div>
      </section>

      {/* Vagas */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Vagas Abertas</h2>
            {jobs.length > 0 && (
              <span className="text-sm text-gray-500">
                {jobs.length} {jobs.length === 1 ? "resultado" : "resultados"}
              </span>
            )}
          </div>

          <Suspense fallback={null}>
            <JobFilters />
          </Suspense>

          {jobs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhuma vaga encontrada</p>
              <p className="text-sm mt-1">
                {Object.keys(params).length > 0
                  ? "Tente outros filtros ou confira todas as vagas."
                  : "No momento não há vagas abertas. Volte em breve!"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
