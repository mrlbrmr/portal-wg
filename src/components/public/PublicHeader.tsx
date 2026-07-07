"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Faixa superior */}
      <div className="bg-wg-dark border-b border-wg-border py-2 px-4 text-center">
        <p className="text-xs text-wg-gray">
          Inovação e foco nas pessoas —{" "}
          <span className="text-wg-green font-medium">
            Venha crescer com o Grupo WG
          </span>
        </p>
      </div>

      {/* Header principal */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-black/95 backdrop-blur-md border-b border-wg-border shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/logo-wg-branca.png"
              alt="Grupo WG"
              width={100}
              height={50}
              className="h-8 w-auto transition-opacity duration-200 group-hover:opacity-75"
              priority
            />
            <span
              className={`text-xs font-semibold tracking-wide transition-colors duration-200 ${
                scrolled
                  ? "text-wg-green group-hover:text-wg-green-bright"
                  : "text-black/70 group-hover:text-black"
              }`}
            >
              Carreiras
            </span>
          </Link>

          {/* Navegação pill */}
          <nav className="flex items-center gap-0.5 bg-black border border-black/20 rounded-full px-1.5 py-1">
            <Link
              href="/"
              className="px-4 py-1.5 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              Vagas
            </Link>
            <Link
              href="/privacidade"
              className="px-4 py-1.5 rounded-full text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
