import Link from "next/link";
import Image from "next/image";

export default function PublicFooter() {
  return (
    <footer className="bg-black border-t border-wg-border px-4 pt-10 pb-8 mt-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Logo branca */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo-wg-branca.png"
              alt="Grupo WG"
              width={120}
              height={60}
              className="h-10 w-auto"
            />
            <div>
              <p className="text-wg-gray text-xs mt-0.5">
                Grupo WG — energia, movimento e pessoas
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/privacidade"
              className="text-wg-gray hover:text-wg-green transition-colors"
            >
              Aviso de Privacidade
            </Link>
            <a
              href="https://www.wgbaterias.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wg-gray hover:text-wg-green transition-colors"
            >
              Site WG Baterias
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-wg-border text-center">
          <p className="text-wg-gray text-sm">
            © {new Date().getFullYear()} Grupo WG. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
