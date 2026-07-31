export default function AvaliacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-wg-green rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">WG</span>
        </div>
        <span className="text-sm font-semibold text-gray-800">Avaliação Online — WG Baterias</span>
      </header>
      <main>{children}</main>
    </div>
  )
}
