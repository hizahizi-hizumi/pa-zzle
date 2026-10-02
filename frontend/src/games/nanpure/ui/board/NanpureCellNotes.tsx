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
};

const textSizeClassNames: Record<NanpureCellNotesSize, string> = {
  board: "text-[clamp(0.58rem,2.4vw,0.9rem)]",
  figure: "text-xs",
};

export function NanpureCellNotes({
  notes,
  selectedValue,
  size,
}: NanpureCellNotesProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        // 文字サイズのクラスは後ろに置くと cn が leading-none を外すため、先に置く。
        textSizeClassNames[size],
        "grid h-full w-full grid-cols-3 grid-rows-3 place-items-center leading-none font-normal text-muted-foreground/60",
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
