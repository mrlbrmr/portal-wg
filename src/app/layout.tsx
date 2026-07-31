import type { Metadata, Viewport } from "next";
import { Outfit, Inter, Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], display: "swap" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
      <body className={`${outfit.className} ${inter.variable} ${sora.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
