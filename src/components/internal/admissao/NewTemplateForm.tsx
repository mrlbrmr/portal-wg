"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { createTemplate } from "@/lib/admissao/template-actions";

interface Props {
  positions: { id: string; name: string }[];
}

const input =
  "h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-wg-green/40 focus:border-wg-green";

export function NewTemplateForm({ positions }: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [positionId, setPositionId] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-wg-green hover:bg-wg-green-bright text-black text-sm font-semibold px-4 py-2 rounded-full"
      >
        <Plus className="w-4 h-4" /> Novo modelo
      </button>
    );
  }

  function submit() {
    const clean = name.trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await createTemplate(clean, positionId || null);
      if (!res.ok) {
        notify("error", res.error);
        return;
      }
      setName("");
      setPositionId("");
      setOpen(false);
      router.push(`/admissoes/configuracoes/modelos?t=${res.id}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Nome do modelo (ex.: Admissão CLT padrão)"
        className={`${input} w-[260px]`}
      />
      <select
        value={positionId}
        onChange={(e) => setPositionId(e.target.value)}
        className={`${input} w-[180px]`}
      >
        <option value="">Todos os cargos</option>
        {positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!name.trim() || isPending}
        onClick={submit}
        className="bg-wg-green hover:bg-wg-green-bright text-black text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
      >
        Criar
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-gray-500 hover:text-gray-800 px-2"
      >
        Cancelar
      </button>
    </div>
  );
}
