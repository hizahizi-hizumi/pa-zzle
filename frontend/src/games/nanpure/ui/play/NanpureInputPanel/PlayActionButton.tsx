import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PlayActionButtonProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function PlayActionButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: PlayActionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active || undefined}
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35",
        active &&
          "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true" className="[&>svg]:size-6">
        {icon}
      </span>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  );
}
