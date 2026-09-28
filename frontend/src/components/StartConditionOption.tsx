import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StartConditionOptionProps = {
  label: string;
  /** 図だけでは伝わりにくい、その開始条件で何が変わるかの短い補足。 */
  description?: string;
  children: ReactNode;
  density?: "regular" | "compact";
};

const layoutClassNames = {
  regular:
    "h-44 flex-col justify-center gap-4 px-8 py-4 sm:h-60 sm:gap-6 sm:py-8",
  compact:
    "min-h-16 flex-row justify-start gap-4 py-2 pr-12 pl-4 lg:h-60 lg:flex-col lg:justify-center lg:gap-6 lg:px-4 lg:py-8",
} satisfies Record<NonNullable<StartConditionOptionProps["density"]>, string>;

const descriptionAlignmentClassNames = {
  regular: "items-center text-center",
  compact: "lg:items-center lg:text-center",
} satisfies Record<NonNullable<StartConditionOptionProps["density"]>, string>;

export function StartConditionOption({
  label,
  description,
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
      {description === undefined ? (
        <span className="text-heading">{label}</span>
      ) : (
        <span
          className={cn(
            "flex flex-col",
            descriptionAlignmentClassNames[density],
          )}
        >
          <span className="text-heading">{label}</span>
          <span className="text-supporting text-muted-foreground">
            {description}
          </span>
        </span>
      )}
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
