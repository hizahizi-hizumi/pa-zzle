import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HowToPlayVerdictLineProps = {
  /**
   * 言葉の前に置く記号（✓ / ✕ や、それと同じ働きの小さな印）。記号は 16px の場所の中央に置く。
   * `null` は記号を置かずに場所だけを空け、言葉の頭を記号のある行とそろえる。渡さなければ場所も取らない。
   */
  mark?: ReactNode;
  /** 言葉。 */
  children: ReactNode;
  /**
   * 言葉の下に、言葉の頭にそろえて添える物（わけなど）。行の高さを取らずに重ね、読み上げは言葉の後に「・」で続けて読む。
   */
  below?: ReactNode;
  /** 置き場所いっぱいに広げたときの寄せ方。渡さなければ中身の幅で置く。 */
  align?: "start" | "center" | "end";
};

const alignClassNames = {
  start: "w-full justify-start",
  center: "w-full justify-center",
  end: "w-full justify-end",
} as const;

/**
 * 遊び方の例の下に添える、記号と言葉の1行。記号の場所と、記号と言葉の間をどの行でも同じにし、
 * 同じ場所で入れ替える行どうし（判定・凡例・起きたこと）の言葉の頭がそろうようにする。
 */
export function HowToPlayVerdictLine({
  mark,
  children,
  below,
  align,
}: HowToPlayVerdictLineProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 whitespace-nowrap",
        align === undefined ? null : alignClassNames[align],
      )}
    >
      {mark === undefined ? null : (
        <span
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center"
        >
          {mark}
        </span>
      )}
      {below === undefined ? null : (
        // 言葉の頭に幅の無い置き場所を置き、その下に添える物を重ねる。置き場所の後の間は打ち消し、記号と言葉の間を変えない。
        <span className="relative -mr-1 w-0 self-stretch">
          <span
            aria-hidden="true"
            className="absolute top-full left-0 whitespace-nowrap"
          >
            {below}
          </span>
        </span>
      )}
      {children}
      {below === undefined ? null : <span className="sr-only">・{below}</span>}
    </span>
  );
}
