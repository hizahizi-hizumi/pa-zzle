import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { cn } from "@/lib/utils";

type NanpureCellNotesSize = "board" | "figure";

type NanpureCellNotesProps = {
  notes: NanpureNotes[number];
  selectedValue: NanpureDigit | null;
  size: NanpureCellNotesSize;
  /** 選んだマスの濃い地の上でも読めるよう、メモを濃い色で書く。 */
  onSelectedCell?: boolean;
};

const textSizeClassNames: Record<NanpureCellNotesSize, string> = {
  board: "text-[clamp(0.7rem,2.9vw,1.08rem)]",
  figure: "text-xs",
};

export function NanpureCellNotes({
  notes,
  selectedValue,
  size,
  onSelectedCell = false,
}: NanpureCellNotesProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        // 文字サイズのクラスは後ろに置くと cn が leading-none を外すため、先に置く。
        textSizeClassNames[size],
        "grid h-full w-full grid-cols-3 grid-rows-3 place-items-center leading-none font-medium text-muted-foreground",
        onSelectedCell && "text-violet-950/85 dark:text-violet-50",
      )}
    >
      {NANPURE_DIGITS.map((digit) => (
        <span
          key={digit}
          className={cn(
            selectedValue === digit &&
              notes.includes(digit) &&
              "font-semibold text-violet-700 dark:text-violet-300",
          )}
        >
          {notes.includes(digit) ? digit : ""}
        </span>
      ))}
    </span>
  );
}
