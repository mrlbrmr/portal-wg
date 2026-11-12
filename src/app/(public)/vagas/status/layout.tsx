import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consultar candidatura",
  description: "Consulte o andamento das suas candidaturas no Grupo WG com CPF e e-mail.",
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
