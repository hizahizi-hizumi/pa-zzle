import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { cn } from "@/lib/utils";

type NanpureCellNotesProps = {
  notes: NanpureNotes[number];
  selectedValue: NanpureDigit | null;
};

export function NanpureCellNotes({
  notes,
  selectedValue,
}: NanpureCellNotesProps) {
  return (
    <span
      aria-hidden="true"
      className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center text-[clamp(0.58rem,2.4vw,0.9rem)] leading-none font-normal text-muted-foreground/60"
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
