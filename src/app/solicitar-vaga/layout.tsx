import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abertura de Vaga | WG Baterias",
  description: "Formulário de solicitação de abertura de vaga para gestores do Grupo WG.",
};

export default function SolicitarVagaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
