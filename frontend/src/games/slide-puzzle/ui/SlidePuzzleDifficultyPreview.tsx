import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

// 各レベルの問題集にある実際の盤面から、上のレベルほど正しい位置を外れたタイルが多いものを選んだ。
// 盤面は各レベルで実際に遊ぶ大きさにし、正しい位置を外れたタイルの枚数は 7 / 9 / 11 / 13 / 15 枚にそろえた。
// 1: sp3-20-0 / 2: sp4-20-8 / 3: sp4-30-16 / 4: sp4-40-4 / 5: sp5-40-1
const previewBoards = {
  "1": [8, 4, 0, 5, 3, 1, 7, 6, 2],
  "2": [1, 2, 3, 4, 5, 0, 6, 8, 14, 13, 7, 10, 9, 12, 11, 15],
  "3": [0, 6, 3, 4, 2, 14, 7, 8, 1, 13, 9, 10, 5, 12, 11, 15],
  "4": [0, 1, 4, 8, 5, 7, 3, 15, 13, 10, 12, 11, 9, 2, 6, 14],
  "5": [
    1, 2, 3, 9, 4, 6, 12, 7, 14, 8, 11, 13, 18, 5, 20, 21, 0, 16, 19, 10, 17,
    22, 23, 24, 15,
  ],
} satisfies Record<SlidePuzzleDifficulty, SlidePuzzleBoard>;

/** タイルの間隔と余白は盤面サイズによらず同じにし、数字はタイル幅に対して 4×4 と同じ割合にする。 */
const gridClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "grid-cols-3 grid-rows-3",
  4: "grid-cols-4 grid-rows-4",
  5: "grid-cols-5 grid-rows-5",
};
const tileNumberClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "text-[15.2cqw]",
  4: "text-[11cqw]",
  5: "text-[8.5cqw]",
};

type SlidePuzzleDifficultyPreviewProps = {
  difficulty: SlidePuzzleDifficulty;
};

export function SlidePuzzleDifficultyPreview({
  difficulty,
}: SlidePuzzleDifficultyPreviewProps) {
  const board = previewBoards[difficulty];
  const boardSize = getSlidePuzzleBoardSize(board);

  return (
    <span
      aria-hidden="true"
      className="@container block size-14 shrink-0 rounded-md bg-muted lg:size-28"
    >
      <span
        className={`grid size-full ${gridClassByBoardSize[boardSize]} gap-[3cqw] p-[4cqw]`}
      >
        {board.map((tile) =>
          tile === SLIDE_PUZZLE_BLANK ? (
            <span key="blank" />
          ) : (
            <span
              key={tile}
              className={`flex items-center justify-center rounded-[3cqw] border border-border bg-card font-sans ${tileNumberClassByBoardSize[boardSize]} leading-none font-semibold text-card-foreground tabular-nums`}
            >
              {tile}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
