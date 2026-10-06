import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
import type { DifficultyLevel } from "@/games/difficulty";
import { cn } from "@/lib/utils";

type StartConditionOptionProps = {
  label: string;
  /** 難易度の選択肢のとき、レベルをピースの帯で示し、ラベルはその補足に下げる。 */
  level?: DifficultyLevel;
  children: ReactNode;
  density?: "regular" | "compact";
};

const layoutClassNames = {
  regular:
    "h-44 flex-col justify-center gap-4 px-8 py-4 sm:h-60 sm:gap-6 sm:py-8",
  compact:
    "h-16 flex-row justify-start gap-4 px-4 lg:h-60 lg:flex-col lg:justify-center lg:gap-6 lg:py-8",
} satisfies Record<NonNullable<StartConditionOptionProps["density"]>, string>;

// 一覧で選択肢を並べたとき、ラベルの位置をゲームによらずそろえるため、プレビューの幅をここで固定する。
const previewFrameClassNames = {
  regular: "contents",
  compact: "flex w-32 shrink-0 lg:w-full lg:justify-center",
} satisfies Record<NonNullable<StartConditionOptionProps["density"]>, string>;

export function StartConditionOption({
  label,
  level,
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
      <span className={previewFrameClassNames[density]}>{children}</span>
      {level === undefined ? (
        <span className="text-heading">{label}</span>
      ) : (
        <span className="flex flex-col items-start gap-1 lg:items-center lg:gap-2">
          <DifficultyLevelPieces level={level} />
          <span className="text-supporting text-muted-foreground">{label}</span>
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
