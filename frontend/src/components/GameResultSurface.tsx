import type { ReactNode } from "react";

import type { GameResultSurfaceVariant } from "@/components/game-result-style";

type GameResultSurfaceProps = {
  variant: GameResultSurfaceVariant;
  label: string;
  children: ReactNode;
};

const variantClassNames: Record<GameResultSurfaceVariant, string> = {
  neutral: "border-border bg-muted/40",
  good: "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30",
  great:
    "border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/70 dark:bg-emerald-950/30",
  perfect:
    "border-amber-300/80 bg-amber-50/85 dark:border-amber-900/80 dark:bg-amber-950/30",
  personalBest:
    "border-amber-300/80 bg-amber-50/85 dark:border-amber-900/80 dark:bg-amber-950/30",
};

export function GameResultSurface({
  variant,
  label,
  children,
}: GameResultSurfaceProps) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border-(length:--border-width-normal) px-4 py-3 shadow-raised ${variantClassNames[variant]}`}
    >
      {children}
    </section>
  );
}
