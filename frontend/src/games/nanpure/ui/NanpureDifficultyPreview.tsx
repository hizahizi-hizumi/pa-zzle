import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { cn } from "@/lib/utils";

// 9×9 盤面の中段3行・2〜8列目を切り出した図。数字の密度で挑戦の強さを抽象的に見せる。
// 実際の問題のヒント数ではなく、レベルの順序を見せるための抽象表現とする。
const previewSolution = ["4536872", "2645193", "1327954"] as const;

// `#` はヒント、`+` は記入済みの数字、`.` は空き。上のレベルのヒントは下のレベルのヒントにすべて含まれる。
const previewLayouts = {
  "1": ["##+#.##", ".##.#.#", "#.##.#+"],
  "2": ["##+..##", ".##.#..", "#.##.#+"],
  "3": [".#+..##", ".##.#..", "#.#..#+"],
  "4": [".#+...#", ".#..#..", "#.#..#+"],
  "5": [".#+...#", "....#..", "#....#+"],
} satisfies Record<NanpureDifficulty, readonly string[]>;

const PREVIEW_COLUMNS = previewSolution[0].length;
// 切り出した列のうち、3×3 ブロックの左端になる列。
const BLOCK_START_COLUMNS = new Set([2, 5]);

const cellPositions = previewSolution.flatMap((row, rowIndex) =>
  Array.from(row, (digit, column) => ({
    id: `cell-${rowIndex}-${column}`,
    row: rowIndex,
    column,
    digit,
  })),
);

type NanpureDifficultyPreviewProps = {
  difficulty: NanpureDifficulty;
};

export function NanpureDifficultyPreview({
  difficulty,
}: NanpureDifficultyPreviewProps) {
  const layout = previewLayouts[difficulty];

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center lg:w-32 lg:justify-center"
    >
      <span className="grid grid-cols-[repeat(7,18px)] auto-rows-[18px] border-t-2 border-r border-b-2 border-t-foreground/55 border-r-border/85 border-b-foreground/55 bg-background">
        {cellPositions.map(({ id, row, column, digit }) => {
          const mark = layout[row]![column]!;

          return (
            <span
              key={id}
              className={cn(
                "flex items-center justify-center border-t border-l border-border/85 font-sans text-[11px] tabular-nums",
                row === 0 && "border-t-0",
                BLOCK_START_COLUMNS.has(column) &&
                  "border-l-2 border-l-foreground/55",
                mark === "#" && "font-semibold text-foreground/90",
                mark === "+" &&
                  "font-medium text-violet-500 dark:text-violet-300",
              )}
            >
              {mark === "." ? "" : digit}
            </span>
          );
        })}
      </span>
    </span>
  );
}

export const _private = { previewLayouts, PREVIEW_COLUMNS };
