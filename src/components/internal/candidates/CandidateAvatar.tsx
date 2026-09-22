import { cn } from "@/lib/utils";
import { avatarTone, candidateInitials } from "@/lib/recruitment/candidate-presentation";

interface Props {
  name: string;
  /** Semente da cor (id da candidatura) — a mesma pessoa mantém a mesma cor. */
  seed: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

/** Iniciais em círculo com tom dessaturado. Decorativo: o nome sempre aparece ao lado. */
export function CandidateAvatar({ name, seed, size = "md", className }: Props) {
  const tone = avatarTone(seed);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide",
        size === "xs" ? "h-7 w-7 text-[10.5px]" : size === "sm" ? "h-8 w-8 text-[11.5px]" : size === "lg" ? "h-10 w-10 text-[13px]" : "h-9 w-9 text-[12.5px]",
        className
      )}
      style={{ background: tone.bg, color: tone.fg }}
    >
      {candidateInitials(name)}
    </span>
  );
}
