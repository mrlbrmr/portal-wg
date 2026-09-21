import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_SOFT, type Tone } from "@/components/ui/StatusBadge";

interface Props {
  href: string;
  icon: ElementType;
  tone: Tone;
  /** Quantidade em destaque (ex.: 5). Omitir quando o item não é contável. */
  count?: number;
  title: ReactNode;
  description?: ReactNode;
}

/**
 * Linha clicável de pendência/fila de trabalho: ícone em tom semântico, contagem,
 * descrição do que precisa ser feito e seta. Leva à tela já filtrada.
 */
export function ActionListItem({ href, icon: Icon, tone, count, title, description }: Props) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-wg-bg"
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", TONE_SOFT[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body text-wg-ink">
            {count !== undefined && <strong className="font-semibold tabular-nums">{count} </strong>}
            {title}
          </span>
          {description && <span className="block truncate text-meta text-wg-ink-muted">{description}</span>}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-wg-ink-muted opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
  );
}
