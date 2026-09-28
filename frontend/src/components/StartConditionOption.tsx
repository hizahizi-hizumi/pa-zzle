import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StartConditionOptionProps = {
  label: string;
  children: ReactNode;
  density?: "regular" | "compact";
};

const layoutClassNames = {
  regular:
    "h-44 flex-col justify-center gap-4 px-8 py-4 sm:h-60 sm:gap-6 sm:py-8",
  compact:
    "h-16 flex-row justify-start gap-4 px-4 lg:h-60 lg:flex-col lg:justify-center lg:gap-6 lg:py-8",
} satisfies Record<NonNullable<StartConditionOptionProps["density"]>, string>;

export function StartConditionOption({
  label,
  children,
  density = "regular",
}: StartConditionOptionProps) {
  return (
    <span
      className={cn(
        "relative flex items-center rounded-xl border-(length:--border-width-normal) bg-background transition-colors group-hover:bg-accent/60 group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring",
        layoutClassNames[density],
      )}
    >
      {children}
      <span className="text-heading">{label}</span>
      <ChevronRight
        className={cn(
          "absolute right-4 size-5 text-muted-foreground transition-transform duration-(--duration-fast) ease-standard group-hover:translate-x-0.5",
          density === "compact" && "lg:hidden",
        )}
        aria-hidden="true"
      />
    </span>
  );
}
