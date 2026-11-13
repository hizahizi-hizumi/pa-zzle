import type { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import { isHitofudePuzzleDeadEnd } from "@/games/hitofude-puzzle/puzzle/rules";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { hitofudePuzzleGroundClassName } from "@/games/hitofude-puzzle/ui/HitofudePuzzleGround";
import {
  getHitofudePuzzleFigureCellBoxStyle,
  getHitofudePuzzleFigureSide,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-size";
import { cn } from "@/lib/utils";

type HowToPlayFigureProps = {
  board: HitofudePuzzleBoard;
  path: readonly number[];
  /**
   * そのコマへ進めた操作で押したマス。押した所を囲む無彩の枠で示し、押せる例の手がかり（破線の枠と指）とは見分ける。
   */
  pressedCell?: number | null;
};

/**
 * 押せない図の盤面1つ。本番の盤面の絵をそのまま、置き場所が決めたマスの大きさ（`--hitofude-figure-cell`）で描く。
 * 盤面の下にプレイ画面と同じ地を敷き、穴と縁の欠けを本番と同じ色で見せる。行き止まりの先端は本番と同じ印にする。
 */
export function HowToPlayFigure({
  board,
  path,
  pressedCell = null,
}: HowToPlayFigureProps) {
  const side = getHitofudePuzzleFigureSide(board.size);
  return (
    <span
      className={cn("relative block shrink-0", hitofudePuzzleGroundClassName)}
      style={{ width: side, height: side }}
    >
      <HitofudePuzzleFigure
        board={board}
        path={path}
        isDeadEnd={isHitofudePuzzleDeadEnd(board, path)}
        solved={false}
      />
      {pressedCell === null ? null : (
        <span
          data-pressed-cell={pressedCell}
          className="absolute"
          style={getHitofudePuzzleFigureCellBoxStyle(board.size, pressedCell)}
        >
          <span className="absolute inset-[6%] rounded-[22%] border-(length:--border-width-strong) border-muted-foreground" />
        </span>
      )}
    </span>
  );
}
