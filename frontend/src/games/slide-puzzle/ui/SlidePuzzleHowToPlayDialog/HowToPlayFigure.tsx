import {
  getSlidePuzzleBoardSize,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
  type SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleTileFace } from "@/games/slide-puzzle/ui/board/SlidePuzzleTileFace";
import { SlidePuzzleGround } from "@/games/slide-puzzle/ui/SlidePuzzleGround";
import { cn } from "@/lib/utils";

const gridClassByBoardSize: Record<SlidePuzzleBoardSize, string> = {
  3: "grid-cols-3 grid-rows-3",
  4: "grid-cols-4 grid-rows-4",
  5: "grid-cols-5 grid-rows-5",
};

type HowToPlayFigureProps = {
  board: SlidePuzzleBoard;
  /** そのコマで押したタイル。押せる例の手がかりと見分けられるよう、タイルを無彩の枠で囲む。 */
  pressedTile: SlidePuzzleTile | null;
};

/**
 * 採点の流れの図の、押せない盤面1コマ。本番の盤面と同じトレイ・タイル・地で描く。
 * 地を合わせて、2コマと矢印が元に戻すボタンの無い面の幅に横に並ぶ大きさにし、触れる例の盤面より大きくしない。
 */
export function HowToPlayFigure({ board, pressedTile }: HowToPlayFigureProps) {
  const boardSize = getSlidePuzzleBoardSize(board);
  return (
    <SlidePuzzleGround shape="figure-frame">
      {/* 本番の盤面部品の角丸（1rem）は固定の長さで、小さく描くと角のタイルがトレイの角からはみ出すので、触れる例の盤面（最大 14rem で角丸 1rem）と同じ比にする。 */}
      <span
        className="@container block aspect-square rounded-[calc(100%/14)] bg-muted p-[1%]"
        style={{ width: "calc(min((100cqw - 5rem) / 2, 15rem) - 0.75rem)" }}
      >
        <span className={cn("grid size-full", gridClassByBoardSize[boardSize])}>
          {board.map((tile) => (
            <span key={tile} className="p-[1cqw]">
              {tile === SLIDE_PUZZLE_BLANK ? null : (
                <SlidePuzzleTileFace tile={tile} boardSize={boardSize}>
                  {tile === pressedTile ? (
                    <span
                      data-pressed-tile
                      className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-foreground ring-inset"
                    />
                  ) : null}
                </SlidePuzzleTileFace>
              )}
            </span>
          ))}
        </span>
      </span>
    </SlidePuzzleGround>
  );
}
