import Link from "next/link";
import type { ElementType } from "react";

interface Props {
  label: string;
  value: string | number;
  icon: ElementType;
  /** Classe utilitária para o "badge" do ícone (fundo + cor). */
  iconClass?: string;
  /** Texto auxiliar em cinza abaixo do rótulo (ex.: contexto ou período). */
  hint?: string;
  /** Se informado, o card inteiro vira um link para esse destino. */
  href?: string;
}

/**
 * Card compacto de métrica para a faixa de indicadores (dashboard superior
 * da tela de Vagas). Server-friendly: sem estado nem interatividade além do
 * link opcional. Segue a paleta clara do admin.
 */
export function DashboardCard({
  label,
  value,
  icon: Icon,
  iconClass = "bg-gray-100 text-gray-600",
  hint,
  href,
}: Props) {
  const inner = (
    <>
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-xl font-bold leading-none text-gray-900 font-sora tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-gray-500 font-inter">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </>
  );

  const base =
    "block rounded-xl border border-gray-200 bg-white p-3 shadow-sm";

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} transition-colors hover:border-wg-green/50`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={base}>{inner}</div>;
}
