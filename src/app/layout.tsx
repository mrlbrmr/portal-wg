import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Carreiras | WG Baterias",
    template: "%s | Carreiras WG Baterias",
  },
  description:
    "Trabalhe conosco. Confira as oportunidades abertas no Grupo WG / WG Baterias e faça parte do nosso time.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Carreiras WG Baterias",
    title: "Carreiras WG Baterias — Faça parte do nosso time",
    description:
      "Confira as vagas abertas no Grupo WG. Oportunidades nas regiões Sul e Sudeste do Brasil.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Carreiras WG Baterias",
    description: "Confira as vagas abertas no Grupo WG.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
