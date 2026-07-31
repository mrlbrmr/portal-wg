"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-wg-border transition-all duration-300 ${
        scrolled ? "bg-wg-dark/95 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]" : "bg-wg-dark"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-4 md:px-12 h-[76px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #90CB46, #4F6930)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#0C0D0C",
              fontSize: 14,
              fontFamily: "Sora, sans-serif",
              flexShrink: 0,
            }}
          >
            WG
          </div>
          <span className="text-[15px]">
            <span className="font-bold text-white">Grupo WG</span>{" "}
            <span className="font-semibold text-wg-green">Carreiras</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-7 text-[15px]">
          <Link
            href="/"
            className="text-[#E5E5E5] hover:text-wg-green-bright transition-colors duration-200"
          >
            Vagas
          </Link>
          <Link
            href="/privacidade"
            className="text-[#E5E5E5] hover:text-wg-green-bright transition-colors duration-200"
          >
            Privacidade
          </Link>
        </nav>
      </div>
    </header>
  );
}
