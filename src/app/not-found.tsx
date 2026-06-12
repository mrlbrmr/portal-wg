import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-orange-400 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Página não encontrada</h2>
        <p className="text-gray-500 mb-6">A página que você buscou não existe ou foi removida.</p>
        <Link
          href="/"
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
