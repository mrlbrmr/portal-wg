import type { Metadata } from "next";
import { BarChart3, Users, TrendingUp, Building2, FileSpreadsheet, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardCard } from "@/components/internal/DashboardCard";

export const metadata: Metadata = { title: "Relatórios de Admissões — RH" };

function Bars({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { name: string; count: number; color?: string }[];
  total: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <div key={r.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2 truncate">
                    {r.color && (
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    )}
                    <span className="truncate text-gray-700">{r.name}</span>
                  </span>
                  <span className="text-gray-400 text-xs">{r.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: r.color ?? "#5b8c3e" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admissions")
    .select(
      "createdAt, stage:admission_stages(name, color, isFinal), company:admission_companies(name), branch:admission_branches(name)"
    )
    .is("deletedAt", null);
  const admissions = (data ?? []) as unknown as Array<{
    createdAt: string;
    stage: { name: string; color: string; isFinal: boolean } | null;
    company: { name: string } | null;
    branch: { name: string } | null;
  }>;

  const concluidas = admissions.filter((a) => a.stage?.isFinal === true);
  const ativas     = admissions.filter((a) => !a.stage?.isFinal);

  const now = new Date();
  const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const last30 = admissions.filter((a) => new Date(a.createdAt) >= start30).length;

  const agg = (pick: (a: (typeof admissions)[number]) => { name: string; color?: string } | null) => {
    const map = new Map<string, { name: string; count: number; color?: string }>();
    for (const a of admissions) {
      const v = pick(a);
      const name = v?.name ?? "—";
      const cur = map.get(name) ?? { name, count: 0, color: v?.color };
      cur.count += 1;
      map.set(name, cur);
    }
    return [...map.values()].sort((x, y) => y.count - x.count);
  };

  const total = admissions.length;

  const byStage = agg((a) => (a.stage ? { name: a.stage.name, color: a.stage.color } : { name: "Sem etapa" }));
  const byCompany = agg((a) => ({ name: a.company?.name ?? "Sem empresa" }));
  const byBranch = agg((a) => ({ name: a.branch?.name ?? "Sem filial" }));

  // Últimos 6 meses
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }),
      count: 0,
    });
  }
  for (const a of admissions) {
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) m.count += 1;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Relatórios
          </h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral dos processos de admissão.</p>
        </div>
        <a
          href="/api/admissoes/export"
          className="inline-flex items-center gap-2 bg-wg-green hover:bg-wg-green-bright text-black font-semibold px-4 py-2.5 rounded-full text-sm transition-colors shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <DashboardCard label="Admissões ativas" value={ativas.length} icon={Users} />
        <DashboardCard label="Admissões concluídas" value={concluidas.length} icon={CheckCircle} />
        <DashboardCard
          label="Últimos 30 dias"
          value={last30}
          icon={TrendingUp}
          hint="Novas admissões"
        />
        <DashboardCard label="Filiais com admissão" value={byBranch.length} icon={Building2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bars title="Admissões por etapa" rows={byStage} total={total} />

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Admissões por mês (últimos 6)</h2>
          <div className="flex items-end gap-2 h-40">
            {months.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-400">{m.count}</div>
                <div
                  className="w-full bg-wg-green/80 rounded-t transition-all"
                  style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count > 0 ? 4 : 0 }}
                />
                <div className="text-xs text-gray-400 capitalize">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <Bars title="Por empresa" rows={byCompany} total={total} />
        <Bars title="Por filial" rows={byBranch} total={total} />
      </div>
    </div>
  );
}
