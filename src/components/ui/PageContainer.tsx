import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Container padrão das páginas de módulo (Calendário, Relatórios, Atividades, Usuários):
 * largura máxima de 1480px, centralizado na área de conteúdo e com o mesmo ritmo
 * vertical entre cabeçalho, filtros e conteúdo (gap de 20px).
 * O padding lateral vem do <main> do InternalShell — não repita aqui.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-[1480px] flex-col gap-5", className)}>{children}</div>;
}
