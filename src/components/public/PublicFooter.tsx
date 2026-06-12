import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 px-4 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Grupo WG / WG Baterias. Todos os direitos reservados.</p>
        <div className="flex gap-6">
          <Link href="/privacidade" className="hover:text-orange-500 transition-colors">
            Aviso de Privacidade
          </Link>
          <a
            href="https://www.wgbaterias.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-orange-500 transition-colors"
          >
            Site WG Baterias
          </a>
        </div>
      </div>
    </footer>
  );
}
