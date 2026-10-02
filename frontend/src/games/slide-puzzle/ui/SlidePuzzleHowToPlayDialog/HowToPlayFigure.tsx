import { Pointer } from "lucide-react";

import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";

/** 盤面と同じく、一辺のマス数で縦横を等分する。 */
const gridClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "grid-cols-3 grid-rows-3",
  4: "grid-cols-4 grid-rows-4",
  5: "grid-cols-5 grid-rows-5",
};

type HowToPlayFigureProps = {
  board: SlidePuzzleBoard;
  /** 押すタイルの番号。指の印を添える。 */
  pressedTile?: SlidePuzzleTile;
};

/** 盤面と同じタイルの見た目で描く、遊び方の小さな図。 */
export function HowToPlayFigure({ board, pressedTile }: HowToPlayFigureProps) {
  const boardSize = getSlidePuzzleBoardSize(board);

  return (
    <span
      aria-hidden="true"
      className="@container block size-28 shrink-0 rounded-md bg-muted p-[1%]"
    >
      <span className={`grid size-full ${gridClassByBoardSize[boardSize]}`}>
        {board.map((tile) => (
          <span key={tile} className="relative p-[1cqw]">
            {tile === SLIDE_PUZZLE_BLANK ? null : (
              <SlidePuzzleTileFace tile={tile} boardSize={boardSize} />
            )}
            {tile === pressedTile ? (
              <Pointer className="absolute -right-0.5 -bottom-1 size-4 fill-background text-foreground" />
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}
