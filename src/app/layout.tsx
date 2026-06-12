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
