import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { cn } from "@/lib/utils";

const NANPURE_SIZE = 9;

const cellPositions = Array.from(
  { length: NANPURE_SIZE * NANPURE_SIZE },
  (_, cellIndex) => ({
    id: `cell-${Math.floor(cellIndex / NANPURE_SIZE)}-${cellIndex % NANPURE_SIZE}`,
    cellIndex,
  }),
);

const representativePuzzles = {
  easy: "......812.143..59...5216...4..567.8.8....346.1.7.4..2.7.....95.5.1.8.64.6....4.7.",
  normal:
    ".1...6..9.....7...3..59.1.65312.897....1...32..473...1..5...39.9.....2..7....36.8",
  hard: "56.....2.3.......91..23.5..6..4.83....5.......913..6.2...91.83..8.6...4.....4...5",
} satisfies Record<NanpureDifficulty, string>;

const previewEntries: Record<
  NanpureDifficulty,
  Readonly<Record<number, string>>
> = {
  easy: { 3: "4", 25: "3", 40: "2" },
  normal: { 3: "3", 25: "8", 40: "4" },
  hard: { 3: "7", 25: "6", 40: "2" },
};

type NanpureDifficultyPreviewProps = {
  difficulty: NanpureDifficulty;
};

export function NanpureDifficultyPreview({
  difficulty,
}: NanpureDifficultyPreviewProps) {
  const cells = [...representativePuzzles[difficulty]];
  const entries = previewEntries[difficulty];

  return (
    <span
      aria-hidden="true"
      className="block size-[100px] overflow-hidden sm:size-[120px]"
    >
      <span className="grid aspect-square w-[180px] -translate-x-[60px] grid-cols-9 bg-background sm:w-[216px] sm:-translate-x-[72px]">
        {cellPositions.map(({ id, cellIndex }) => {
          const cell = cells[cellIndex]!;
          const entry = entries[cellIndex];
          const row = Math.floor(cellIndex / NANPURE_SIZE);
          const column = cellIndex % NANPURE_SIZE;

          return (
            <span
              key={id}
              className={cn(
                "flex aspect-square items-center justify-center border-t border-l border-border/85 font-sans text-xs tabular-nums sm:text-sm",
                row % 3 === 0 && "border-t-2 border-t-foreground/55",
                column % 3 === 0 && "border-l-2 border-l-foreground/55",
                cell !== "." && "font-semibold text-foreground/90",
                entry !== undefined &&
                  "font-medium text-violet-500 dark:text-violet-300",
              )}
            >
              {cell === "." ? entry : cell}
            </span>
          );
        })}
      </span>
    </span>
  );
}
