import Link from "next/link";
import Image from "next/image";

export default function PublicFooter() {
  return (
    <footer className="bg-wg-dark border-t border-wg-border px-4 md:px-12 pt-8 pb-6 mt-auto">
      <div className="max-w-[1180px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3 text-[#B8B8B8] text-sm">
            <Image
              src="/logo-wg-branca.png"
              alt="Grupo WG"
              width={80}
              height={46}
              className="h-7 w-auto flex-shrink-0"
            />
            energia, movimento e pessoas
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/privacidade"
              className="text-[#B8B8B8] hover:text-wg-green transition-colors"
            >
              Aviso de Privacidade
            </Link>
            <a
              href="https://www.wgbaterias.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B8B8B8] hover:text-wg-green transition-colors"
            >
              Site WG Baterias
            </a>
          </div>
        </div>

        <div className="pt-5 border-t border-wg-border text-center text-[13px] text-[#6E6E6E]">
          © {new Date().getFullYear()} Grupo WG. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
