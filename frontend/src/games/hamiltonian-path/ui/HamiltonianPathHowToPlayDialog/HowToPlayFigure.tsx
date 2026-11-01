import { Pointer } from "lucide-react";

import {
  getHamiltonianPathCellPosition,
  type HamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import { HamiltonianPathFigure } from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";

type HowToPlayFigureProps = {
  board: HamiltonianPathBoard;
  path: readonly number[];
  isDeadEnd?: boolean;
  strandedCells?: readonly number[];
  /** 進もうとして阻まれたマス。盤面と同じ×の印を点けたまま描く。 */
  blockedCell?: number;
  /** 指を置いているマス。指の印を添える。 */
  fingerCell?: number;
};

/** 盤面と同じ見た目で描く、遊び方の小さな図。 */
export function HowToPlayFigure({
  board,
  path,
  isDeadEnd = false,
  strandedCells,
  blockedCell,
  fingerCell,
}: HowToPlayFigureProps) {
  const finger =
    fingerCell === undefined
      ? null
      : getHamiltonianPathCellPosition(board.size, fingerCell);

  return (
    <span aria-hidden="true" className="relative block size-24 shrink-0">
      <HamiltonianPathFigure
        board={board}
        path={path}
        isDeadEnd={isDeadEnd}
        solved={false}
        strandedCells={strandedCells}
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
