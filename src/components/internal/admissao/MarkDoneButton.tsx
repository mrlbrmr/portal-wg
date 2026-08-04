"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChecklistItemDone } from "@/lib/admissao/actions";

type Props = {
  admissionId: string;
  itemId: string;
};

export function MarkDoneButton({ admissionId, itemId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDone() {
    startTransition(async () => {
      await setChecklistItemDone(admissionId, itemId, true);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDone}
      disabled={isPending}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAF4DC] text-[#3E5A2A] text-[11.5px] font-semibold hover:bg-[#D7ECC4] transition-colors disabled:opacity-50 shrink-0"
    >
      {isPending ? "…" : "✓ Concluir"}
    </button>
  );
}
