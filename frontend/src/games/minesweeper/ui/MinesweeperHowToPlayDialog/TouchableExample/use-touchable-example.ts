import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import {
  createMinesweeperFlagOperation,
  createMinesweeperOpeningOperation,
  type MinesweeperOperation,
} from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import {
  chordMinesweeperExampleCell,
  createMinesweeperExampleBoard,
  isMinesweeperExampleChanged,
  type MinesweeperExampleBoard,
  type MinesweeperHowToPlayFigureRows,
  revealMinesweeperExampleCell,
  toggleMinesweeperExampleFlag,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import { useMinesweeperSoundEffects } from "@/games/minesweeper/ui/use-minesweeper-sound-effects";

export type MinesweeperTouchableExample = {
  example: MinesweeperExampleBoard;
  mode: MinesweeperInputMode;
  changeMode: (mode: MinesweeperInputMode) => void;
  revealCell: (cellIndex: number) => void;
  toggleFlag: (cellIndex: number) => void;
  chordCell: (cellIndex: number) => void;
};

/**
 * 触れる例の状態。本番のプレイと同じ関数で、開く・旗を置く・外す・まとめて開くを行い、盤面が変わった手だけ本番と同じ音を鳴らす。
 * 盤面が変わらない手（旗のマスや開いたマスを押す、旗の数がそろわない数字を押す）は、本番と同じく何も返さない。
 * 例は時間と回数を持たず、完成しても本番のクリア音は鳴らさない。
 * 手を打つたびに、最初の姿（盤面と、旗に切り替えていないこと）から変わったかを例を並べる面に知らせ、最初の姿に戻すときは面が例を作り直す。
 */
export function useTouchableExample(
  rows: MinesweeperHowToPlayFigureRows,
): MinesweeperTouchableExample {
  const [initial] = useState(() => createMinesweeperExampleBoard(rows));
  const [example, setExample] = useState(initial);
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const [operation, setOperation] = useState<MinesweeperOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  useMinesweeperSoundEffects(operation, "playing");

  function apply(
    next: MinesweeperExampleBoard,
    createOperation: (id: number) => MinesweeperOperation,
  ): void {
    if (next === example) {
      return;
    }
    operationIdRef.current += 1;
    setOperation(createOperation(operationIdRef.current));
    setExample(next);
    reportChange(
      isMinesweeperExampleChanged(next, initial) || mode !== "reveal",
    );
  }

  function revealCell(cellIndex: number): void {
    const next = revealMinesweeperExampleCell(example, cellIndex);
    apply(next, (id) =>
      createMinesweeperOpeningOperation(
        id,
        cellIndex,
        example.puzzle,
        next.puzzle,
      ),
    );
  }

  function chordCell(cellIndex: number): void {
    const next = chordMinesweeperExampleCell(example, cellIndex);
    apply(next, (id) =>
      createMinesweeperOpeningOperation(
        id,
        cellIndex,
        example.puzzle,
        next.puzzle,
      ),
    );
  }

  function toggleFlag(cellIndex: number): void {
    const next = toggleMinesweeperExampleFlag(example, cellIndex);
    apply(next, (id) =>
      createMinesweeperFlagOperation(id, cellIndex, next.puzzle),
    );
  }

  function changeMode(nextMode: MinesweeperInputMode): void {
    setMode(nextMode);
    reportChange(
      isMinesweeperExampleChanged(example, initial) || nextMode !== "reveal",
    );
  }

  return { example, mode, changeMode, revealCell, toggleFlag, chordCell };
}
