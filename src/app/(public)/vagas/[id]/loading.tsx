export default function JobPageLoading() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* Breadcrumb skeleton */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="h-4 w-28 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-9 w-24 rounded-full bg-gray-200 animate-pulse" />
        </div>

        {/* Layout 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 xl:gap-12 items-start">

          {/* Coluna esquerda */}
          <div className="min-w-0">
            {/* Título */}
            <div className="space-y-3 mb-4">
              <div className="h-10 w-3/4 rounded-xl bg-gray-200 animate-pulse" />
              <div className="h-10 w-1/2 rounded-xl bg-gray-200 animate-pulse" />
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              <div className="h-8 w-36 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-44 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-32 rounded-full bg-gray-200 animate-pulse" />
            </div>

            {/* Botão mobile */}
            <div className="lg:hidden h-10 w-36 rounded-full bg-gray-200 animate-pulse mb-8" />

            {/* Seções de conteúdo */}
            <div className="space-y-8">
              {[120, 80, 100, 90].map((width, i) => (
                <div key={i}>
                  <div className="h-5 w-44 rounded-lg bg-gray-200 animate-pulse mb-3" />
                  <div className="space-y-2">
                    <div className="h-4 rounded bg-gray-200 animate-pulse" style={{ width: `${width}%`.replace("120%", "100%") }} />
                    <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
                    {i % 2 === 0 && <div className="h-4 w-5/6 rounded bg-gray-200 animate-pulse" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna direita: card do formulário */}
          <div className="hidden lg:block sticky top-8 self-start">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="h-6 w-3/4 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-gray-200 animate-pulse" />
                    <div className="h-10 w-full rounded-lg bg-gray-200 animate-pulse" />
                  </div>
                ))}
                <div className="h-24 w-full rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-11 w-full rounded-full bg-gray-300 animate-pulse mt-2" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
