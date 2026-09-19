import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function StartConditionOption({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="relative flex h-44 flex-col items-center justify-center gap-4 rounded-2xl border bg-background px-10 py-4 transition-colors group-hover:bg-accent/60 group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring sm:h-60 sm:gap-6 sm:py-8">
      {children}
      <span className="text-lg font-semibold tracking-tight sm:text-xl">
        {label}
      </span>
      <ChevronRight
        className="absolute right-4 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </span>
  );
}
