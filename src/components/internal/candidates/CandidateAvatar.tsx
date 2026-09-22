import { cn } from "@/lib/utils";
import { avatarTone, candidateInitials } from "@/lib/recruitment/candidate-presentation";

interface Props {
  name: string;
  /** Semente da cor (id da candidatura) — a mesma pessoa mantém a mesma cor. */
  seed: string;
  size?: "sm" | "md";
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
        size === "sm" ? "h-8 w-8 text-[11.5px]" : "h-9 w-9 text-[12.5px]",
        className
      )}
      style={{ background: tone.bg, color: tone.fg }}
    >
      {candidateInitials(name)}
    </span>
  );
}
