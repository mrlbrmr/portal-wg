import { cn } from "@/lib/utils";

/** Iniciais (até 2) de um nome — "Aline Popenda" → "AP". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[12.5px]",
} as const;

/**
 * Avatar por iniciais (não há foto de usuário no sistema). Tom neutro da marca para não
 * competir com badges de status.
 */
export function UserAvatar({ name, size = "md", className }: { name: string | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-wg-sidebar font-semibold text-wg-green-dark ring-1 ring-wg-border-light",
        SIZES[size],
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
