"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Briefcase, Stethoscope, Cake } from "lucide-react";
import type { ElementType } from "react";

export interface CalendarAdmission {
  id: string;
  fullName: string;
  startDate: string | null; // "AAAA-MM-DD"
  examDate: string | null;
  birthDate: string | null;
}

type Kind = "start" | "exam" | "birthday";
interface Ev {
  date: string;
  kind: Kind;
  id: string;
  label: string;
}

const KIND: Record<Kind, { color: string; label: string; Icon: ElementType }> = {
  start: { color: "#3b82f6", label: "Início", Icon: Briefcase },
  exam: { color: "#10b981", label: "Exame médico", Icon: Stethoscope },
  birthday: { color: "#f59e0b", label: "Aniversário", Icon: Cake },
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AdmissionCalendar({ admissions }: { admissions: CalendarAdmission[] }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const events = useMemo<Ev[]>(() => {
    const out: Ev[] = [];
    for (const a of admissions) {
      if (a.startDate) out.push({ date: a.startDate, kind: "start", id: a.id, label: a.fullName });
      if (a.examDate) out.push({ date: a.examDate, kind: "exam", id: a.id, label: a.fullName });
      if (a.birthDate) {
        const [, m, d] = a.birthDate.split("-");
        out.push({ date: `${year}-${m}-${d}`, kind: "birthday", id: a.id, label: a.fullName });
      }
    }
    return out.filter((e) => {
      const [y, m] = e.date.split("-").map(Number);
      return y === year && m - 1 === month;
    });
  }, [admissions, year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < monthStart.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {(Object.keys(KIND) as Kind[]).map((k) => {
            const M = KIND[k];
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: M.color }} />
                <M.Icon className="w-3 h-3" /> {M.label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              setCursor(d);
            }}
            className="text-sm text-gray-500 hover:text-gray-800 px-2"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="px-2 py-2 text-center font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell)
              return <div key={idx} className="min-h-[104px] border-t border-l border-gray-100 bg-gray-50/40" />;
            const key = ymd(cell);
            const evs = eventsByDay.get(key) ?? [];
            const isToday = key === today;
            return (
              <div
                key={idx}
                className={`min-h-[104px] border-t border-l border-gray-100 p-1.5 ${isToday ? "bg-wg-green/5" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? "text-wg-green-dark" : "text-gray-400"}`}>
                  {cell.getDate()}
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 4).map((e, i) => {
                    const M = KIND[e.kind];
                    return (
                      <Link
                        key={i}
                        href={`/admissoes/${e.id}`}
                        className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded truncate"
                        style={{ backgroundColor: `${M.color}18`, color: M.color }}
                      >
                        <M.Icon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{e.label}</span>
                      </Link>
                    );
                  })}
                  {evs.length > 4 && (
                    <div className="text-[10px] text-gray-400 pl-1.5">+{evs.length - 4}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
