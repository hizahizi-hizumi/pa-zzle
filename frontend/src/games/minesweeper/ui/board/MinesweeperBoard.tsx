import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type { MinesweeperOperation } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import type { MinesweeperCellCue } from "@/games/minesweeper/ui/board/cell-cue";
import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperCell";
import { playMineSteppedImpact } from "@/games/minesweeper/ui/board/mine-stepped-impact";
import {
  getOpeningRipple,
  playOpeningRipple,
} from "@/games/minesweeper/ui/board/opening-ripple";

export type MinesweeperInputMode = "reveal" | "flag";

export type MinesweeperBoardProps = {
  rows: number;
  columns: number;
  cells: readonly MinesweeperVisibleCell[];
  mode: MinesweeperInputMode;
  /** 渡すと、開いたマスを押したマスから広がる順に開き、地雷を踏んだ重さを盤面の揺れで返す。 */
  operation?: MinesweeperOperation | null;
  interactionDisabled: boolean;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  cues?: readonly MinesweeperCellCue[];
  spotlitCellIndices?: readonly number[];
  onIneffectiveCellPress?: (cellIndex: number) => void;
};

function getCellKey(columns: number, cellIndex: number): string {
  const row = Math.floor(cellIndex / columns);
  const column = cellIndex % columns;
  return `${row}:${column}`;
}

/** 盤面と同じ格子にマスを重ねる部品（チュートリアルの始めの盤面へ戻す面）も、このクラスと `getMinesweeperBoardGridStyle` で並べる。 */
export const MINESWEEPER_BOARD_GRID_CLASS_NAME =
  "grid w-full gap-[4px] p-[8px]";

export function getMinesweeperBoardGridStyle(columns: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

const BOARD_GAP_PX = 4;
const BOARD_PADDING_PX = 8;

/**
 * 盤面を、置き場所（`container-type: size` の要素）の幅と高さの両方に収める幅。マスは正方形なので、置き場所の高さに
 * 縦のマスを並べきれる幅を、マスの間と盤面の内側の余白（`MINESWEEPER_BOARD_GRID_CLASS_NAME`）を含めて求める。
 */
export function getMinesweeperBoardFittingWidth(
  rows: number,
  columns: number,
  maxWidth: string,
): string {
  const verticalChromePx = BOARD_PADDING_PX * 2 + BOARD_GAP_PX * (rows - 1);
  const horizontalChromePx =
    BOARD_PADDING_PX * 2 + BOARD_GAP_PX * (columns - 1);
  const widthForHeight = `calc((100cqh - ${verticalChromePx}px) / ${rows} * ${columns} + ${horizontalChromePx}px)`;
  return `min(100cqw, ${maxWidth}, ${widthForHeight})`;
}

const BOARD_CLASS_NAME = `${MINESWEEPER_BOARD_GRID_CLASS_NAME} rounded-[6px] bg-[#a7b2c0] shadow-[0_2px_0_#8796a8,0_8px_16px_#52657b1f,inset_0_1px_0_#f7f9fc,inset_0_-1px_0_#909fb24d] dark:bg-[#2d3a4c] dark:shadow-[0_2px_0_#172333,0_8px_16px_#04091566,inset_0_1px_0_#7b8da34a,inset_0_-1px_0_#10192680]`;

export function MinesweeperBoard({
  rows,
  columns,
  cells,
  mode,
  operation = null,
  interactionDisabled,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  cues = [],
  spotlitCellIndices = [],
  onIneffectiveCellPress,
}: MinesweeperBoardProps) {
  const cueByCellIndex = new Map(cues.map((cue) => [cue.cellIndex, cue]));
  const boardRef = useRef<HTMLDivElement>(null);

  // 盤面の変化を描いた最初のフレームから動きを付けるため、描画の前に始める。
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (
      !board ||
      (operation?.type !== "cells-opened" && operation?.type !== "mine-stepped")
    ) {
      return;
    }
    const animations = [
      ...playOpeningRipple(
        board,
        getOpeningRipple(
          columns,
          operation.cellIndex,
          operation.openedCellIndices,
        ),
      ),
      ...(operation.type === "mine-stepped"
        ? playMineSteppedImpact(board, operation.cellIndex)
        : []),
    ];
    // 次の操作が来たら途中の動きを最後の姿へ飛ばし、二重に動かさない。
    return function finishAnimations() {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [operation, columns]);

  if (cells.length !== rows * columns) {
    throw new Error(
      "Minesweeper visible cells must match the board dimensions",
    );
  }

  function handleCellPress(cellIndex: number): void {
    const cell = cells[cellIndex];
    if (!cell) {
      return;
    }

    if (cell.state === "revealed") {
      if (mode === "reveal") {
        onChordCell(cellIndex);
      } else {
        onIneffectiveCellPress?.(cellIndex);
      }
      return;
    }

    if (cell.state === "mine" || cell.state === "steppedMine") {
      onIneffectiveCellPress?.(cellIndex);
      return;
    }

    if (mode === "flag") {
      onToggleFlag(cellIndex);
      return;
    }

    onRevealCell(cellIndex);
  }

  function handleCellFlagPress(cellIndex: number): void {
    const cell = cells[cellIndex];
    if (cell?.state === "hidden" || cell?.state === "flagged") {
      onToggleFlag(cellIndex);
    } else {
      onIneffectiveCellPress?.(cellIndex);
    }
  }

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={`${MINESWEEPER_DISPLAY_NAME}盤面`}
      className={BOARD_CLASS_NAME}
      style={getMinesweeperBoardGridStyle(columns)}
    >
      {cells.map(function renderCell(cell, cellIndex) {
        return (
          <MinesweeperCell
            key={getCellKey(columns, cellIndex)}
            cellIndex={cellIndex}
            view={cell}
            cue={cueByCellIndex.get(cellIndex)}
            spotlit={spotlitCellIndices.includes(cellIndex)}
            disabled={interactionDisabled}
            onPress={handleCellPress}
            onFlagPress={handleCellFlagPress}
          />
        );
      })}
    </div>
  );
}
