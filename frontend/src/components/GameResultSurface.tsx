import type { ReactNode } from "react";

import type { GameResultSurfaceVariant } from "@/components/game-result-style";

type GameResultSurfaceProps = {
  variant: GameResultSurfaceVariant;
  label: string;
  children: ReactNode;
};

const variantClassNames: Record<GameResultSurfaceVariant, string> = {
  neutral: "bg-muted/40",
  good: "bg-result-good-surface",
  great: "bg-result-great-surface",
  perfect: "bg-result-perfect-surface",
  personalBest: "bg-amber-50/85 dark:bg-amber-950/30",
};

export function GameResultSurface({
  variant,
  label,
  children,
}: GameResultSurfaceProps) {
  return (
    <section
      aria-label={label}
      className={`rounded-lg px-4 py-3 shadow-raised ${variantClassNames[variant]}`}
    >
      {children}
    </section>
  );
}
