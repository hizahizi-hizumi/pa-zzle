import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import {
  FIFTEEN_PUZZLE_BLANK,
  type FifteenPuzzleBoard,
} from "@/games/fifteen-puzzle/puzzle/state";

// 各レベルの問題集にある実際の盤面から、上のレベルほど正しい位置を外れたタイルが多いものを選んだ。
// 1: fp20-82 / 2: fp20-3 / 3: fp50-6 / 4: fp60-0 / 5: fp100-12
const previewBoards = {
  "1": [1, 2, 3, 4, 5, 0, 8, 11, 9, 6, 10, 15, 13, 14, 12, 7],
  "2": [1, 2, 10, 4, 5, 0, 6, 8, 13, 7, 3, 12, 14, 9, 11, 15],
  "3": [1, 2, 10, 4, 5, 11, 8, 12, 7, 13, 3, 15, 9, 0, 6, 14],
  "4": [2, 8, 11, 3, 9, 0, 5, 4, 13, 1, 12, 10, 6, 14, 15, 7],
  "5": [6, 1, 0, 13, 2, 15, 4, 7, 10, 3, 12, 11, 9, 8, 14, 5],
} satisfies Record<FifteenPuzzleDifficulty, FifteenPuzzleBoard>;

type FifteenPuzzleDifficultyPreviewProps = {
  difficulty: FifteenPuzzleDifficulty;
};

export function FifteenPuzzleDifficultyPreview({
  difficulty,
}: FifteenPuzzleDifficultyPreviewProps) {
  return (
    <span
      aria-hidden="true"
      className="@container block size-14 shrink-0 rounded-md bg-muted lg:size-28"
    >
      <span className="grid size-full grid-cols-4 grid-rows-4 gap-[3cqw] p-[4cqw]">
        {previewBoards[difficulty].map((tile) =>
          tile === FIFTEEN_PUZZLE_BLANK ? (
            <span key="blank" />
          ) : (
            <span
              key={tile}
              className="flex items-center justify-center rounded-[3cqw] border border-border bg-card font-sans text-[11cqw] leading-none font-semibold text-card-foreground tabular-nums"
            >
              {tile}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
