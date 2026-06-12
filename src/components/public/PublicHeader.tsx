import Link from "next/link";
import { Zap } from "lucide-react";

export default function PublicHeader() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">WG Baterias</span>
            <span className="text-orange-500 text-xs block leading-none">Carreiras</span>
          </div>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-gray-600 hover:text-orange-500 transition-colors">
            Vagas
          </Link>
          <Link href="/privacidade" className="text-gray-600 hover:text-orange-500 transition-colors">
            Privacidade
          </Link>
          <Link
            href="/candidatar"
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Candidatar-se
          </Link>
        </nav>
      </div>
    </header>
  );
}
