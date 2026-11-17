import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import { TAKUZU_BOARD_SIZE } from "@/games/takuzu/problem/problem";
import type { TakuzuTile } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import { animateGivenCellRejection } from "@/games/takuzu/ui/board/animate-given-cell-rejection";
import {
  createTakuzuExampleBoard,
  listTakuzuExampleCells,
  type TakuzuExampleBoard,
  tapTakuzuExampleCell,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type { TakuzuHowToPlayFigureBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { useTakuzuSoundEffects } from "@/games/takuzu/ui/use-takuzu-sound-effects";

/** 最後に押したマスと、押して通らなかったか（最初からあるタイルを押したか）。 */
export type TakuzuExampleTap = { figureIndex: number; rejected: boolean };

export type TakuzuTouchableExample = {
  example: TakuzuExampleBoard;
  /** 最後に押したマス。まだ押していなければ `null`。 */
  lastTap: TakuzuExampleTap | null;
  tap: (
    figureIndex: number,
    direction: TakuzuCycleDirection,
    element: HTMLElement,
  ) => void;
};

function differsFromInitial(
  example: TakuzuExampleBoard,
  initial: TakuzuExampleBoard,
): boolean {
  const initialCells = listTakuzuExampleCells(initial);
  return listTakuzuExampleCells(example).some(
    ({ cell }, figureIndex) => cell !== initialCells[figureIndex]?.cell,
  );
}

/**
 * 触れる例の状態。本番の盤面と同じく、押したマスを巡回させ、最初からあるタイルは揺らして変えない。
 * 揺れと音は本番と同じ関数で鳴らすので、動きを減らす設定では本番と同じく揺らさず、通らない音も鳴らさない。
 * 例は解き終える盤面ではないので、クリア音は鳴らさない。
 * 押すたびに、最初の姿から変わったかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * `changedBy` は、最初の姿から変わったとみなすもの。
 * - `board`: 盤面が最初と違う間。押して最初の形に戻れば、変わっていないとみなす。
 * - `tap`: 一度でも押した後。押しても盤面の変わらない手を見せる例で、押した後の判定と手がかりを戻せるようにする。
 */
export function useTouchableExample(
  initialBoard: TakuzuHowToPlayFigureBoard,
  changedBy: "board" | "tap" = "board",
): TakuzuTouchableExample {
  const [initial] = useState(() => createTakuzuExampleBoard(initialBoard));
  const [example, setExample] = useState(initial);
  const reportChange = useReportHowToPlayExampleChange();
  const [lastTap, setLastTap] = useState<TakuzuExampleTap | null>(null);
  const [operation, setOperation] = useState<TakuzuOperation | null>(null);
  const operationIdRef = useRef(0);

  useTakuzuSoundEffects(operation, "playing", TAKUZU_BOARD_SIZE);

  function notifyOperation(
    notice:
      | { type: "placed"; tile: TakuzuTile }
      | { type: "emptied" }
      | { type: "invalid"; cellIndex: number },
  ): void {
    operationIdRef.current += 1;
    setOperation({ ...notice, id: operationIdRef.current });
  }

  function tap(
    figureIndex: number,
    direction: TakuzuCycleDirection,
    element: HTMLElement,
  ): void {
    const result = tapTakuzuExampleCell(example, figureIndex, direction);
    setLastTap({ figureIndex, rejected: result.rejected });
    reportChange(
      changedBy === "tap" || differsFromInitial(result.example, initial),
    );
    if (result.rejected) {
      animateGivenCellRejection(element);
      notifyOperation({ type: "invalid", cellIndex: result.cellIndex });
      return;
    }
    notifyOperation(
      result.cell === null
        ? { type: "emptied" }
        : { type: "placed", tile: result.cell },
    );
    setExample(result.example);
  }

  return { example, lastTap, tap };
}
