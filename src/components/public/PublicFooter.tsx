import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="bg-wg-dark border-t border-wg-border px-4 md:px-12 pt-8 pb-6 mt-auto">
      <div className="max-w-[1180px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          {/* Logo + tagline */}
          <div className="flex items-center gap-2.5 text-[#B8B8B8] text-sm">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "linear-gradient(135deg, #90CB46, #4F6930)",
                flexShrink: 0,
              }}
            />
            Grupo WG — energia, movimento e pessoas
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
