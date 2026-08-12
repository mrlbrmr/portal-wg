"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { setBatchItemsDone } from "@/lib/admissao/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetAdmission = {
  id: string;
  fullName: string;
  startDate: string | null;
  positionName: string | null;
  companyName: string | null;
  branchName: string | null;
  checklistDone: number;
  checklistTotal: number;
};

type WidgetItem = {
  id: string;
  name: string;
  dueDate: string;
  admissionId: string;
  groupName: string;
};

type Props = {
  admission: WidgetAdmission | null;
  pendingItems: WidgetItem[];
  todayStr: string;
  onClose: () => void;
};

type Urgency = "overdue" | "today" | "upcoming";

// ─── Config ───────────────────────────────────────────────────────────────────

const URGENCY_CFG = {
  overdue:  { label: "Atrasadas",     color: "#C0392B", bgColor: "#FDECEA", dotColor: "#C0392B" },
  today:    { label: "Para hoje",     color: "#A0721E", bgColor: "#FCF1DD", dotColor: "#D97706" },
  upcoming: { label: "Próximos dias", color: "#3C56A8", bgColor: "#E9EDFA", dotColor: "#3B82F6" },
} as const;

const AVATAR_COLORS = ["#DCE8CC", "#FDD8B1", "#B9DAED", "#F5C6CB", "#C3E6CB"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ptBRDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function diffDays(dateStr: string, todayStr: string): number {
  const a = new Date(dateStr.slice(0, 10) + "T00:00:00Z").getTime();
  const b = new Date(todayStr + "T00:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

function daysFromToday(dateStr: string | null, todayStr: string): number | null {
  if (!dateStr) return null;
  return diffDays(dateStr, todayStr);
}

function getUrgency(dueDate: string, todayStr: string): Urgency {
  const d = dueDate.slice(0, 10);
  if (d < todayStr) return "overdue";
  if (d === todayStr) return "today";
  return "upcoming";
}

function relativeDate(dueDate: string, todayStr: string): string {
  const n = diffDays(dueDate, todayStr);
  if (n < 0) return `Atrasada ${Math.abs(n)} dia${Math.abs(n) !== 1 ? "s" : ""}`;
  if (n === 0) return "Hoje";
  if (n === 1) return "Amanhã";
  return `Em ${n} dias`;
}

function isWhatsApp(name: string): boolean {
  return /whatsapp/i.test(name);
}

function waLink(fullName: string): string {
  const msg = encodeURIComponent(
    `Olá ${fullName}! Sou do RH da WG Baterias e entro em contato referente à sua admissão. 😊`
  );
  return `https://wa.me/?text=${msg}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarBg(name: string): string {
  let h = 0;
  for (const c of name) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.124.553 4.122 1.524 5.864L.057 23.448l5.73-1.505A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.992 0-3.854-.58-5.41-1.577l-.388-.231-4.015 1.053 1.069-3.914-.253-.403A9.78 9.78 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="w-3 h-3 fill-none stroke-white stroke-2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="2,7 5.5,10.5 12,3" />
    </svg>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  todayStr,
  urgency,
  fullName,
  completing,
  onComplete,
}: {
  item: WidgetItem;
  todayStr: string;
  urgency: Urgency;
  fullName: string;
  completing: boolean;
  onComplete: (id: string) => void;
}) {
  const cfg = URGENCY_CFG[urgency];
  const relDate = relativeDate(item.dueDate, todayStr);

  return (
    <label
      className="flex items-start gap-2.5 py-2 px-3 rounded-lg hover:bg-[#F5F7F3] cursor-pointer transition-colors"
      style={{
        opacity: completing ? 0.5 : 1,
        transform: completing ? "translateX(6px)" : "none",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      {completing ? (
        <span className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-sm bg-[#90CB46] flex items-center justify-center">
          <CheckIcon />
        </span>
      ) : (
        <input
          type="checkbox"
          checked={false}
          onChange={() => onComplete(item.id)}
          aria-label={`Concluir: ${item.name}`}
          className="mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer accent-[#90CB46]"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div className="flex-1 min-w-0">
        <span
          className="text-[13px] font-medium leading-snug"
          style={{
            color: completing ? "#9CA3AF" : "#1A2213",
            textDecoration: completing ? "line-through" : "none",
            transition: "color 0.2s, text-decoration 0.2s",
          }}
        >
          {item.name}
        </span>

        {!completing && (
          <div className="mt-0.5">
            <span
              className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ color: cfg.color, backgroundColor: cfg.bgColor }}
            >
              {relDate}
            </span>
          </div>
        )}

        {completing && (
          <div className="mt-0.5">
            <span className="text-[10.5px] text-[#90CB46] font-semibold">✓ Concluído</span>
          </div>
        )}
      </div>

      {!completing && isWhatsApp(item.name) && (
        <a
          href={waLink(fullName)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Enviar WhatsApp para ${fullName}`}
          className="shrink-0 mt-0.5 text-[#25D366] hover:text-[#128C7E] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon />
        </a>
      )}
    </label>
  );
}

// ─── UrgencySection ───────────────────────────────────────────────────────────

function UrgencySection({
  urgency,
  groups,
  todayStr,
  fullName,
  completing,
  isPending,
  onComplete,
  onBatch,
}: {
  urgency: Urgency;
  groups: Record<string, WidgetItem[]>;
  todayStr: string;
  fullName: string;
  completing: Set<string>;
  isPending: boolean;
  onComplete: (id: string) => void;
  onBatch: (ids: string[]) => void;
}) {
  const cfg = URGENCY_CFG[urgency];
  const allIds = Object.values(groups).flat().map((i) => i.id);
  const pendingIds = allIds.filter((id) => !completing.has(id));

  return (
    <div>
      {/* Urgency header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ backgroundColor: cfg.bgColor }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dotColor }} />
        <span
          className="text-[10.5px] font-bold uppercase tracking-wider flex-1"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.08)", color: cfg.color }}
        >
          {allIds.length}
        </span>
      </div>

      {/* Groups */}
      <div className="px-2 py-1.5">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="mb-1.5">
            <div className="px-3 mb-0.5">
              <span className="text-[10px] font-semibold text-wg-ink-muted uppercase tracking-wide">
                {groupName}
              </span>
            </div>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                todayStr={todayStr}
                urgency={urgency}
                fullName={fullName}
                completing={completing.has(item.id)}
                onComplete={onComplete}
              />
            ))}
          </div>
        ))}

        {/* Batch action */}
        {pendingIds.length > 1 && (
          <div className="px-3 pt-0.5 pb-1">
            <button
              onClick={() => onBatch(pendingIds)}
              disabled={isPending}
              className="text-[11px] text-wg-ink-muted hover:text-wg-ink underline-offset-2 hover:underline transition-colors disabled:opacity-50"
            >
              {isPending ? "Concluindo…" : `Concluir todas (${pendingIds.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AdmissaoPreviewDrawer ────────────────────────────────────────────────────

export function AdmissaoPreviewDrawer({ admission, pendingItems, todayStr, onClose }: Props) {
  const router = useRouter();
  const isOpen = admission !== null;
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Reset completing state ao abrir uma admissão diferente
  useEffect(() => {
    setCompleting(new Set());
  }, [admission?.id]);

  const pct =
    admission && admission.checklistTotal > 0
      ? Math.round((admission.checklistDone / admission.checklistTotal) * 100)
      : 0;

  const startDays = admission ? daysFromToday(admission.startDate, todayStr) : null;
  const companyInfo = admission
    ? [admission.companyName, admission.branchName].filter(Boolean).join(" · ")
    : "";

  // Agrupar itens pendentes por urgência → grupo de checklist
  const grouped = useMemo(() => {
    const buckets: Record<Urgency, Record<string, WidgetItem[]>> = {
      overdue: {},
      today: {},
      upcoming: {},
    };
    for (const item of pendingItems) {
      const urgency = getUrgency(item.dueDate, todayStr);
      if (!buckets[urgency][item.groupName]) buckets[urgency][item.groupName] = [];
      buckets[urgency][item.groupName].push(item);
    }
    return buckets;
  }, [pendingItems, todayStr]);

  const overdueCount = Object.values(grouped.overdue).flat().length;
  const todayCount = Object.values(grouped.today).flat().length;
  const upcomingCount = Object.values(grouped.upcoming).flat().length;

  function handleComplete(itemId: string) {
    if (!admission || completing.has(itemId)) return;
    setCompleting((prev) => new Set([...prev, itemId]));
    startTransition(async () => {
      await setBatchItemsDone(admission.id, [itemId]);
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      router.refresh();
    });
  }

  function handleBatch(itemIds: string[]) {
    if (!admission || !itemIds.length) return;
    setCompleting((prev) => new Set([...prev, ...itemIds]));
    startTransition(async () => {
      await setBatchItemsDone(admission.id, itemIds);
      setCompleting(new Set());
      router.refresh();
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={admission ? `Checklist de ${admission.fullName}` : "Checklist de admissão"}
        className={`fixed top-0 right-0 h-full w-[400px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 p-4 border-b border-[#E8EDE2] shrink-0">
          {/* Avatar com iniciais */}
          {admission && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold text-[#3E5A2A] select-none"
              style={{ backgroundColor: avatarBg(admission.fullName) }}
            >
              {initials(admission.fullName)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-bold text-wg-ink leading-tight truncate">
              {admission?.fullName ?? "—"}
            </div>
            {admission?.positionName && (
              <div className="text-[12px] text-wg-ink-muted">{admission.positionName}</div>
            )}
            {companyInfo && (
              <div className="text-[11px] text-wg-ink-muted">{companyInfo}</div>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar painel"
            className="shrink-0 p-1.5 rounded-lg text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Start date ────────────────────────────────────────────────────── */}
        {admission && startDays !== null && (
          <div className="px-4 py-2.5 border-b border-[#E8EDE2] shrink-0">
            {startDays > 0 && (
              <span className="text-[12px] text-[#4F6930] font-semibold">
                📅 Inicia em {startDays} dia{startDays !== 1 ? "s" : ""} (
                {ptBRDate(admission.startDate!.slice(0, 10))})
              </span>
            )}
            {startDays === 0 && (
              <span className="text-[12px] text-[#A0721E] font-semibold">📅 Inicia hoje</span>
            )}
            {startDays < 0 && (
              <span className="text-[12px] text-wg-ink-muted">
                📅 Iniciou há {Math.abs(startDays)} dia{Math.abs(startDays) !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* ── Progress + urgency stats ──────────────────────────────────────── */}
        {admission && admission.checklistTotal > 0 && (
          <div className="px-4 py-3.5 border-b border-[#E8EDE2] shrink-0 space-y-2.5">
            {/* Barra de progresso */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-semibold text-wg-ink-muted uppercase tracking-wide">
                  Progresso do checklist
                </span>
                <span className="text-[13px] font-bold text-wg-ink tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 bg-[#E8EDE2] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#90CB46] rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[11px] text-wg-ink-muted mt-1">
                {admission.checklistDone} de {admission.checklistTotal} tarefas concluídas
              </div>
            </div>

            {/* Pílulas de urgência (overview rápido) */}
            {pendingItems.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#FDECEA] text-[#C0392B]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C0392B] shrink-0" />
                    {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
                  </span>
                )}
                {todayCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#FCF1DD] text-[#A0721E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                    {todayCount} para hoje
                  </span>
                )}
                {upcomingCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#E9EDFA] text-[#3C56A8]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" />
                    {upcomingCount} próxima{upcomingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Lista de itens pendentes agrupada ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {pendingItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-[13px] text-wg-ink font-semibold">Tudo concluído!</p>
              <p className="text-[11px] text-wg-ink-muted mt-1">
                Nenhum item pendente para este colaborador.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F4EC]">
              {(["overdue", "today", "upcoming"] as Urgency[]).map((urgency) => {
                const groups = grouped[urgency];
                if (Object.keys(groups).length === 0) return null;
                return (
                  <UrgencySection
                    key={urgency}
                    urgency={urgency}
                    groups={groups}
                    todayStr={todayStr}
                    fullName={admission?.fullName ?? ""}
                    completing={completing}
                    isPending={isPending}
                    onComplete={handleComplete}
                    onBatch={handleBatch}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        {admission && (
          <div className="p-4 border-t border-[#E8EDE2] flex gap-2 shrink-0">
            <Link
              href={`/admissoes/${admission.id}?tab=checklist`}
              className="flex-1 text-center py-2.5 rounded-xl border border-[#E5EAE0] text-[13px] font-semibold text-wg-ink-muted hover:bg-[#F5F7F3] transition-colors"
              onClick={onClose}
            >
              Ver Checklist
            </Link>
            <Link
              href={`/admissoes/${admission.id}`}
              className="flex-1 text-center py-2.5 rounded-xl bg-[#EAF4DC] text-[#3E5A2A] text-[13px] font-semibold hover:bg-[#D7ECC4] transition-colors"
              onClick={onClose}
            >
              Abrir ficha →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
