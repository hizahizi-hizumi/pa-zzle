import { Pointer } from "lucide-react";

import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
} from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

type HowToPlayFigureProps = {
  board: HitofudePuzzleBoard;
  path: readonly number[];
  isDeadEnd?: boolean;
  /** 盤面と同じ×の印を点けたまま描く。 */
  blockedCell?: number;
  fingerCell?: number;
};

export function HowToPlayFigure({
  board,
  path,
  isDeadEnd = false,
  blockedCell,
  fingerCell,
}: HowToPlayFigureProps) {
  const finger =
    fingerCell === undefined
      ? null
      : getHitofudePuzzleCellPosition(board.size, fingerCell);

  return (
    <span aria-hidden="true" className="relative block size-24 shrink-0">
      <HitofudePuzzleFigure
        board={board}
        path={path}
        isDeadEnd={isDeadEnd}
        solved={false}
        blockedCell={blockedCell}
        showsBlockedMark
      />
      {finger === null ? null : (
        <Pointer
          className="absolute size-5 fill-background text-foreground"
          style={{
            left: `${((finger.column + 0.5) / board.size) * 100}%`,
            top: `${((finger.row + 0.5) / board.size) * 100}%`,
          }}
        />
      )}
    </span>
  );
}
